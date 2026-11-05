/*
 * HTTP status code reference: one indexable page per code at /tools/http-status-codes/<code>.
 * Each entry must carry unique, useful content (meaning, causes, fix, SEO impact): never add a code with
 * filler text. The backend keeps a verbatim copy at portfolio-node/src/data/http-status.data.ts for the
 * sitemap (run `npm run sync:tools`). Keep it import-free.
 */

export type StatusClass = 'success' | 'redirect' | 'client-error' | 'server-error';

export interface HttpStatus {
  code: number;
  name: string;
  kind: StatusClass;
  /** One-sentence, answer-first definition (also the meta description base). */
  summary: string;
  meaning: string;
  causes: string[];
  fix: string;
  /** Express (Node.js) example. */
  express: string;
  seo: string;
  updatedAt: string;
}

export const HTTP_STATUS_PATH = '/tools/http-status-codes';

export const STATUS_CLASS_LABELS: Record<StatusClass, string> = {
  success: '2xx Success',
  redirect: '3xx Redirection',
  'client-error': '4xx Client errors',
  'server-error': '5xx Server errors',
};

const D = '2026-11-05';

export const HTTP_STATUSES: HttpStatus[] = [
  {
    code: 200,
    name: 'OK',
    kind: 'success',
    summary: 'HTTP 200 OK means the request succeeded and the response body contains the requested resource.',
    meaning:
      'A 200 is the normal answer to a successful GET, and to a POST or PUT that returns the result in the body. It says nothing about whether the content is correct: an API that returns 200 with { "error": "not found" } in the body is lying to every client, cache and crawler that reads the status line.',
    causes: [
      'A page or API resource was found and returned.',
      'A form or API call succeeded and the server replies with the result.',
      'A "soft 404": an error or empty page wrongly sent with 200.',
    ],
    fix: 'Return 200 only for real successes. Send errors with a matching 4xx or 5xx code, and return 201 or 204 where they describe the result better.',
    express: `app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.status(200).json(user); // 200 is the default, shown for clarity
});`,
    seo: 'Google indexes 200 pages. An error page served with 200 becomes a soft 404 in Search Console and wastes crawl budget, so make SSR error pages set the real status code.',
    updatedAt: D,
  },
  {
    code: 201,
    name: 'Created',
    kind: 'success',
    summary: 'HTTP 201 Created means the request succeeded and a new resource was created, usually by a POST.',
    meaning:
      'A 201 tells the client that something new now exists. The response should include a Location header with the URL of the new resource, and usually the created object in the body so the client does not need a second request.',
    causes: [
      'A POST to a collection endpoint created a record.',
      'A PUT created a resource at a URL that did not exist before.',
    ],
    fix: 'Use 201 for creation endpoints, set Location, and keep 200 for updates and reads. Make creation idempotent where clients retry (for example with an idempotency key).',
    express: `app.post('/api/posts', async (req, res) => {
  const post = await Post.create(req.body);
  res.status(201).location(\`/api/posts/\${post.id}\`).json(post);
});`,
    seo: 'No direct SEO effect: crawlers do not send POST requests. It matters for API clients and monitoring that count successes by code.',
    updatedAt: D,
  },
  {
    code: 204,
    name: 'No Content',
    kind: 'success',
    summary: 'HTTP 204 No Content means the request succeeded and there is deliberately no response body.',
    meaning:
      'A 204 is a good answer to DELETE, to a PUT or PATCH where the client already has the new state, and to CORS preflight requests. Any body sent with a 204 is ignored, and Angular HttpClient returns null for it.',
    causes: ['A DELETE removed a resource.', 'An update succeeded and the server returns nothing.', 'A CORS preflight (OPTIONS) was accepted.'],
    fix: 'Do not call res.json() with a 204: use res.sendStatus(204) or res.status(204).end(). If the client needs the updated object, return 200 with it instead.',
    express: `app.delete('/api/posts/:id', async (req, res) => {
  await Post.deleteOne({ _id: req.params.id });
  res.sendStatus(204);
});`,
    seo: 'A page URL that answers 204 has no content to index. Keep 204 for API endpoints, never for HTML pages.',
    updatedAt: D,
  },
  {
    code: 301,
    name: 'Moved Permanently',
    kind: 'redirect',
    summary: 'HTTP 301 Moved Permanently means the resource has a new permanent URL, given in the Location header.',
    meaning:
      'Browsers and search engines remember a 301: the old URL is replaced by the new one, and ranking signals move with it. Browsers may also change a POST into a GET when following a 301, which is why 308 exists.',
    causes: [
      'A page moved to a new slug or path.',
      'Host normalisation, such as www to non-www or http to https.',
      'Trailing-slash or case normalisation.',
    ],
    fix: 'Use 301 (or 308) for permanent moves, redirect straight to the final URL in one hop, and update internal links and the sitemap to the new URL so crawlers stop hitting the redirect.',
    express: `app.get('/old-post', (_req, res) => res.redirect(301, '/blog/new-post'));`,
    seo: 'The standard way to move a page without losing rankings. Avoid chains (A to B to C) and never redirect every missing page to the home page; Google treats that as a soft 404.',
    updatedAt: D,
  },
  {
    code: 302,
    name: 'Found',
    kind: 'redirect',
    summary: 'HTTP 302 Found is a temporary redirect: the resource is at another URL for now, and the original URL stays canonical.',
    meaning:
      'Clients follow a 302 but keep using the original URL next time. Express res.redirect() sends 302 by default, which is a common reason permanent moves end up as temporary redirects.',
    causes: [
      'res.redirect(url) without a status in Express.',
      'Login flows that send the user to a sign-in page and back.',
      'A/B tests, maintenance pages or geo routing.',
    ],
    fix: 'Pass 301 or 308 explicitly for permanent moves. Keep 302 (or 307, which preserves the method) for genuinely temporary redirects.',
    express: `// Temporary: send logged-out users to the login page
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect(302, '/login?next=/dashboard');
  res.render('dashboard');
});`,
    seo: 'Google usually keeps the original URL indexed for a 302. If a 302 stays in place for a long time Google may treat it as permanent, but do not rely on that; use 301 for real moves.',
    updatedAt: D,
  },
  {
    code: 304,
    name: 'Not Modified',
    kind: 'redirect',
    summary: 'HTTP 304 Not Modified means the cached copy is still valid, so the server sends no body and the client reuses its cache.',
    meaning:
      'A 304 is the answer to a conditional request with If-None-Match (ETag) or If-Modified-Since. It saves bandwidth and time. Express adds ETags to responses by default, so you often see 304s for repeated API calls in DevTools.',
    causes: ['The ETag sent by the client matches the current one.', 'The resource has not changed since the If-Modified-Since date.'],
    fix: 'Nothing to fix: it is a cache hit. If you see stale data, check that the ETag changes when the content changes, or send Cache-Control: no-store for data that must never be reused.',
    express: `// Express sets ETag automatically; disable only if you have a reason to
app.set('etag', 'strong');`,
    seo: 'Good for crawling: Googlebot sends conditional requests, and 304 lets it skip unchanged pages and spend its crawl budget on new ones.',
    updatedAt: D,
  },
  {
    code: 400,
    name: 'Bad Request',
    kind: 'client-error',
    summary: 'HTTP 400 Bad Request means the server could not process the request because the client sent something malformed or invalid.',
    meaning:
      'A 400 is the general "your input is wrong" answer: invalid JSON, a missing required field, a value of the wrong type. The response body should say which field is wrong so the client can fix it.',
    causes: [
      'Malformed JSON in the body (express.json() rejects it).',
      'A required field is missing or has the wrong type.',
      'An invalid query parameter, such as page=abc.',
    ],
    fix: 'Validate every input at the edge, for example with Zod, and return 400 with field-level messages. Some APIs use 422 for well-formed but semantically invalid data; pick one convention and keep it.',
    express: `const schema = z.object({ email: z.string().email() });
app.post('/api/subscribe', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  // ...
});`,
    seo: 'Pages that answer 400 are not indexed. If public URLs return 400 because of tracking parameters, accept and ignore unknown parameters instead.',
    updatedAt: D,
  },
  {
    code: 401,
    name: 'Unauthorized',
    kind: 'client-error',
    summary: 'HTTP 401 Unauthorized means the request has no valid authentication: the client must log in or send a valid token.',
    meaning:
      'Despite the name, 401 is about authentication (who you are), not permission. Send it when the token is missing, expired or has a bad signature. A client usually reacts by refreshing the token or redirecting to login.',
    causes: [
      'No Authorization header or session cookie.',
      'An expired JWT (check the exp claim) or one signed with another secret.',
      'Clock skew between servers making a fresh token look expired.',
    ],
    fix: 'Return 401 for missing or invalid credentials and 403 for authenticated users without permission. In Angular, an HTTP interceptor can catch 401, refresh the token once and retry.',
    express: `function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Not authenticated' });
  }
}`,
    seo: 'Crawlers do not log in, so 401 pages are never indexed. Keep public content outside authenticated routes.',
    updatedAt: D,
  },
  {
    code: 403,
    name: 'Forbidden',
    kind: 'client-error',
    summary: 'HTTP 403 Forbidden means the server knows who you are, or does not care, and refuses the request anyway.',
    meaning:
      'A 403 is about authorization: the user is logged in but lacks the role, or the resource is blocked for everyone (for example by a firewall or a directory with no index). Retrying with the same credentials will not help.',
    causes: [
      'A role or ownership check failed (a user editing another user\'s data).',
      'A WAF, CDN or bot protection rule blocked the request.',
      'File-system permissions on a static server.',
    ],
    fix: 'Check permissions on the server for every request (never trust the client UI). For resources the user should not even know exist, return 404 instead of 403 to avoid leaking their existence.',
    express: `function requireRole(role) {
  return (req, res, next) =>
    req.user?.roles.includes(role) ? next() : res.status(403).json({ message: 'Forbidden' });
}
app.delete('/api/users/:id', requireAuth, requireRole('admin'), deleteUser);`,
    seo: 'If a CDN or bot filter answers 403 to Googlebot, pages drop out of the index. Check Search Console URL Inspection after enabling bot protection.',
    updatedAt: D,
  },
  {
    code: 404,
    name: 'Not Found',
    kind: 'client-error',
    summary: 'HTTP 404 Not Found means the server has no resource at this URL, and says nothing about whether it ever existed.',
    meaning:
      'A 404 is the correct answer for unknown URLs and missing records. A helpful 404 page links to the main sections. In a single-page app the page must still send status 404: with SSR, set the status on the response; without SSR, the server sends 200 for every route, which creates soft 404s.',
    causes: [
      'A typo or an old link to a page that moved or was deleted.',
      'A slug that does not match any record in the database.',
      'An SPA route that exists only on the client.',
    ],
    fix: 'Return a real 404 status with a useful page. Use 301 when a page moved, and 410 when it is gone for good. In Angular SSR, set the status through the RESPONSE_INIT token and add a noindex robots tag.',
    express: `// Last middleware: anything no route matched
app.use((req, res) => res.status(404).json({ message: \`No route for \${req.method} \${req.path}\` }));

// Angular SSR component
const init = inject(RESPONSE_INIT, { optional: true });
if (init) init.status = 404;`,
    seo: '404s do not hurt the rest of the site; they are normal. Problems come from soft 404s (error pages sent with 200) and from internal links to missing pages. Fix the links and redirect pages that have a clear replacement.',
    updatedAt: D,
  },
  {
    code: 409,
    name: 'Conflict',
    kind: 'client-error',
    summary: 'HTTP 409 Conflict means the request clashes with the current state of the resource, such as a duplicate or a stale update.',
    meaning:
      'Use 409 when the input is valid but cannot be applied right now: a username that is already taken, or an update based on an old version of the record (optimistic concurrency). The client can usually resolve it and retry.',
    causes: [
      'A unique index violation, for example MongoDB error code 11000 (duplicate key).',
      'A version mismatch when two users edit the same document.',
      'A state-machine rule, such as cancelling an order that already shipped.',
    ],
    fix: 'Map duplicate-key errors to 409 with a clear message, and use a version field (Mongoose optimisticConcurrency or __v) to detect lost updates.',
    express: `try {
  await User.create(req.body);
} catch (err) {
  if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
  throw err;
}`,
    seo: 'No SEO effect: 409 belongs to API writes, not to crawlable pages.',
    updatedAt: D,
  },
  {
    code: 410,
    name: 'Gone',
    kind: 'client-error',
    summary: 'HTTP 410 Gone means the resource existed but was removed on purpose and will not come back.',
    meaning:
      'A 410 is a stronger, more deliberate 404. It tells clients and crawlers to stop asking. Use it for deleted products, retired API versions or spam pages you removed.',
    causes: ['Content was deleted permanently.', 'An old API version was shut down.'],
    fix: 'Return 410 for URLs you know are permanently gone and that have no replacement. If there is a replacement, use 301 to it instead.',
    express: `const removed = new Set(['/blog/old-announcement']);
app.use((req, res, next) => (removed.has(req.path) ? res.status(410).send('Gone') : next()));`,
    seo: 'Google may drop a 410 URL from the index a little faster than a 404. Both are fine for content that is truly gone.',
    updatedAt: D,
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    kind: 'client-error',
    summary: 'HTTP 422 Unprocessable Content means the request was well-formed but its data failed validation.',
    meaning:
      'Where 400 often means "I could not parse this", 422 means "I parsed it, and the values break a rule": an end date before the start date, a price below zero, an email that is valid syntax but not allowed. Many frameworks use 422 for form validation errors.',
    causes: ['Business-rule validation failed.', 'A schema validator rejected field values in valid JSON.'],
    fix: 'Return 422 with a list of field errors the client can show next to each input. Decide whether your API uses 400 or 422 for validation, document it, and use it everywhere.',
    express: `if (req.body.endDate <= req.body.startDate) {
  return res.status(422).json({ errors: { endDate: ['Must be after the start date'] } });
}`,
    seo: 'No SEO effect: it is an API and form response.',
    updatedAt: D,
  },
  {
    code: 429,
    name: 'Too Many Requests',
    kind: 'client-error',
    summary: 'HTTP 429 Too Many Requests means the client hit a rate limit and should wait before trying again.',
    meaning:
      'A 429 protects login forms, contact forms and APIs from abuse and accidental loops. A good 429 includes a Retry-After header (seconds or a date) and RateLimit headers so clients can back off.',
    causes: [
      'express-rate-limit or a gateway limit was exceeded.',
      'A client retrying in a tight loop without backoff.',
      'Many users behind one IP address (offices, mobile carriers).',
    ],
    fix: 'Rate-limit public POST routes, send Retry-After, and retry on the client with exponential backoff. Behind a proxy, set app.set("trust proxy", 1) so limits use the real client IP.',
    express: `import rateLimit from 'express-rate-limit';
app.use('/api/contact', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }));`,
    seo: 'Google slows its crawl when it receives 429 or 503. Short bursts are fine; long periods of 429 on public pages can drop them from the index.',
    updatedAt: D,
  },
  {
    code: 500,
    name: 'Internal Server Error',
    kind: 'server-error',
    summary: 'HTTP 500 Internal Server Error means the server hit an unexpected error and could not complete the request.',
    meaning:
      'A 500 is the generic "something broke on our side" answer, usually an unhandled exception. The client did nothing wrong and cannot fix it. Never send stack traces or database errors in the response body; log them on the server with a request id instead.',
    causes: [
      'An unhandled exception or rejected promise in a route handler.',
      'A database query that throws (bad cast, lost connection).',
      'Code that reads a property of undefined.',
    ],
    fix: 'Add one error-handling middleware that logs the error with a request id and returns a generic message. Map known errors (validation, not found, duplicate) to their own 4xx codes so 500 means a real bug.',
    express: `app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(500).json({ message: 'Something went wrong', requestId: req.id });
});`,
    seo: 'Occasional 500s are retried. Persistent 500s make Google crawl less and eventually drop the affected URLs. Monitor 5xx rates after every deploy.',
    updatedAt: D,
  },
  {
    code: 502,
    name: 'Bad Gateway',
    kind: 'server-error',
    summary: 'HTTP 502 Bad Gateway means a proxy or load balancer got an invalid response, or no response, from the server behind it.',
    meaning:
      'A 502 comes from the layer in front of your app (nginx, Cloudflare, a cloud load balancer), not from your code. The upstream Node process crashed, was restarting, closed the connection early, or is listening on a different port.',
    causes: [
      'The Node.js process crashed or is restarting during a deploy.',
      'nginx proxy_pass points to the wrong port or container name.',
      'Keep-alive mismatch: the app closes idle sockets before the proxy does.',
    ],
    fix: 'Check the app logs and that the process is listening where the proxy expects. Set Node server.keepAliveTimeout higher than the proxy\'s upstream keep-alive, and use rolling or zero-downtime deploys.',
    express: `const server = app.listen(3000);
// Outlive nginx's upstream keep-alive (60 s) so it never reuses a closed socket
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;`,
    seo: 'Same as 500 for crawlers: short spikes are retried, long outages lead to lost rankings.',
    updatedAt: D,
  },
  {
    code: 503,
    name: 'Service Unavailable',
    kind: 'server-error',
    summary: 'HTTP 503 Service Unavailable means the server is temporarily unable to handle the request, for example during maintenance or overload.',
    meaning:
      'A 503 is the honest answer when the app is up but cannot serve right now: a dependency such as the database or an upstream API is down, the server is overloaded, or it is in maintenance. Add Retry-After so clients and crawlers know when to come back.',
    causes: [
      'Planned maintenance.',
      'A required backend or database is unreachable.',
      'A free-tier API that is cold-starting.',
    ],
    fix: 'Return 503 with Retry-After for temporary outages instead of 200 with an error message or a 404. In SSR, set status 503 when the page data could not load, so caches and crawlers do not store the broken page.',
    express: `app.use((req, res, next) => {
  if (!db.isConnected()) return res.status(503).set('Retry-After', '120').json({ message: 'Try again shortly' });
  next();
});`,
    seo: 'Google treats 503 as temporary and keeps the page indexed for a while, which makes it the right code for planned downtime. A 503 lasting more than a few days starts to drop pages.',
    updatedAt: D,
  },
];

export const statusByCode = (code: number): HttpStatus | undefined => HTTP_STATUSES.find((s) => s.code === code);
