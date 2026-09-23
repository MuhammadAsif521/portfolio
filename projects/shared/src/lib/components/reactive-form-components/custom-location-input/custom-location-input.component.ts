import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy,
  SimpleChanges, NgZone, ChangeDetectorRef, ViewChild, ElementRef, HostListener,
  inject
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { environment } from '@shared/environment/environment';
import { Observable, Subject, Subscription, from, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil } from 'rxjs/operators';


export interface BaseLocationData {
  city?: string;
  state?: string;
  stateCode?: string;
  country?: string;
  countryCode?: string;
}
let googleMapsLoadPromise: Promise<void> | null = null;

export interface ParsedPlace {
  // Can be null when the result came from useCurrentLocation() (Geocoder), not Autocomplete.
  rawPlace: google.maps.places.Place | null;
  formattedAddress: string;
  coordinates: { lat: number; lng: number } | null;
  streetNumber: string | null;
  route: string | null;
  fullStreet: string | null;
  city: { name: string; shortName: string } | null;
  state: { name: string; shortName: string } | null;
  zipCode: string | null;
  country: { name: string; shortName: string } | null;
  neighborhood: string | null;
  county: string | null;
  placeId: string | null;
  areaBounds: google.maps.LatLngBoundsLiteral | null;
  addressComponents: google.maps.places.AddressComponent[] | null;
}

@Component({
  selector: 'app-custom-location-input',
  standalone: true,
  templateUrl: './custom-location-input.component.html',
  imports: [IconComponent, ReactiveFormsModule],
})
export class CustomLocationInputComponent implements OnInit, OnChanges, OnDestroy {
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  @Input() control!: FormControl;
  @Input() controlName: string = '';
  @Input() label$!: Observable<string>;
  @Input() placeholder: string = '';
  @Input() showLabel: boolean = true;
  @Input() theme: 'white' | 'dark' = 'white';

  @Input() restrictTo: 'country' | 'state' | 'city' | 'none' = 'none';

  @Input() baseData: BaseLocationData | null = null;

  @Output() places = new EventEmitter<ParsedPlace>();

  @ViewChild('triggerInput') triggerInput!: ElementRef<HTMLInputElement>;

  displayLabel: string = 'Address';
  suggestions: google.maps.places.AutocompleteSuggestion[] = [];
  isFocused: boolean = false;
  hoveredSuggestionIndex: number | null = null;

  // Fixed panel coords
  panelTop = 0;
  panelLeft = 0;
  panelWidth = 0;

  private locationBounds: google.maps.LatLngBoundsLiteral | null = null;

  private sessionToken: google.maps.places.AutocompleteSessionToken | undefined;
  private destroy$ = new Subject<void>();
  private inputSubject = new Subject<string>();
  private autocompleteSubscription?: Subscription;

  private scrollListener = () => this.updatePanelPosition();
  private resizeListener = () => this.updatePanelPosition();

  get hasRequiredValidator(): boolean {
    return this.control?.hasValidator(Validators.required) ?? false;
  }

  get isInvalid(): boolean {
    return this.control?.invalid && (this.control?.dirty || this.control?.touched);
  }

  ngOnInit(): void {
    if (this.label$) {
      this.label$.pipe(takeUntil(this.destroy$)).subscribe(label => {
        this.displayLabel = label;
      });
    }

    this.initGoogleMaps().then(() => this.setupAutocomplete());
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-resolve bounds whenever the caller supplies/updates baseData, or flips restrictTo.
    if (changes['baseData'] || changes['restrictTo']) {
      this.locationBounds = null;
      if (this.baseData) {
        this.resolveLocationBounds();
      }
    }
  }

  async initGoogleMaps(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!googleMapsLoadPromise) {
      setOptions({ key: environment.google_places, v: 'weekly', libraries: ['places'] });

      googleMapsLoadPromise = Promise.all([importLibrary('places'), importLibrary('geocoding')])
        .then(() => undefined)
        .catch(error => {
          googleMapsLoadPromise = null;
          throw error;
        });
    }
    try {
      await googleMapsLoadPromise;
      this.refreshSessionToken();
    } catch (error) {
      console.error('Google Maps API failed to load', error);
    }
  }

  private async resolveLocationBounds(): Promise<void> {
    if (this.restrictTo === 'country' || this.restrictTo === 'none' || !this.baseData) return;

    const city = this.baseData.city?.trim();
    const state = this.baseData.state?.trim();
    const country = this.baseData.country?.trim();
    if (!city || !state || !country) return;

    const query = this.restrictTo === 'city'
      ? `${city}, ${state}, ${country}`
      : `${state}, ${country}`;

    try {
      const geocoder = new google.maps.Geocoder();
      const { results } = await geocoder.geocode({ address: query });
      const viewport = results?.[0]?.geometry?.viewport;
      if (viewport) {
        this.locationBounds = {
          north: viewport.getNorthEast().lat(),
          east: viewport.getNorthEast().lng(),
          south: viewport.getSouthWest().lat(),
          west: viewport.getSouthWest().lng(),
        };
      }
    } catch {
      // will retry on next keystroke via fetchSuggestions()
    }
  }

  private setupAutocomplete(): void {
    this.autocompleteSubscription = this.inputSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.trim().length === 0) {
          this.ngZone.run(() => {
            this.suggestions = [];
            this.closeSuggestions();
            this.cdr.markForCheck();
          });
          return of([]);
        }
        return from(this.fetchSuggestions(query)).pipe(
          catchError(err => {
            console.error('Autocomplete fetch failed', err);
            return of([]);
          })
        );
      })
    ).subscribe(result => {
      this.ngZone.run(() => {
        this.suggestions = result ?? [];
        // Recalc position every time suggestions list changes (count affects panel height)
        if (this.suggestions.length > 0) {
          this.updatePanelPosition();
          this.ngZone.runOutsideAngular(() => {
            window.addEventListener('scroll', this.scrollListener, true);
            window.addEventListener('resize', this.resizeListener);
          });
        } else {
          this.removeListeners();
        }
        this.cdr.markForCheck();
      });
    });
  }

  private async fetchSuggestions(query: string): Promise<google.maps.places.AutocompleteSuggestion[]> {
    if (!this.locationBounds && this.restrictTo !== 'country' && this.restrictTo !== 'none' && this.baseData) {
      await this.resolveLocationBounds();
    }

    const request: any = { input: query, sessionToken: this.sessionToken };

    if (this.locationBounds) {
      request.locationRestriction = this.locationBounds;
    } else if (this.restrictTo !== 'none') {
      const countryCode = this.baseData?.countryCode ?? '';
      if (countryCode) request.includedRegionCodes = [countryCode];
    }

    let { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
    suggestions = suggestions ?? [];

    if (this.restrictTo === 'city' && this.baseData?.city) {
      const cityLower = this.baseData.city.trim().toLowerCase();
      suggestions = suggestions.filter(s => {
        const fullText = ((s.placePrediction?.text as any)?.text ?? s.placePrediction?.text?.toString() ?? '').toLowerCase();
        const secondaryText = ((s.placePrediction as any)?.structuredFormat?.secondaryText?.text ?? '').toLowerCase();
        return fullText.includes(cityLower) || secondaryText.includes(cityLower);
      });
    } else if (this.restrictTo === 'state' && this.baseData?.stateCode && !this.locationBounds) {
      const stateCodeLower = this.baseData.stateCode.trim().toLowerCase();
      suggestions = suggestions.filter(s => {
        const secondaryText = ((s.placePrediction as any)?.structuredFormat?.secondaryText?.text ?? '').toLowerCase();
        return secondaryText.includes(stateCodeLower);
      });
    }

    return suggestions;
  }

  onInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.inputSubject.next(query);
  }

  private updatePanelPosition(): void {
    if (!this.triggerInput) return;

    this.ngZone.run(() => {
      const rect = this.triggerInput.nativeElement.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const panelH = Math.min(240, this.suggestions.length * 52 + 8);

      this.panelTop = (spaceBelow >= panelH + 8)
        ? rect.bottom + 6
        : rect.top - panelH - 6;

      this.panelLeft = rect.left;
      this.panelWidth = rect.width;
      this.cdr.markForCheck();
    });
  }

  private refreshSessionToken(): void {
    this.sessionToken = new google.maps.places.AutocompleteSessionToken();
  }

  async onSelect(suggestion: google.maps.places.AutocompleteSuggestion): Promise<void> {
    const placePrediction = suggestion.placePrediction;
    if (!placePrediction) return;
    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'location', 'formattedAddress', 'addressComponents'],
      });
      const parsed = this.parseAddressComponents(place.addressComponents);
      const result: ParsedPlace = {
        rawPlace: place,
        formattedAddress: place.formattedAddress ?? placePrediction.text.toString(),
        coordinates: place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null,
        ...parsed,
        placeId: (place as any).id ?? null,
        areaBounds: this.locationBounds,
        addressComponents: place.addressComponents ?? null,
      };
      this.ngZone.run(() => {
        this.control.setValue(result.formattedAddress);
        this.places.emit(result);

        this.suggestions = [];
        this.removeListeners();
        this.cdr.markForCheck();
      });
      this.refreshSessionToken();
    } catch (error) {
      console.error('Place details fetch failed', error);
    }
  }

  /**
   * New: fills the field from the browser's geolocation via reverse geocoding.
   * Wire a button in the template to call this, e.g. (click)="useCurrentLocation()".
   */
  useCurrentLocation(): void {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const geocoder = new google.maps.Geocoder();
          const { results } = await geocoder.geocode({ location: { lat, lng } });
          if (!results?.length) return;

          const geoResult = results[0];
          const formattedAddress = geoResult.formatted_address ?? '';
          const getComponent = (type: string, useShort = false): string => {
            const comp = geoResult.address_components?.find(c => c.types?.includes(type));
            return useShort ? (comp?.short_name ?? '') : (comp?.long_name ?? '');
          };

          const city = getComponent('locality') || getComponent('postal_town') || getComponent('sublocality_level_1');
          const state = getComponent('administrative_area_level_1');
          const country = getComponent('country');
          const streetNumber = getComponent('street_number');
          const route = getComponent('route');

          const parsed: ParsedPlace = {
            rawPlace: null,
            formattedAddress,
            coordinates: { lat, lng },
            streetNumber: streetNumber || null,
            route: route || null,
            fullStreet: [streetNumber, route].filter(Boolean).join(' ') || null,
            city: city ? { name: city, shortName: city } : null,
            state: state ? { name: state, shortName: getComponent('administrative_area_level_1', true) } : null,
            zipCode: getComponent('postal_code') || null,
            country: country ? { name: country, shortName: getComponent('country', true) } : null,
            neighborhood: getComponent('neighborhood') || getComponent('sublocality_level_1') || null,
            county: getComponent('administrative_area_level_2') || null,
            placeId: geoResult.place_id ?? null,
            areaBounds: this.locationBounds,
            addressComponents: null,
          };

          this.ngZone.run(() => {
            this.control.setValue(formattedAddress);
            this.places.emit(parsed);

            this.suggestions = [];
            this.removeListeners();
            this.cdr.markForCheck();
          });
        } catch (error) {
          console.error('Reverse geocoding failed', error);
        }
      },
      (error) => console.error('Location access denied', error)
    );
  }

  private closeSuggestions(): void {
    this.suggestions = [];
    this.removeListeners();
  }

  private removeListeners(): void {
    window.removeEventListener('scroll', this.scrollListener, true);
    window.removeEventListener('resize', this.resizeListener);
  }

  private parseAddressComponents(
    components: google.maps.places.AddressComponent[] | undefined
  ) {
    let streetNumber: string | null = null;
    let route: string | null = null;
    let city: { name: string; shortName: string } | null = null;
    let state: { name: string; shortName: string } | null = null;
    let zipCode: string | null = null;
    let country: { name: string; shortName: string } | null = null;
    let neighborhood: string | null = null;
    let county: string | null = null;
    let sublocality: string | null = null;

    if (!components) {
      return {
        streetNumber,
        route,
        fullStreet: null as string | null,
        city,
        state,
        zipCode,
        country,
        neighborhood,
        county,
      };
    }

    for (const c of components) {
      if (c.types.includes('street_number')) {
        streetNumber = c.longText ?? null;
      } else if (c.types.includes('route')) {
        route = c.longText ?? null;
      } else if (c.types.includes('locality')) {
        city = {
          name: c.longText ?? '',
          shortName: c.shortText ?? '',
        };
      } else if (c.types.includes('postal_town') && !city) {
        city = {
          name: c.longText ?? '',
          shortName: c.shortText ?? '',
        };
      } else if (c.types.includes('sublocality_level_1')) {
        sublocality = c.longText ?? null;
      } else if (c.types.includes('administrative_area_level_1')) {
        state = {
          name: c.longText ?? '',
          shortName: c.shortText ?? '',
        };
      } else if (c.types.includes('administrative_area_level_2')) {
        county = c.longText ?? null;
      } else if (c.types.includes('postal_code')) {
        zipCode = c.longText ?? null;
      } else if (c.types.includes('country')) {
        country = {
          name: c.longText ?? '',
          shortName: c.shortText ?? '',
        };
      } else if (c.types.includes('neighborhood')) {
        neighborhood = c.longText ?? null;
      }
    }

    // Fallbacks: some localities only expose a sublocality
    // (e.g. certain city districts)
    if (!city && sublocality) {
      city = {
        name: sublocality,
        shortName: sublocality,
      };
    }

    if (!neighborhood && sublocality) {
      neighborhood = sublocality;
    }

    const fullStreet = [streetNumber, route].filter(Boolean).join(' ') || null;

    return {
      streetNumber,
      route,
      fullStreet,
      city,
      state,
      zipCode,
      country,
      neighborhood,
      county,
    };
  }

  @HostListener('document:click')
  onDocumentClick(): void { this.closeSuggestions(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeSuggestions(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.inputSubject.complete();
    this.autocompleteSubscription?.unsubscribe();
    this.removeListeners();
  }
}