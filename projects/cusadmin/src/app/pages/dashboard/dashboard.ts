import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { getUserFullName } from '@shared/utils/user.util';
import { selectProfileUser } from '@cusadmin/store/profile/profile.feature';

/** Dashboard (Phase 1 placeholder: greeting). Stat cards and recent messages arrive in Phase 4. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private readonly user = toSignal(inject(Store).select(selectProfileUser), { initialValue: null });

  get name(): string {
    return getUserFullName(this.user());
  }
}
