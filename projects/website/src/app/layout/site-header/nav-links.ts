/**
 * Main navigation (brief, Part 6), in page order so the scroll-spy indicator only moves one way.
 * Section links scroll the home page; Services, Blog and Tools are their own routes.
 */
export interface NavLink {
  label: string;
  /** Home-page section id (scroll-spy) — or a route for Services, Blog and Tools. */
  section?: string;
  route?: string;
}

export const NAV_LEFT: readonly NavLink[] = [
  { label: 'Home', section: 'home' },
  { label: 'Services', route: '/services' },
  { label: 'Experience', section: 'experience' },
  { label: 'About', section: 'about' },
];

export const NAV_RIGHT: readonly NavLink[] = [
  { label: 'Projects', section: 'projects' },
  { label: 'Blog', route: '/blog' }, 
  { label: 'Tools', route: '/tools' }, 
  { label: 'Contact', section: 'contact' },
];

export const NAV_ALL: readonly NavLink[] = [...NAV_LEFT, ...NAV_RIGHT];

/** Stable key for a nav item ("route:/blog", "section:about"), shared by the desktop nav and the mobile menu. */
export function navKey(link: NavLink): string {
  return link.route ? `route:${link.route}` : `section:${link.section ?? ''}`;
}


/**
 * Key of the nav item that should look active: the route link whose page is open (/services, /services/<slug>,
 * /blog/…, /tools/…), or on the home page the section in view. The home Services section has no link of its
 * own, so while it is in view the Services route link stands for it.
 */
export function activeNavKey(url: string, activeSection: string): string {
  const path = url.split(/[?#]/)[0];
  if (path === '/') {
    const link = activeSection === 'services' ? NAV_ALL.find((item) => item.route === '/services') : undefined;
    return link ? navKey(link) : `section:${activeSection}`;
  }
  const link = NAV_ALL.find((item) => item.route && (path === item.route || path.startsWith(`${item.route}/`)));
  return link ? navKey(link) : '';
}
