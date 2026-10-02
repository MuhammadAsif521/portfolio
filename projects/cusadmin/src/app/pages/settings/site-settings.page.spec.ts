import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '@shared/services/toast.service';
import { ResourceService } from '@cusadmin/services/resource.service';
import { SiteSettingsPage } from './site-settings.page';

const settings = {
  _id: 's1',
  siteName: 'Muhammad Asif',
  socialLinks: [],
  siteMode: 'system',
  activeThemeId: 't1',
  activeTheme: null,
  favicon: {
    key: 'settings/2026/10/cd1cc0b7-534e-4201-af26-050692fef1ea.webp',
    url: 'https://cdn.test/settings/2026/10/cd1cc0b7-534e-4201-af26-050692fef1ea.webp',
    alt: 'AP',
    width: 512,
    height: 512,
  },
};

function setup() {
  const svc = {
    getOne: vi.fn(() => of({ status: true, data: settings })),
    update: vi.fn((_path: string, _id: null, body: Record<string, unknown>) =>
      of({ status: true, message: 'Settings updated', data: { ...settings, ...body } }),
    ),
    uploadImage: vi.fn((_file: File, folder: string, alt?: string) =>
      of({ key: `${folder}/2026/10/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`, url: 'u', alt: alt ?? '', width: 512, height: 512 }),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ResourceService, useValue: svc },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  // Class only: the form logic is under test, not the rich-text editors in the template.
  const page = TestBed.runInInjectionContext(() => new SiteSettingsPage());
  page.load();
  return { page, svc };
}

describe('SiteSettingsPage favicon', () => {
  it('has a favicon file field on the General tab', () => {
    const { page } = setup();
    const general = page.sections.find((s) => s.tab.value === 'general')!;
    const field = general.fields.find((f) => f.name === 'favicon');
    expect(field).toMatchObject({ type: 'file' });
    expect(field?.accept).toContain('image/png');
    expect(field?.accept).not.toContain('svg');
  });

  it('sends the existing favicon back as a bare image reference', () => {
    const { page, svc } = setup();
    page.save();
    const body = svc.update.mock.calls[0][2];
    expect(body['favicon']).toEqual({ key: settings.favicon.key, alt: 'AP', width: 512, height: 512 });
    expect(svc.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a new favicon to the settings folder', () => {
    const { page, svc } = setup();
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'favicon.png', { type: 'image/png' });
    page.form!.get('favicon')!.setValue(file);
    page.save();
    expect(svc.uploadImage).toHaveBeenCalledWith(file, 'settings', 'Muhammad Asif icon');
    expect(svc.update.mock.calls[0][2]['favicon']).toMatchObject({
      key: 'settings/2026/10/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    });
  });

  it('clears the favicon with null', () => {
    const { page, svc } = setup();
    page.form!.get('favicon')!.setValue(null);
    page.save();
    expect(svc.update.mock.calls[0][2]['favicon']).toBeNull();
  });
});
