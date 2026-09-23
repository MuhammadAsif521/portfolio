import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '@shared/environment/environment';

/**
 * Prefixes a relative asset path (e.g. `/uploads/images/foo.png`) returned by
 * the API with the backend's asset base URL. Absolute URLs are passed
 * through untouched.
 *
 * Usage: `<img [src]="event.icon | assetUrl" />`
 */
@Pipe({
  name: 'assetUrl',
  standalone: true,
})
export class AssetUrlPipe implements PipeTransform {
  transform(path?: string | null): string {
    if (!path) return '';
    return /^https?:\/\//i.test(path) ? path : `${environment.imageUrl}${path}`;
  }
}
