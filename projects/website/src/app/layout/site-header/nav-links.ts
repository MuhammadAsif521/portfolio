/**
 * Main navigation (brief, Part 6), in page order so the scroll-spy indicator only moves one way.
 * Section links scroll the home page; Blog is its own route.
 */
export interface NavLink {
  label: string;
  /** Home-page section id (scroll-spy) — or a route for Blog. */
  section?: string;
  route?: string;
}

export const NAV_LEFT: readonly NavLink[] = [
  { label: 'Home', section: 'home' },
  { label: 'What I Do', section: 'services' },
  { label: 'Experience', section: 'experience' },
  { label: 'About', section: 'about' },
];

export const NAV_RIGHT: readonly NavLink[] = [
  { label: 'Projects', section: 'projects' },
  { label: 'Blog', route: '/blog' },
  { label: 'Contact', section: 'contact' },
];

export const NAV_ALL: readonly NavLink[] = [...NAV_LEFT, ...NAV_RIGHT];

/** Stable key for a nav item ("route:/blog", "section:about"), shared by the desktop nav and the mobile menu. */
export function navKey(link: NavLink): string {
  return link.route ? `route:${link.route}` : `section:${link.section ?? ''}`;
}
