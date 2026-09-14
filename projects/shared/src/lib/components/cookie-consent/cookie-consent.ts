import { Component, OnInit, signal, inject } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { RouterLink } from '@angular/router';
import { ConsentService, CookiePreferences } from '@shared/services/consent.service';

@Component({
    selector: 'app-cookie-consent',
    standalone: true,
    imports: [IconComponent , RouterLink],
    templateUrl: './cookie-consent.html',
    animations: [
        trigger('slideUp', [
            transition(':enter', [
                style({ transform: 'translateY(110%)', opacity: 0 }),
                animate('360ms cubic-bezier(0.4, 0, 0.2, 1)',
                    style({ transform: 'translateY(0)', opacity: 1 }))
            ]),
            transition(':leave', [
                animate('240ms cubic-bezier(0.4, 0, 0.2, 1)',
                    style({ transform: 'translateY(110%)', opacity: 0 }))
            ])
        ])
    ]
})
export class CookieConsentComponent implements OnInit {
    private consentService = inject(ConsentService);

    visible = signal(false);

    preferences = signal<CookiePreferences>(this.consentService.preferences());

    ngOnInit(): void {
        if (!this.consentService.answered()) {
            setTimeout(() => this.visible.set(true), 800);
        }
    }

    togglePref(key: keyof Omit<CookiePreferences, 'necessary'>): void {
        this.preferences.update(p => ({ ...p, [key]: !p[key] }));
    }

    acceptAll(): void {
        this.preferences.set({ necessary: true, analytics: true, marketing: true });
        this.save();
    }

    rejectAll(): void {
        this.preferences.set({ necessary: true, analytics: false, marketing: false });
        this.save();
    }

    savePreferences(): void {
        this.save();
    }

    private save(): void {
        this.consentService.save(this.preferences());
        this.visible.set(false);
    }
}