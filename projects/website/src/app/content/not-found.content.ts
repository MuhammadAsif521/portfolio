/** Unknown URLs (the router's ** route): a real 404 page, not a redirect to the home page. */
export const NOT_FOUND_CONTENT = {
  title: 'Page not found',
  text: 'This page does not exist or has moved. These are good places to start:',
  links: [
    { label: 'Home', path: '/', fragment: undefined },
    { label: 'Projects', path: '/', fragment: 'projects' },
    { label: 'Blog', path: '/blog', fragment: undefined },
    { label: 'Contact', path: '/', fragment: 'contact' },
  ],
} as const;
