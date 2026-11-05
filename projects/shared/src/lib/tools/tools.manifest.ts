/*
 * Single source of truth for the free developer tools.
 * The website (hub, tool layout, routes) reads it directly. The backend keeps a verbatim copy at
 * portfolio-node/src/data/tools.manifest.ts for sitemap.xml, llms.txt and llms-full.txt: copy this file
 * over it whenever it changes. Keep it import-free so the copy works as is.
 */

export type ToolCategory = 'mongodb' | 'typescript' | 'web' | 'seo' | 'utility';

export interface ToolSection {
  heading: string;
  paragraphs: string[];
}

export interface ToolMeta {
  slug: string;
  name: string;
  h1: string;
  /** <= 60 characters. */
  title: string;
  /** <= 155 characters. */
  description: string;
  /** The search this page targets. */
  keyword: string;
  category: ToolCategory;
  /** Slugs of related tools (internal links). Unknown slugs are ignored. */
  related: string[];
  /** Short worked example shown under the tool. */
  example: { input: string; output: string };
  /** 300+ words of explanation across all sections. */
  sections: ToolSection[];
  faq: { q: string; a: string }[];
  /** ISO date; used as sitemap lastmod. */
  updatedAt: string;
}

export const TOOLS_PATH = '/tools';

export const TOOLS_HUB = {
  title: 'Free Developer Tools for MEAN Stack | Asif Dev',
  description:
    'Free, browser-only developer tools: MongoDB ObjectId to date, JWT decoder, JSON to TypeScript and more. Nothing is uploaded.',
  h1: 'Free developer tools',
  intro:
    'Small, single-purpose tools for Angular, Node.js and MongoDB work. Every tool runs in your browser, so nothing you paste is uploaded.',
  updatedAt: '2026-11-05',
} as const;

export const TOOLS: ToolMeta[] = [
  {
    slug: 'objectid-to-date',
    name: 'ObjectId to Date',
    h1: 'MongoDB ObjectId to Timestamp Converter',
    title: 'MongoDB ObjectId to Date Converter | Asif Dev',
    description:
      'Decode a MongoDB ObjectId to its creation date, or turn a date into an ObjectId for _id range queries. Free and runs in your browser.',
    keyword: 'mongodb objectid to timestamp',
    category: 'mongodb',
    related: ['json-to-mongoose-schema', 'json-to-typescript', 'cron-expression-explainer'],
    example: {
      input: '507f1f77bcf86cd799439011',
      output: '2012-10-17T21:13:27.000Z  (Unix seconds 1350508407)',
    },
    sections: [
      {
        heading: 'How an ObjectId stores its date',
        paragraphs: [
          'A MongoDB ObjectId is 12 bytes, shown as 24 hexadecimal characters. The first 4 bytes are a big-endian Unix timestamp in seconds. The next 5 bytes are a random value generated once per process, and the last 3 bytes are an incrementing counter that starts at a random number.',
          'Because the timestamp comes first, ObjectIds sort roughly by creation time, and you can read the creation date of any document straight from its _id without a separate createdAt field. This tool takes the first 8 hex characters, converts them to a number and shows the matching date in UTC and in your local time zone.',
        ],
      },
      {
        heading: 'Date to ObjectId for range queries',
        paragraphs: [
          'To find every document created after a given moment, build an ObjectId from that date with the remaining 8 bytes set to zero, then query with $gte on _id. This uses the default _id index, so it is fast and needs no extra index on createdAt.',
          'In the shell that looks like db.orders.find({ _id: { $gte: ObjectId("6540a0800000000000000000") } }). In Mongoose you can pass a string and it is cast to an ObjectId for you. The date mode here produces that boundary ObjectId so you do not have to compute the hex by hand.',
        ],
      },
      {
        heading: 'Limits to keep in mind',
        paragraphs: [
          'The timestamp has one-second resolution, and it records when the ObjectId was generated, which is normally the client or driver, not the database server. Documents inserted with a custom _id, or imported from another system, may carry no useful date at all. If the creation time matters to your business logic, store an explicit createdAt field and use the ObjectId date only as a quick forensic tool.',
          'In Node.js you can do the same conversion in code: new Types.ObjectId(id).getTimestamp() in Mongoose returns a Date, and Types.ObjectId.createFromTime(seconds) builds the boundary id for a range query. This page is handy when you are reading logs, support tickets or a database dump and just need the date of one id without opening a shell.',
        ],
      },
    ],
    faq: [
      {
        q: 'How is the date stored in a MongoDB ObjectId?',
        a: 'The first 4 bytes of the 12-byte ObjectId are a Unix timestamp in seconds, big-endian. That is the first 8 hex characters of the 24-character string.',
      },
      {
        q: 'Can I query documents by creation date using only _id?',
        a: 'Yes. Generate an ObjectId from the start date (the other 8 bytes zero) and query with $gte or $lt on _id. It uses the built-in _id index.',
      },
      {
        q: 'Is the ObjectId date always the insert time?',
        a: 'Not always. It is when the id was generated, usually on the driver side, and it has one-second resolution. Custom or imported _id values may have no meaningful date.',
      },
      {
        q: 'Is my data sent anywhere?',
        a: 'No. The conversion runs entirely in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'jwt-decoder',
    name: 'JWT Decoder',
    h1: 'JWT Decoder: Read a JSON Web Token Online',
    title: 'JWT Decoder: Inspect Header and Claims | Asif Dev',
    description:
      'Decode a JSON Web Token in your browser: see the header, payload and exp/iat as readable dates. Decoding only, nothing is uploaded.',
    keyword: 'jwt decoder',
    category: 'web',
    related: ['http-status-codes', 'json-to-typescript', 'objectid-to-date'],
    example: {
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDAwMDAwMDB9.signature',
      output: 'header: { "alg": "HS256", "typ": "JWT" }   payload: { "sub": "123", "role": "admin", "iat": 1700000000 }',
    },
    sections: [
      {
        heading: 'What is inside a JWT',
        paragraphs: [
          'A JSON Web Token is three base64url-encoded parts joined by dots: header.payload.signature. The header names the signing algorithm (for example HS256 or RS256) and the token type. The payload carries the claims, such as sub (subject), iat (issued at), exp (expiry) and any custom fields like a role. The signature lets the server check that the first two parts were not changed.',
          'Base64url is an encoding, not encryption. Anyone holding the token can read the header and payload, which is exactly what this tool does. Never put passwords or other secrets in a JWT payload.',
        ],
      },
      {
        heading: 'Decoding is not verifying',
        paragraphs: [
          'This page decodes the token so you can debug it. It does not check the signature, because that needs the secret or public key, and you should never paste a production secret into any website. A decoded token that looks fine may still be forged or expired. Your API must verify the signature, the algorithm, exp, and the issuer and audience on every request.',
          'Do not paste live production tokens into online tools, including this one. The decoding happens in your browser and nothing is sent, but a token is a bearer credential, so use short-lived test tokens when you can.',
        ],
      },
      {
        heading: 'Common claims to check when debugging',
        paragraphs: [
          'When a request fails with 401, look at exp first: it is a Unix time in seconds, and this tool shows it as a date and tells you whether it has passed. Then check iat and nbf for clock skew between servers, aud and iss for the wrong environment, and the alg header for a mismatch with what your server accepts. Short access tokens paired with a refresh token, plus role checks on the server, are the usual pattern in Express and Angular apps.',
          'In Express, verify with jsonwebtoken and pin the algorithm: jwt.verify(token, secret, { algorithms: ["HS256"] }). Leaving the algorithm open has caused real vulnerabilities, such as tokens signed with "none" being accepted.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does this tool verify the JWT signature?',
        a: 'No. It only decodes the header and payload. Verifying needs the secret or public key, and that must happen on your server.',
      },
      {
        q: 'Is it safe to paste my token here?',
        a: 'The decoding runs in your browser and nothing is uploaded. Still, a token is a credential, so prefer test or expired tokens and never paste production secrets.',
      },
      {
        q: 'What do exp, iat and nbf mean?',
        a: 'exp is when the token expires, iat when it was issued and nbf the earliest time it is valid. All are Unix timestamps in seconds.',
      },
      {
        q: 'Is a JWT payload encrypted?',
        a: 'No. It is base64url-encoded, so anyone with the token can read it. Use JWE if you need encryption.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-to-typescript',
    name: 'JSON to TypeScript',
    h1: 'JSON to TypeScript Interface Generator',
    title: 'JSON to TypeScript Interface Generator | Asif Dev',
    description:
      'Paste JSON and get TypeScript interfaces or types with nested objects, arrays and optional fields. Free, fast and runs in your browser.',
    keyword: 'json to typescript interface',
    category: 'typescript',
    related: ['json-to-mongoose-schema', 'jwt-decoder', 'objectid-to-date'],
    example: {
      input: '{"id": 1, "name": "Asif", "tags": ["node"], "address": {"city": "Lahore"}}',
      output:
        'export interface Root {\n  id: number;\n  name: string;\n  tags: string[];\n  address: Address;\n}\n\nexport interface Address {\n  city: string;\n}',
    },
    sections: [
      {
        heading: 'What this generator does',
        paragraphs: [
          'Paste a JSON document, such as an API response, and the tool infers a TypeScript type for it. Nested objects become their own named interfaces, arrays become typed arrays, and values that are null or missing in some array items become optional or union types. You can switch between interface and type alias output and set the name of the root type.',
          'The result is a starting point that saves typing when you wire a new endpoint into an Angular service or an Express handler. It describes the sample you pasted, so review it before committing.',
        ],
      },
      {
        heading: 'How types are inferred',
        paragraphs: [
          'Strings, numbers and booleans map directly. null becomes null. For arrays, every item is merged into one shape: a key that appears in only some objects becomes optional (name?: string), and different primitive types become a union such as string | number. An empty array becomes unknown[] because there is nothing to infer from. Object keys that are not valid identifiers, such as "first-name", are quoted.',
          'Nested objects are named after their key in PascalCase, so an "address" field produces an Address interface and an array called "items" produces an Item type for its elements. When two different objects would get the same name, a number is added (Address2) so nothing is silently overwritten. Rename them afterwards to match your domain language; the structure is what matters.',
        ],
      },
      {
        heading: 'Why a sample is not a contract',
        paragraphs: [
          'A single response cannot show every shape an API may return: a field that was always present in your sample may be absent in production, and a number may sometimes be a string. For data that crosses a trust boundary, pair the generated type with runtime validation, for example a Zod schema in your Express API, so the TypeScript type and the real data cannot drift apart. Use this tool to get the first draft quickly, then tighten it.',
        ],
      },
    ],
    faq: [
      {
        q: 'How does it decide a field is optional?',
        a: 'When you paste an array of objects, a key that is missing from some items is marked optional with a question mark.',
      },
      {
        q: 'Should I use interface or type?',
        a: 'Both work for object shapes. Interfaces can be extended and merged; type aliases can also express unions. The tool lets you pick either.',
      },
      {
        q: 'Can I trust the generated types for API data?',
        a: 'Treat them as a draft from one sample. Validate untrusted data at runtime, for example with Zod, so the types match what the API really sends.',
      },
      {
        q: 'Is my JSON uploaded?',
        a: 'No. Everything runs in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-to-mongoose-schema',
    name: 'JSON to Mongoose Schema',
    h1: 'JSON to Mongoose Schema Generator',
    title: 'JSON to Mongoose Schema Generator | Asif Dev',
    description:
      'Paste a JSON document and get a Mongoose schema and model: types, nested sub-schemas, arrays, dates and ObjectId refs. Runs in your browser.',
    keyword: 'json to mongoose schema',
    category: 'mongodb',
    related: ['objectid-to-date', 'json-to-typescript', 'http-status-codes'],
    example: {
      input: '{"name": "Asif", "email": "a@b.com", "createdAt": "2026-01-01T00:00:00Z", "tags": ["node"], "address": {"city": "Pakpattan"}}',
      output:
        "const addressSchema = new Schema({\n  city: { type: String, required: true },\n}, { _id: false });\n\nconst userSchema = new Schema({\n  name: { type: String, required: true },\n  email: { type: String, required: true },\n  tags: { type: [String], default: [] },\n  address: { type: addressSchema, required: true },\n}, { timestamps: true });",
    },
    sections: [
      {
        heading: 'What the generator produces',
        paragraphs: [
          'Paste one document, or an array of documents, from an API response, a mongosh find() or a fixture file. The tool infers a Mongoose schema: strings, numbers and booleans map to String, Number and Boolean; ISO date strings become Date; 24-character hex strings become Schema.Types.ObjectId; nested objects become their own sub-schemas with _id disabled; arrays become typed arrays with an empty default.',
          'You choose the model name, whether fields are marked required, and whether to use the timestamps option. With timestamps on, createdAt and updatedAt are left out of the field list because Mongoose manages them for you. _id and __v are always skipped.',
        ],
      },
      {
        heading: 'Required fields and arrays of documents',
        paragraphs: [
          'When you paste an array, every item is merged into one shape. A key that is missing from some items is not marked required, because the sample shows it is optional in real data. A key that is null in every sample becomes Schema.Types.Mixed, since there is no type to infer. Review those fields by hand: Mixed turns off casting and change tracking for that path, so call markModified() after changing it, or give it a real type.',
          'Arrays of objects become arrays of a sub-schema, for example items: { type: [itemSchema], default: [] }. Mongoose then validates and casts every element, and the default empty array means new documents never need a null check before push().',
        ],
      },
      {
        heading: 'From draft to production schema',
        paragraphs: [
          'A schema inferred from samples is a draft. Before shipping it, add what a sample cannot show: unique indexes for emails and slugs, enum lists for status fields, min and max for numbers, ref names on ObjectId fields so populate() works, and compound indexes that match your real queries. Enable strict query mode and validate request bodies at the API edge (for example with Zod) so the database never sees unexpected fields. The generator saves the typing; the constraints are still your design decision.',
        ],
      },
    ],
    faq: [
      {
        q: 'How does it detect Date and ObjectId fields?',
        a: 'Strings in ISO 8601 date format become Date, and 24-character hexadecimal strings become Schema.Types.ObjectId. Everything else that is text stays String.',
      },
      {
        q: 'Why are nested objects separate schemas?',
        a: 'Sub-schemas keep the model readable and let you reuse them. They are created with { _id: false } so embedded objects do not get their own ids unless you want them.',
      },
      {
        q: 'Does it add indexes?',
        a: 'No. Indexes depend on your queries, so add unique, compound and text indexes yourself after reviewing the draft.',
      },
      {
        q: 'Is my data uploaded?',
        a: 'No. The schema is generated in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'cron-expression-explainer',
    name: 'Cron Expression Explainer',
    h1: 'Cron Expression Explainer and Next Run Times',
    title: 'Cron Expression Explained in Plain English | Asif Dev',
    description:
      'Paste a cron expression to see what it means in plain English and the next 5 times it runs in your time zone. Free and runs in your browser.',
    keyword: 'cron expression explained',
    category: 'utility',
    related: ['objectid-to-date', 'jwt-decoder', 'http-status-codes'],
    example: {
      input: '*/15 9-17 * * 1-5',
      output: 'Every 15 minutes, between 09:00 and 17:59, on Monday through Friday.',
    },
    sections: [
      {
        heading: 'The five cron fields',
        paragraphs: [
          'A standard cron expression has five fields separated by spaces: minute (0-59), hour (0-23), day of month (1-31), month (1-12 or JAN-DEC) and day of week (0-6 or SUN-SAT, where 0 and 7 are Sunday). An asterisk means every value. A list such as 1,15 picks specific values, a range such as 9-17 picks everything in between, and a step such as */15 or 0-30/10 picks every nth value.',
          'This tool also accepts the common macros @yearly, @monthly, @weekly, @daily and @hourly, and turns each expression into a sentence plus the next five run times in your browser\'s local time zone.',
        ],
      },
      {
        heading: 'Day of month and day of week together',
        paragraphs: [
          'The rule that surprises most people: when both day of month and day of week are restricted, classic cron runs when either one matches, not both. So 0 9 1 * 1 runs at 09:00 on the 1st of every month and also on every Monday. If you need "the first Monday of the month", schedule every Monday and check the date inside the job.',
          'Two more traps: day 31 only exists in seven months, so 0 0 31 * * skips the rest, and 0 0 30 2 * never runs at all. For "last day of the month", run daily and check whether tomorrow is the 1st.',
        ],
      },
      {
        heading: 'Time zones and Node.js schedulers',
        paragraphs: [
          'Cron runs in the time zone of the machine or container that executes it, and servers and Docker images usually run in UTC. A job written as 0 9 * * * on a UTC server runs at 14:00 in Pakistan. Libraries such as node-cron and croner accept a timezone option, and hosted schedulers usually let you set one too. Also plan for overlap and failure: if a job can take longer than its interval, add a lock so two runs do not process the same data, and log every run so a silent failure shows up.',
        ],
      },
    ],
    faq: [
      {
        q: 'What does */5 mean in cron?',
        a: 'Every 5th value of that field. In the minute field, */5 runs at minutes 0, 5, 10 and so on.',
      },
      {
        q: 'Is Sunday 0 or 7?',
        a: 'Both. Most cron implementations accept 0 and 7 for Sunday; this tool does too.',
      },
      {
        q: 'Does it support seconds?',
        a: 'No. It explains the standard five-field format. Six-field formats with seconds (used by some Node.js libraries) are not supported.',
      },
      {
        q: 'Which time zone are the next runs shown in?',
        a: 'Your browser\'s local time zone. Your server may use a different one, often UTC.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'http-status-codes',
    name: 'HTTP Status Codes',
    h1: 'HTTP Status Codes: Meaning, Causes and Fixes',
    title: 'HTTP Status Codes Explained with Fixes | Asif Dev',
    description:
      'Every common HTTP status code explained: what 200, 301, 404, 429, 500 and 503 mean, why they happen, Express fixes and the SEO impact.',
    keyword: 'http status codes',
    category: 'web',
    related: ['jwt-decoder', 'cron-expression-explainer', 'json-to-mongoose-schema'],
    example: {
      input: '404',
      output: 'Not Found: the server has no resource at this URL. Return a real 404 status with a helpful page, 301 if it moved.',
    },
    sections: [
      {
        heading: 'How status codes are grouped',
        paragraphs: [
          'The first digit tells you who is responsible. 2xx means success. 3xx means the client must go somewhere else, either a new URL or its own cache. 4xx means the request was wrong: bad input, missing login, no permission, or nothing at that URL. 5xx means the server failed, so the client did nothing wrong and may retry later.',
          'Each code above links to its own page with the meaning, the usual causes, an Express example and what it does to search rankings.',
        ],
      },
      {
        heading: 'Why the right code matters',
        paragraphs: [
          'Clients, caches, monitoring and search engines all read the status line before the body. An API that returns 200 with an error message breaks retries and alerts. A website that sends its "page not found" screen with 200 creates soft 404s in Search Console. A maintenance page sent as 404 instead of 503 can drop pages out of the index. Choosing the precise code is cheap and makes every layer behave correctly.',
          'Monitoring depends on it too. Error-rate alerts, uptime checks and APM dashboards group requests by status class, so a bug hidden behind 200 never pages anyone, and a flood of 4xx from one client stays separate from real 5xx outages on your side. Retry logic reads it as well: clients should retry 429, 502, 503 and 504 with backoff, and never blindly retry a 400 or 409.',
        ],
      },
      {
        heading: 'Status codes in Angular SSR and Express',
        paragraphs: [
          'In Express, set the code with res.status() before sending, and finish with a catch-all 404 middleware and one error handler that maps known errors to 4xx and everything else to 500. In Angular with server-side rendering, inject the RESPONSE_INIT token in the page component and set its status to 404 or 503 when the data is missing or the API is down, and add a noindex robots tag to error pages. Without SSR, every route answers 200 from the server, which is the most common source of soft 404s on single-page apps.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between 401 and 403?',
        a: '401 means you are not authenticated (no or invalid credentials). 403 means you are authenticated, or it does not matter, and you are still not allowed.',
      },
      {
        q: 'Should I use 301 or 302 for a moved page?',
        a: 'Use 301 (or 308) for permanent moves so rankings transfer. Use 302 (or 307) only for temporary redirects.',
      },
      {
        q: 'Do 404 errors hurt SEO?',
        a: 'Real 404s for pages that do not exist are normal and do not hurt the rest of the site. Soft 404s and broken internal links are the problems to fix.',
      },
      {
        q: 'Which code should a maintenance page use?',
        a: '503 Service Unavailable with a Retry-After header. Search engines treat it as temporary.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'video-to-audio',
    name: 'Video to Audio Converter',
    h1: 'Video to Audio Converter (Extract Audio in Your Browser)',
    title: 'Video to Audio Converter: Extract WAV Free | Asif Dev',
    description:
      'Extract the audio track from an MP4, WebM or MOV file and save it as WAV, right in your browser. No upload, no sign-up, no watermark.',
    keyword: 'video to audio converter',
    category: 'utility',
    related: ['base64-encoder', 'json-formatter', 'uuid-generator'],
    example: {
      input: 'interview.mp4 (12 min, stereo, 48 kHz)',
      output: 'interview.wav: mono, 22.05 kHz, 16-bit PCM, about 32 MB',
    },
    sections: [
      {
        heading: 'How the conversion works',
        paragraphs: [
          'Choose a video file and the browser decodes its audio track with the Web Audio API, the same decoder it uses to play the video. The decoded samples are optionally mixed down to mono and resampled, then written into a standard WAV file (16-bit PCM) that every editor, player and transcription service can open. The file never leaves your device: there is no upload, so there is no queue, no size limit set by a server and no copy of your recording on someone else\'s disk.',
          'Before decoding, the tool reads the file\'s structure to find out whether it has an audio track at all. Many stock-footage downloads and screen recordings are silent, and for those the tool says so at once instead of failing. If the browser\'s fast decoder cannot read a file that does have sound, the tool tries a second decoder (WebCodecs, where your browser offers it) and, as a last resort, plays the file silently and records it in real time. That last method takes as long as the clip and is labelled as such. MP4 or MOV with AAC audio and WebM with Opus or Vorbis work in all current desktop browsers.',
        ],
      },
      {
        heading: 'Choosing quality and size',
        paragraphs: [
          'WAV is uncompressed, so size grows with length, channels and sample rate. Stereo at 44.1 kHz is about 10 MB per minute; mono at 22.05 kHz is about 2.6 MB per minute and still clear for speech. For podcasts, interviews, lectures and transcription, mono at 22.05 or 16 kHz is plenty. For music, keep stereo at 44.1 or 48 kHz.',
          'Because the whole track is decoded in memory, very long videos need a lot of RAM. A one-hour stereo recording decodes to roughly 1.3 GB of samples, so on phones keep files under about 30 minutes, or trim the video first.',
        ],
      },
      {
        heading: 'Common uses',
        paragraphs: [
          'Pull the audio out of a screen recording or a Zoom export to send to a transcription service, turn a lecture video into something you can listen to offline, prepare a voice-over for editing, or check what a video\'s audio track actually contains. Only convert files you own or have permission to use.',
          'If the tool tells you the sound is stored in a format your browser cannot read (for example Dolby Digital in an MKV, or an old AVI), open the page in another browser such as Safari or Edge, or re-export the file as MP4 with AAC audio from your editor or phone and choose it again. If it says the video has no audio track, the file really contains only pictures and there is nothing to extract.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my video uploaded?',
        a: 'No. Reading, decoding and encoding all run in your browser (Web Audio, with WebCodecs as a backup). Nothing is sent to a server.',
      },
      {
        q: 'Why WAV and not MP3?',
        a: 'WAV can be written without any codec library, works everywhere and loses no quality. If you need a smaller file, convert the WAV to MP3 or AAC in your audio editor.',
      },
      {
        q: 'Which video formats are supported?',
        a: 'Whatever your browser can decode: MP4 and MOV with AAC audio, WebM with Opus or Vorbis, and audio files such as M4A, MP3, WAV, OGG and FLAC. If the sound is in a format your browser cannot read, the tool names the format instead of failing silently.',
      },
      {
        q: 'Why does it say my video has no audio track?',
        a: 'Because the file contains only video. Clips downloaded from stock-footage sites and many screen recordings are saved without sound. Play the file: if you hear nothing, there is nothing to extract.',
      },
      {
        q: 'Can I extract audio from a YouTube link?',
        a: 'No. Downloading from YouTube breaks its terms of service. Use a file you recorded or have the rights to.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'regex-tester',
    name: 'Regex Tester',
    h1: 'JavaScript Regex Tester with Live Matches and Groups',
    title: 'JavaScript Regex Tester: Matches and Groups | Asif Dev',
    description:
      'Test JavaScript regular expressions live: highlighted matches, numbered and named capture groups, flags and replace preview. Runs in your browser.',
    keyword: 'regex tester javascript',
    category: 'utility',
    related: ['json-formatter', 'base64-encoder', 'cron-expression-explainer'],
    example: {
      input: 'Pattern (?<user>[\\w.]+)@(?<domain>[\\w.]+)  flags g  on "mail asif@example.com or info@asifdev.com"',
      output: '2 matches: asif@example.com (user=asif, domain=example.com), info@asifdev.com (user=info, domain=asifdev.com)',
    },
    sections: [
      {
        heading: 'Same engine as your code',
        paragraphs: [
          'This tester uses your browser\'s own JavaScript RegExp engine, which is the same engine family Node.js uses (V8 in Chrome and Node). That means the results match what new RegExp(pattern, flags) does in an Angular app or an Express handler, including named groups, lookbehind, Unicode property escapes with the u flag and the v flag where your browser supports it. Testers built for PCRE or Python can disagree on these details.',
          'Every match is highlighted in the text, and the table lists each match with its index and capture groups, numbered and named. The replace box shows the result of String.prototype.replace with your replacement, including $1 and $<name> references.',
        ],
      },
      {
        heading: 'Flags in one line each',
        paragraphs: [
          'g finds every match instead of the first. i ignores case. m makes ^ and $ match at line breaks. s lets the dot match newlines. u enables full Unicode, so \\p{L} and astral characters work. y (sticky) matches only at lastIndex. d adds match indices. Without g, only the first match is shown, exactly as in your code.',
          'A frequent surprise: a RegExp object with the g or y flag remembers lastIndex between calls, so calling re.test() twice on the same string can return true and then false. Create the RegExp inside the function, or reset lastIndex to 0, when you reuse a global pattern for validation in Angular form validators or Express middleware.',
        ],
      },
      {
        heading: 'Avoiding catastrophic backtracking',
        paragraphs: [
          'Patterns such as (a+)+$ can take exponential time on inputs that almost match. In a Node.js server that blocks the event loop for every request, which is a real denial-of-service risk (ReDoS) when the pattern or input comes from users. This tool runs each test in a separate worker and stops it after one second, so a bad pattern cannot freeze the page, and tells you when that happened. In production, avoid nested quantifiers, cap input length before matching, and validate structured input with a parser or a schema library instead of one giant expression.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is this regex tester JavaScript-compatible?',
        a: 'Yes. It runs the browser\'s native RegExp engine, so results match JavaScript and Node.js.',
      },
      {
        q: 'How do I use named groups?',
        a: 'Write (?<name>...) in the pattern; the match table shows each group by name, and $<name> works in the replacement.',
      },
      {
        q: 'Why does my pattern time out?',
        a: 'It probably backtracks catastrophically, usually because of nested quantifiers like (a+)+. Make the quantified parts mutually exclusive or limit the input.',
      },
      {
        q: 'Is my text sent anywhere?',
        a: 'No. Matching runs in a worker in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'epoch-converter',
    name: 'Unix Timestamp Converter',
    h1: 'Unix Timestamp (Epoch) Converter',
    title: 'Unix Timestamp Converter: Epoch to Date | Asif Dev',
    description:
      'Convert Unix timestamps in seconds or milliseconds to readable dates in UTC and your time zone, and dates back to epoch time. Free, runs locally.',
    keyword: 'unix timestamp converter',
    category: 'utility',
    related: ['objectid-to-date', 'cron-expression-explainer', 'jwt-decoder'],
    example: {
      input: '1767225600',
      output: '2026-01-01T00:00:00.000Z (seconds), 1767225600000 ms',
    },
    sections: [
      {
        heading: 'Seconds or milliseconds?',
        paragraphs: [
          'A Unix timestamp counts time since 1 January 1970 00:00:00 UTC. Unix tools, JWT claims (exp, iat), most databases and many APIs use seconds; JavaScript\'s Date.now(), Java and many logging systems use milliseconds. The converter detects which one you pasted from its size (a 13-digit number is milliseconds) and shows both, so you can copy the form your code expects.',
          'Output is shown in UTC as ISO 8601, in your browser\'s local time zone, and as a relative time such as "3 days ago". Paste a date the other way round (ISO 8601 or a plain date) to get its timestamp in seconds and milliseconds.',
        ],
      },
      {
        heading: 'Time zones and common bugs',
        paragraphs: [
          'A timestamp has no time zone: it is the same instant everywhere. Bugs appear when it is formatted: new Date("2026-01-01") is parsed as UTC midnight, but new Date("2026-01-01T00:00") is parsed as local midnight, which is a different instant outside UTC. Store and send instants as UTC timestamps or ISO strings with Z, and convert to local time only for display.',
          'The classic off-by-1000 bug is mixing units: passing seconds to new Date() gives a date in January 1970, and passing milliseconds where seconds are expected gives a date tens of thousands of years in the future. If a JWT seems to never expire or a cache entry expires instantly, check the unit first.',
        ],
      },
      {
        heading: 'The year 2038 problem',
        paragraphs: [
          'Systems that store seconds in a signed 32-bit integer overflow on 19 January 2038 at 03:14:07 UTC. JavaScript numbers and 64-bit integers are safe for millions of years, but older C code, some embedded devices and MySQL TIMESTAMP columns are not, so prefer 64-bit types or DATETIME when you design a schema today.',
          'MongoDB stores dates as 64-bit milliseconds since the epoch, so a Date field in Mongoose is already a timestamp under the hood and is safe well beyond 2038. When you need the creation time of a document without a createdAt field, its ObjectId also carries a timestamp in seconds.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I get the current Unix timestamp in JavaScript?',
        a: 'Math.floor(Date.now() / 1000) gives seconds; Date.now() gives milliseconds.',
      },
      {
        q: 'How does the tool know seconds from milliseconds?',
        a: 'Numbers with 13 or more digits are treated as milliseconds and shorter ones as seconds. Both forms are shown either way.',
      },
      {
        q: 'Does a timestamp include a time zone?',
        a: 'No. It is an absolute instant; time zones only matter when you format it for display.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'base64-encoder',
    name: 'Base64 Encoder and Decoder',
    h1: 'Base64 Encode and Decode (Text and Files)',
    title: 'Base64 Encode and Decode Online, UTF-8 Safe | Asif Dev',
    description:
      'Encode text or files to Base64 and decode Base64 back to text, with UTF-8 and URL-safe Base64url support. Runs entirely in your browser.',
    keyword: 'base64 encode decode',
    category: 'utility',
    related: ['jwt-decoder', 'json-formatter', 'video-to-audio'],
    example: {
      input: 'Héllo, Pakistan 👋',
      output: 'SMOpbGxvLCBQYWtpc3RhbiDwn5GL',
    },
    sections: [
      {
        heading: 'What Base64 is for',
        paragraphs: [
          'Base64 turns any bytes into 64 safe ASCII characters so binary data can travel through systems built for text: data: URLs, JSON payloads, email attachments, HTTP Basic auth headers and JWT segments. It is an encoding, not encryption: anyone can decode it, so never use it to hide secrets.',
          'Encoded output is about 33% larger than the input, because every 3 bytes become 4 characters. That is why embedding large images as data URLs makes pages heavier; it only pays off for very small icons.',
        ],
      },
      {
        heading: 'UTF-8 and the btoa trap',
        paragraphs: [
          'The browser\'s built-in btoa() only accepts characters up to code point 255, so btoa("é") works but btoa("👋") throws. This tool first encodes text as UTF-8 bytes with TextEncoder and then Base64-encodes the bytes, and decodes the reverse way with TextDecoder, so accents, Urdu, Arabic and emoji round-trip correctly. In Node.js the equivalent is Buffer.from(text, "utf8").toString("base64").',
          'Decoding has the opposite trap: atob() returns a "binary string" with one character per byte, so atob() on Base64 of "é" gives two odd characters instead of one letter. Converting those bytes with TextDecoder fixes it, and the decoder here reports clearly when the bytes are not text at all, for example when the Base64 is really an image or a PDF. Newer browsers also offer Uint8Array.fromBase64() and toBase64(), which do the byte conversion for you.',
        ],
      },
      {
        heading: 'Base64url and files',
        paragraphs: [
          'Base64url replaces + and / with - and _ and usually drops the = padding, so the result is safe in URLs and file names. JWTs use it, which is why a JWT cannot be decoded with a plain atob() call without converting it first. Switch the URL-safe option on to produce or read that variant.',
          'You can also pick a file to get its Base64 or a ready-made data: URL, for example to inline a small SVG in CSS or to send a file inside a JSON API request during testing. The file is read locally with the FileReader API and never uploaded.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is Base64 encryption?',
        a: 'No. It is a reversible encoding anyone can decode. Use real encryption for secrets.',
      },
      {
        q: 'Why does btoa fail with emoji?',
        a: 'btoa only accepts Latin-1 characters. Encode the text to UTF-8 bytes first, as this tool does.',
      },
      {
        q: 'What is Base64url?',
        a: 'A URL-safe variant that uses - and _ instead of + and / and often omits padding. JWTs use it.',
      },
      {
        q: 'Are my files uploaded?',
        a: 'No. Files are read in your browser with the FileReader API.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'uuid-generator',
    name: 'UUID Generator',
    h1: 'UUID Generator: v4 and v7, Single or Bulk',
    title: 'UUID Generator v4 and v7, Bulk and Free | Asif Dev',
    description:
      'Generate random UUID v4 or time-ordered UUID v7 values, one or up to 1,000 at a time, and inspect any UUID. Uses your browser\'s secure random generator.',
    keyword: 'uuid generator',
    category: 'utility',
    related: ['objectid-to-date', 'epoch-converter', 'base64-encoder'],
    example: {
      input: 'Version 7, count 2',
      output: '01a1ab26-a900-7c1e-9a3d-5f0e8b1c2d3e\n01a1ab26-a900-7c1f-8e61-0c4a9d7b6e15  (both created 2026-11-05T10:00:00Z)',
    },
    sections: [
      {
        heading: 'v4 or v7?',
        paragraphs: [
          'A UUID v4 is 122 random bits: unpredictable and fine as a public identifier, but random values scatter across a database index, which slows inserts on large B-tree indexes. UUID v7, standardised in RFC 9562 (2024), puts a 48-bit Unix timestamp in milliseconds first and fills the rest with random bits. New values sort roughly by creation time, so they insert at the end of an index like an auto-increment key while staying globally unique without coordination.',
          'Use v7 for primary keys in PostgreSQL or MySQL and for event or log ids you want to sort by time. Use v4 when the id must not reveal when it was created, for example in password-reset links, because a v7 id exposes its creation time to anyone who reads it.',
        ],
      },
      {
        heading: 'How the values are generated',
        paragraphs: [
          'v4 values come from crypto.randomUUID(), and v7 values are built from Date.now() plus crypto.getRandomValues(), both backed by the browser\'s cryptographically secure generator. Nothing is generated on a server and nothing is logged. Values created in the same millisecond keep their order by incrementing a counter in the random part, as RFC 9562 allows.',
          'Never build ids with Math.random(): it is not cryptographically secure, and values can repeat or be predicted. In databases, store UUIDs in a native uuid column (PostgreSQL) or as 16 bytes (BINARY(16) in MySQL) rather than a 36-character string; it halves the index size and keeps comparisons fast.',
        ],
      },
      {
        heading: 'UUIDs versus MongoDB ObjectIds',
        paragraphs: [
          'MongoDB\'s ObjectId is a 12-byte id that also starts with a timestamp, in seconds, which is why ObjectIds sort by creation time too. Inside MongoDB, ObjectId is the natural choice and is smaller than a UUID. Use UUIDs when ids must be created by clients or other systems before they reach the database, or when they must be unique across several databases. The inspector here reads the version and, for v7, the embedded creation time of any UUID you paste.',
        ],
      },
    ],
    faq: [
      {
        q: 'Are these UUIDs truly unique?',
        a: 'For practical purposes, yes. v4 has 122 random bits; the chance of a collision is negligible even across billions of values.',
      },
      {
        q: 'Is UUID v7 safe to expose publicly?',
        a: 'It is unguessable enough for ids, but it reveals its creation time. Use v4 when that time is sensitive.',
      },
      {
        q: 'How do I generate a UUID in Node.js?',
        a: 'crypto.randomUUID() in Node 14.17+ gives a v4. For v7, use the uuid package (v7()) or a small helper like the one this tool uses.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-formatter',
    name: 'JSON Formatter and Validator',
    h1: 'JSON Formatter, Validator and Minifier',
    title: 'JSON Formatter and Validator with Line Errors | Asif Dev',
    description:
      'Format, validate and minify JSON in your browser. Errors point to the exact line and column, and keys can be sorted. Nothing is uploaded.',
    keyword: 'json formatter validator',
    category: 'utility',
    related: ['json-to-typescript', 'json-to-mongoose-schema', 'base64-encoder'],
    example: {
      input: '{"name":"Asif","skills":["angular","node"],}',
      output: 'Invalid JSON at line 1, column 44: trailing comma before }',
    },
    sections: [
      {
        heading: 'Format, minify, validate',
        paragraphs: [
          'Paste JSON and the tool parses it with the browser\'s JSON.parse, the same parser your JavaScript code uses, so "valid here" means valid in your app. Valid input is pretty-printed with 2 or 4 spaces or a tab, or minified to one line for payloads and environment variables. You can sort object keys alphabetically to make two documents easy to diff.',
          'When the input is invalid, the error is translated into a line and column with the offending line shown, which is much faster than counting characters in a 2,000-line API response.',
        ],
      },
      {
        heading: 'The errors you will meet most',
        paragraphs: [
          'Trailing commas after the last item, single quotes instead of double quotes, unquoted keys, comments, and NaN or undefined values are all valid in JavaScript object literals but invalid in JSON. Copying an object from code or a config file is the usual way they sneak in. Another frequent one is a BOM or invisible character at the start of a file saved by a Windows editor; the tool reports it at line 1, column 1.',
          'Large integers are a quieter problem: JSON allows any number, but JavaScript stores numbers as 64-bit floats, so ids above 9,007,199,254,740,991 lose precision when parsed. If an API returns big ids, ask for them as strings.',
        ],
      },
      {
        heading: 'From valid JSON to types',
        paragraphs: [
          'Once the JSON is valid, you can turn it into TypeScript interfaces or a Mongoose schema with the related tools below, which reuse the same parsing. For APIs you own, validate request bodies at runtime as well, because a document that is valid JSON can still have the wrong shape.',
          'Minified JSON is what you want on the wire, and gzip or Brotli compression removes most of the remaining overhead anyway, so pretty-printing only matters for humans. In Express, express.json() rejects bodies over 100 kB by default with a 413 error; raise the limit option deliberately for endpoints that really receive large documents instead of globally. Sorting keys before saving fixtures and snapshots keeps your diffs in code review small and readable.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why is my JSON invalid when it works in JavaScript?',
        a: 'JSON is stricter: double quotes only, no trailing commas, no comments, no undefined or NaN.',
      },
      {
        q: 'Can it handle large files?',
        a: 'Files of several megabytes work in modern browsers. Very large documents may make the page slow because everything runs locally.',
      },
      {
        q: 'Is my JSON sent to a server?',
        a: 'No. Parsing and formatting happen in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];

export const toolBySlug = (slug: string): ToolMeta | undefined => TOOLS.find((tool) => tool.slug === slug);
