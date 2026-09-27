import { Observable, forkJoin, map, of } from 'rxjs';
import type { AssetImage } from '@shared/interfaces/entities.interface';
import { ResourceService, type UploadFolder } from '@cusadmin/services/resource.service';

/** What portfolio-node's imageInput accepts (no `url`: the server adds it). */
export interface ImageRef {
  key: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ImageFieldSpec {
  /** Form control name holding File | AssetImage | null. */
  name: string;
  folder: UploadFolder;
  /** Alt text for new uploads (e.g. the project title); kept as-is for existing images. */
  alt?: string;
}

function toRef(image: Partial<AssetImage>, alt?: string): ImageRef {
  return {
    key: image.key!,
    ...((image.alt ?? alt) ? { alt: (image.alt ?? alt)!.slice(0, 150) } : {}),
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
  };
}

/**
 * conb-sites-admin uploadFileFields, for portfolio-node image objects: each File is uploaded to
 * /admin/uploads (WebP) and replaced by { key, alt, width, height }; an existing image object is reduced
 * to the same shape (sending `url` back is a 422); an empty value becomes null (cleared on PATCH).
 */
export function uploadImageFields(
  svc: ResourceService,
  specs: ImageFieldSpec[],
  value: Record<string, unknown>,
): Observable<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...value };
  const uploads: { name: string; obs: Observable<ImageRef> }[] = [];

  for (const spec of specs) {
    const current = Array.isArray(out[spec.name]) ? (out[spec.name] as unknown[])[0] : out[spec.name];
    if (current instanceof File) {
      uploads.push({
        name: spec.name,
        obs: svc.uploadImage(current, spec.folder, spec.alt).pipe(map((img) => toRef(img, spec.alt))),
      });
    } else if (current && typeof current === 'object' && 'key' in current) {
      out[spec.name] = toRef(current as AssetImage);
    } else {
      out[spec.name] = null;
    }
  }

  if (!uploads.length) return of(out);
  return forkJoin(uploads.map((u) => u.obs)).pipe(
    map((refs) => {
      uploads.forEach((u, i) => (out[u.name] = refs[i]));
      return out;
    }),
  );
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/**
 * Shapes a form value for portfolio-node's strict schemas.
 * - create: empty values are dropped (Mongoose defaults apply).
 * - update: empty values in `nullable` become null (the server $unsets them); other empties are dropped,
 *   since notNullable keys reject null. Nested plain objects (e.g. `seo`) are cleaned the same way and
 *   dropped when nothing is left.
 * - Strings are trimmed; keys in `omit` are never sent (server-owned fields).
 */
export function toPayload(
  value: Record<string, unknown>,
  mode: 'create' | 'update',
  options: { nullable?: readonly string[]; omit?: readonly string[] } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (options.omit?.includes(key)) continue;
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof File) && !('key' in v)) {
      const nested = toPayload(v as Record<string, unknown>, 'create');
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    if (isEmpty(v)) {
      if (mode === 'update' && options.nullable?.includes(key)) out[key] = null;
      continue;
    }
    out[key] = v;
  }
  return out;
}

/** "Angular, NgRx , Node.js" → ['Angular', 'NgRx', 'Node.js'] (portfolio-node also accepts the string). */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
