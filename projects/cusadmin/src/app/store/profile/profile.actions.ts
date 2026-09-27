import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AdminUser } from '@cusadmin/core/models/admin.model';

export const ProfileActions = createActionGroup({
  source: 'Profile',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ user: AdminUser }>(),
    'Load Failure': props<{ error: string }>(),
    Clear: emptyProps(),
  },
});
