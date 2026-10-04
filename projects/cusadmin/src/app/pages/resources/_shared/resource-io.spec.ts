import { firstValueFrom, of } from 'rxjs';
import type { ResourceService } from '@cusadmin/services/resource.service';
import { splitList, toPayload, uploadImageFields } from './resource-io';

describe('toPayload', () => {
  it('trims strings and drops empties on create', () => {
    expect(toPayload({ title: '  Hi  ', client: '', tags: [], order: 0, featured: false }, 'create')).toEqual({
      title: 'Hi',
      order: 0,
      featured: false,
    });
  });

  it('sends null on update only for nullable keys', () => {
    const body = toPayload({ title: 'Hi', client: ' ', summary: '' }, 'update', { nullable: ['client'] });
    expect(body).toEqual({ title: 'Hi', client: null });
  });

  it('cleans nested objects and drops them when empty', () => {
    expect(toPayload({ seo: { metaTitle: ' T ', robots: '' } }, 'create')).toEqual({ seo: { metaTitle: 'T' } });
    expect(toPayload({ seo: { metaTitle: '', robots: null } }, 'update')).toEqual({});
  });

  it('keeps image refs as-is and never sends omitted keys', () => {
    const img = { key: 'blog/2026/09/a.webp', alt: 'A' };
    expect(toPayload({ coverImage: img, _id: 'x' }, 'update', { omit: ['_id'] })).toEqual({ coverImage: img });
  });
});

describe('splitList', () => {
  it('splits on commas and new lines, trimming blanks', () => {
    expect(splitList('Angular, NgRx ,\nNode.js,, ')).toEqual(['Angular', 'NgRx', 'Node.js']);
    expect(splitList([' a ', '', 'b'])).toEqual(['a', 'b']);
    expect(splitList(null)).toEqual([]);
  });
});

describe('uploadImageFields', () => {
  const uploaded = { key: 'projects/2026/09/new.webp', url: 'https://cdn/x.webp', alt: 'Title', width: 800, height: 600 };
  const svc = { uploadImage: vi.fn(() => of(uploaded)) } as unknown as ResourceService;

  it('uploads Files, reduces existing images to refs, and nulls empties', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const out = await firstValueFrom(
      uploadImageFields(
        svc,
        [
          { name: 'coverImage', folder: 'projects', alt: 'Title' },
          { name: 'diagram', folder: 'projects' },
          { name: 'logo', folder: 'settings' },
        ],
        { coverImage: [file], diagram: { key: 'projects/old.webp', url: 'https://cdn/old.webp', alt: 'Old' }, logo: '' },
      ),
    );
    expect(svc.uploadImage).toHaveBeenCalledWith(file, 'projects', 'Title');
    expect(out['coverImage']).toEqual({ key: uploaded.key, alt: 'Title', width: 800, height: 600 });
    expect(out['diagram']).toEqual({ key: 'projects/old.webp', alt: 'Old' });
    expect(out['logo']).toBeNull();
  });

  it('never sends the server-owned variants / srcset back (the API rejects them)', async () => {
    const stored = {
      key: 'projects/2026/10/c.webp',
      url: 'https://cdn/c.webp',
      alt: 'Cover',
      width: 1600,
      height: 900,
      variants: [480, 960],
      srcset: 'https://cdn/c-w480.webp 480w, https://cdn/c-w960.webp 960w, https://cdn/c.webp 1600w',
    };
    const fresh = { ...uploaded, variants: [480], srcset: 'https://cdn/x-w480.webp 480w, https://cdn/x.webp 800w' };
    const svcWithVariants = { uploadImage: vi.fn(() => of(fresh)) } as unknown as ResourceService;
    const out = await firstValueFrom(
      uploadImageFields(
        svcWithVariants,
        [
          { name: 'coverImage', folder: 'projects' },
          { name: 'diagram', folder: 'projects', alt: 'Diagram' },
        ],
        { coverImage: stored, diagram: [new File(['x'], 'd.png', { type: 'image/png' })] },
      ),
    );
    expect(out['coverImage']).toEqual({ key: stored.key, alt: 'Cover', width: 1600, height: 900 });
    expect(out['diagram']).toEqual({ key: uploaded.key, alt: 'Title', width: 800, height: 600 });
  });
});
