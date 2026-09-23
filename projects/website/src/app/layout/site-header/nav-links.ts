/** Main navigation (brief, Part 6). Section links scroll the home page; Blog is its own route. */
export interface NavLink {
  label: string;
  /** Home-page section id (scroll-spy) — or a route for Blog. */
  section?: string;
  route?: string;
}

export const NAV_LEFT: readonly NavLink[] = [
  { label: 'Home', section: 'home' },
  { label: 'About', section: 'about' },
  { label: 'What I Do', section: 'services' },
  { label: 'Experience', section: 'experience' },
];

export const NAV_RIGHT: readonly NavLink[] = [
  { label: 'Projects', section: 'projects' },
  { label: 'Blog', route: '/blog' },
  { label: 'Contact', section: 'contact' },
];

export const NAV_ALL: readonly NavLink[] = [...NAV_LEFT, ...NAV_RIGHT];
