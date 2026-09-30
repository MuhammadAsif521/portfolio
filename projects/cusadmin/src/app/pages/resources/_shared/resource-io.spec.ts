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
});
