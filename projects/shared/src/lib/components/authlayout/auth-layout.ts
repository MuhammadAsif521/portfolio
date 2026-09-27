import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

type AuthMode = 'login';

interface AuthModeContent {
  badge: string;
  heading: string;
  headingAccent: string;
  description: string;
  stats: { value: string; label: string }[];
}

/**
 * Split auth screen (same layout as conb-sites-admin): form column on the left, branded panel with a
 * grid overlay on the right (lg+). Used by cusadmin's login page; the form goes in the content slot.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-layout.html',
})
export class AuthLayoutComponent {
  @Input() mode: AuthMode = 'login';

  readonly mark = 'AP';

  private readonly content: Record<AuthMode, AuthModeContent> = {
    login: {
      badge: 'SECURE ADMIN ACCESS',
      heading: 'Manage Your',
      headingAccent: 'Portfolio',
      description:
        'Publish projects and blog posts, update your experience and testimonials, answer messages and keep your site settings and brand theme in one place.',
      stats: [
        { value: '100%', label: 'SECURE ACCESS' },
        { value: 'SSR', label: 'LIVE UPDATES' },
      ],
    },
  };

  get current(): AuthModeContent {
    return this.content[this.mode];
  }
}
