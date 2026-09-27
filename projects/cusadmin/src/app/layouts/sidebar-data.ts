import { NavItem } from '@cusadmin/core/interfaces/nav-item.interface';

/**
 * Sidebar navigation (same shape as conb-sites-admin: `navCap` entries start a collapsible group).
 * Icons are lucide names.
 */
export const navItems: NavItem[] = [
  { navCap: 'Overview' },
  { displayName: 'Dashboard', icon: 'layout-dashboard', route: '/' },

  { navCap: 'Content' },
  { displayName: 'Projects', icon: 'briefcase', route: '/projects' },
  { displayName: 'Blog Posts', icon: 'newspaper', route: '/blog' },
  { displayName: 'Experience', icon: 'history', route: '/experience' },
  { displayName: 'Testimonials', icon: 'message-square-quote', route: '/testimonials' },

  { navCap: 'Inbox' },
  { displayName: 'Messages', icon: 'mail', route: '/messages' },

  { navCap: 'Administration' },
  { displayName: 'Site Settings', icon: 'settings', route: '/settings' },
  { displayName: 'Themes', icon: 'palette', route: '/themes' },
  { displayName: 'Resume', icon: 'file-text', route: '/resume' },
];
