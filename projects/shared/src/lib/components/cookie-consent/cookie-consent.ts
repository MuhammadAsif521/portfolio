import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConsentService } from '@shared/services/consent.service';

@Component({
    selector: 'app-cookie-consent',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './cookie-consent.html',
})
export class CookieConsentComponent {
    @Input() privacyPolicyPath = '/privacy-policy';

    protected readonly consentService = inject(ConsentService);
}
