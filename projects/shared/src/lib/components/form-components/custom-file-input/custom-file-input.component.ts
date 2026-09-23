import { Component, EventEmitter, Input, OnInit, OnDestroy, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { ImageCropperDialogComponent } from '@shared/components/image-cropper/image-cropper-dialog.component';
import { environment } from '@shared/environment/environment';
import { Observable, Subject, firstValueFrom, takeUntil } from 'rxjs';

export interface FileCropConfig {
  maxWidth: number;
  maxHeight: number;
  aspectRatio?: number;
}

interface FilePreviewItem {
  url: string;
  name: string;
  isBlob: boolean;
  size?: number;
}

// Extensions that are never allowed, regardless of `accept`.
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'asp', 'aspx', 'jsp',
  'html', 'htm', 'js', 'vbs', 'ps1', 'jar', 'dll', 'msi',
];

interface FileSecurityResult {
  isSafe: boolean;
  risk?: string;
  warning?: string;
}

// Extensions safe enough to allow, but still worth checking for a disguised executable.
const SNIFF_FOR_DISGUISE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt'];
// Magic bytes for executables/binaries that should never hide under a safe extension.
const EXECUTABLE_SIGNATURES = ['4d5a', '7f454c46', 'feedface', 'cafebabe'];

@Component({
  selector: 'app-custom-file-input',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="fc-wrapper">
      @if (displayLabel && showLabel) {
        <label class="fc-label">{{ displayLabel }}</label>
      }

      <!-- Drop zone — hidden when files selected -->
      @if (previews.length === 0) {
        <label
          class="fc-dropzone"
          [class.fc-focused]="isFocused"
          (dragover)="$event.preventDefault()"
          (drop)="onDrop($event)"
          (focusin)="isFocused = true"
          (focusout)="isFocused = false">

          <i-lucide name="upload" color="primary" [size]="20"></i-lucide>

          <span class="flex-1 truncate text-text-secondary">
            {{ placeholder || 'Choose file' + (multiple ? 's' : '') + ' or drag & drop' }}
          </span>

          <span class="fc-dropzone-browse">
            Browse
          </span>

          <input
            #fileInput
            type="file"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            (change)="onFilesSelected($event)"
            [multiple]="multiple"
            [accept]="accept"
          />
        </label>

        @if (maxFiles || maxFileSize) {
          <p class="fc-hint">
            @if (maxFiles) { Up to {{ maxFiles }} files }
            @if (maxFiles && maxFileSize) { &middot; }
            @if (maxFileSize) { Max {{ maxFileSize }}MB each }
          </p>
        }
      }

      <!-- Selected files list view -->
      @if (previews.length > 0) {
        <div class="fc-file-list">

          @for (item of previews; track $index) {
            <div class="fc-file-row">

              <!-- Thumbnail -->
              <div class="fc-file-thumb">
                @if (isImageUrl(item.url)) {
                  <img
                    [src]="item.url"
                    alt="preview"
                    (error)="onImgError($event)"
                  />
                } @else {
                  <i-lucide name="file" class="text-text-secondary" [size]="20"></i-lucide>
                }
              </div>

              <!-- File name -->
              <span class="flex-1 truncate text-[13px] text-secondary">
                {{ item.name }}
                @if (item.size) {
                  <span class="text-text-secondary">&middot; {{ formatFileSize(item.size) }}</span>
                }
              </span>

              <!-- Actions -->
              <div class="flex items-center gap-1 flex-shrink-0">

                <!-- Replace / Edit (single) or Add more (multiple) -->
                <label class="fc-file-action"
                  [title]="multiple ? 'Add more' : 'Replace'">
                  <i-lucide [name]="multiple ? 'upload' : 'pencil'" [size]="15" color="primary"></i-lucide>
                  <input
                    type="file"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    (change)="onReplaceFile($event, $index)"
                    [multiple]="multiple"
                    [accept]="accept"
                  />
                </label>

                <!-- Remove -->
                <button type="button"
                  class="fc-file-action"
                  (click)="removeFile($index)"
                  title="Remove">
                  <i-lucide name="x" [size]="15" color="error"></i-lucide>
                </button>

              </div>
            </div>
          }

          <!-- Add more row — multiple mode only -->
          @if (multiple) {
            <label class="fc-file-add-more">
              <i-lucide name="plus" [size]="14" color="primary"></i-lucide>
              <span class="text-[12px] font-medium text-primary">Add more files</span>
              <input
                type="file"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                (change)="onFilesSelected($event)"
                [multiple]="true"
                [accept]="accept"
              />
            </label>
          }

        </div>
      }

      <!-- Progress bar -->
      @if (progress && isVisible) {
        <div class="mt-2 w-full rounded-full overflow-hidden h-1.5 bg-border">
          <div class="h-full rounded-full transition-all duration-300 bg-primary"
            [style.width]="progress + '%'">
          </div>
        </div>
        <p class="fc-hint">{{ progress }}% uploaded</p>
      }

      <!-- Rejected / limit warnings -->
      @if (warnings.length) {
        <div class="mt-1.5 space-y-0.5">
          @for (warning of warnings; track warning) {
            <p class="fc-error-text !mt-0">{{ warning }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class CustomFileInputComponent implements OnInit, OnChanges, OnDestroy {
  @Output() file = new EventEmitter<any>();
  @Input() attachmentsControl!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() controlName!: string;
  @Input() placeholder = '';
  @Input() accept = '';
  @Input() progress!: number;
  @Input() multiple = true;
  @Input() fieldClass = '';
  @Input() theme = 'white';
  @Input() class = '';
  @Input() showLabel = true;
  @Input() patchedImages: File | File[] | any | null = null;
  @Input() maxFiles: number | null = null;
  @Input() maxFileSize: number | null = 10; // MB
  @Input() cropConfig: FileCropConfig | null = null;

  private readonly dialog = inject(MatDialog);

  displayLabel = '';
  isVisible = false;
  isFocused = false;
  previews: FilePreviewItem[] = [];
  hoveredAction: string | null = null;
  hoveredAddMore = false;
  warnings: string[] = [];

  // tracks actual File objects for new selections (index-matched to previews)
  private selectedFiles: (File | null)[] = [];
  private destroy$ = new Subject<void>();
  private readonly imageBaseUrl = environment.server;

  ngOnInit(): void {
    if (this.label$) {
      this.label$.pipe(takeUntil(this.destroy$)).subscribe(l => this.displayLabel = l);
    }
    this.applyPatchedImages();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patchedImages']) {
      if (!this.patchedImages) {
        this.clearAll();
      } else {
        this.applyPatchedImages();
      }
    }
  }

  private clearAll(): void {
    this.previews.forEach(p => {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
    });
    this.previews = [];
    this.selectedFiles = [];
  }

  private applyPatchedImages(): void {
    if (this.selectedFiles.length > 0) return;

    const items = Array.isArray(this.patchedImages) ? this.patchedImages : [this.patchedImages];
    const entries = items.filter((item): item is string | File => !!item);

    this.previews = entries.map((item) =>
      item instanceof File
        ? {
          url: item.type.startsWith('image/') ? URL.createObjectURL(item) : '',
          name: item.name,
          isBlob: true,
          size: item.size,
        }
        : {
          url: `${this.imageBaseUrl}/${item.replace(/^\//, '')}`,
          name: item.split('/').pop() || item,
          isBlob: false,
        },
    );

    this.selectedFiles = entries.map((item) => (item instanceof File ? item : null));
  }

  isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || url.startsWith('blob:');
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) void this.processFiles(Array.from(files));
  }

  onFilesSelected(event: any): void {
    const files: File[] = Array.from(event.target.files || []);
    if (files.length) void this.processFiles(files);
    event.target.value = ''; // reset so same file can be re-selected
  }

  async onReplaceFile(event: any, index: number): Promise<void> {
    const files: File[] = Array.from(event.target.files || []);
    if (!files.length) return;

    this.warnings = [];
    const candidate = files[0];

    if (this.maxFileSize && candidate.size > this.maxFileSize * 1024 * 1024) {
      this.warnings.push(`"${candidate.name}" exceeds the ${this.maxFileSize}MB limit.`);
      event.target.value = '';
      return;
    }

    const scan = await this.scanFile(candidate);
    if (!scan.isSafe) {
      this.warnings.push(`"${candidate.name}" was blocked: ${scan.risk}`);
      event.target.value = '';
      return;
    }
    if (scan.warning) {
      this.warnings.push(`"${candidate.name}" ${scan.warning}.`);
    }

    let sanitized = this.sanitize(candidate);

    if (!this.multiple && this.cropConfig && sanitized.type.startsWith('image/')) {
      const cropped = await this.cropImage(sanitized);
      if (!cropped) {
        event.target.value = '';
        return;
      }
      sanitized = cropped;
    }

    const oldUrl = this.previews[index]?.url;
    if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl);

    this.previews[index] = {
      url: sanitized.type.startsWith('image/') ? URL.createObjectURL(sanitized) : '',
      name: sanitized.name,
      isBlob: true,
      size: sanitized.size,
    };
    this.selectedFiles[index] = sanitized;
    this.isVisible = true;
    this.emitFiles();
    event.target.value = '';
  }

  removeFile(index: number): void {
    const url = this.previews[index]?.url;
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);

    this.previews.splice(index, 1);
    this.selectedFiles.splice(index, 1);

    this.emitFiles();
  }

  private async processFiles(files: File[]): Promise<void> {
    this.warnings = [];

    // Skip files already selected (same name).
    const existingNames = new Set([
      ...this.selectedFiles.filter((f): f is File => !!f).map((f) => f.name),
      ...this.previews.map((p) => p.name),
    ]);
    let candidates = files.filter((f) => {
      if (existingNames.has(f.name)) {
        this.warnings.push(`"${f.name}" is already added.`);
        return false;
      }
      return true;
    });

    // Max file count (multiple mode only).
    if (this.multiple && this.maxFiles) {
      const remaining = this.maxFiles - this.selectedFiles.filter(Boolean).length;

      if (remaining <= 0) {
        this.warnings.push(`You can upload up to ${this.maxFiles} files.`);
        return;
      }

      if (candidates.length > remaining) {
        this.warnings.push(`Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added (max ${this.maxFiles}).`);
        candidates = candidates.slice(0, remaining);
      }
    }

    // Max file size.
    if (this.maxFileSize) {
      const maxBytes = this.maxFileSize * 1024 * 1024;
      const tooLarge = candidates.filter((f) => f.size > maxBytes);
      tooLarge.forEach((f) => this.warnings.push(`"${f.name}" exceeds the ${this.maxFileSize}MB limit.`));
      candidates = candidates.filter((f) => f.size <= maxBytes);
    }

    if (!candidates.length) return;

    // Security scan — drop dangerous files, keep the rest (flagging soft warnings).
    const safeFiles: File[] = [];
    for (const candidate of candidates) {
      const scan = await this.scanFile(candidate);
      if (!scan.isSafe) {
        this.warnings.push(`"${candidate.name}" was blocked: ${scan.risk}`);
        continue;
      }
      if (scan.warning) {
        this.warnings.push(`"${candidate.name}" ${scan.warning}.`);
      }
      safeFiles.push(candidate);
    }

    if (!safeFiles.length) return;

    this.isVisible = true;
    const sanitized = safeFiles.map((f) => this.sanitize(f));

    if (this.multiple) {
      sanitized.forEach(f => {
        this.previews.push({
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
          name: f.name,
          isBlob: true,
          size: f.size,
        });
        this.selectedFiles.push(f);
      });
    } else {
      // single mode — replace everything
      let f = sanitized[0];

      if (this.cropConfig && f.type.startsWith('image/')) {
        const cropped = await this.cropImage(f);
        if (!cropped) return; // user cancelled — keep the previous selection
        f = cropped;
      }

      this.previews.forEach(p => { if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url); });
      this.previews = [{
        url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        name: f.name,
        isBlob: true,
        size: f.size,
      }];
      this.selectedFiles = [f];
    }

    this.emitFiles();
  }

  private cropImage(file: File): Promise<File | null> {
    const cropConfig = this.cropConfig!;

    return firstValueFrom(
      this.dialog
        .open(ImageCropperDialogComponent, {
          width: '420px',
          data: {
            file,
            maxWidth: cropConfig.maxWidth,
            maxHeight: cropConfig.maxHeight,
            aspectRatio: cropConfig.aspectRatio,
          },
        })
        .afterClosed(),
    ).then((result) => result ?? null);
  }

  private sanitize(f: File): File {
    const parts = f.name.split('.');
    const ext = parts.pop()!;
    const name = parts.join('.').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    return new File([f], `${name}.${ext}`, { type: f.type });
  }

  // ── Security scan ────────────────────────────────────────────────
  // Blocks known-dangerous extensions, null-byte/path-traversal filenames,
  // double extensions (e.g. "invoice.pdf.exe"), and files whose real content
  // (magic bytes) doesn't match an image MIME type they claim to be.
  private async scanFile(file: File): Promise<FileSecurityResult> {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (DANGEROUS_EXTENSIONS.includes(extension)) {
      return { isSafe: false, risk: 'file type not allowed' };
    }

    if (file.name.includes('\0')) {
      return { isSafe: false, risk: 'invalid file name' };
    }

    // SVG is text/XML, not a binary format — no magic-byte signature to check.
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      const looksLikeImage = await this.verifyFileHeader(file, /^(ffd8ff|89504e47|47494638|424d|52494646)/i);
      if (!looksLikeImage) {
        return { isSafe: false, risk: 'file content does not match image type' };
      }
    }

    // A "safe" extension can still be an executable in disguise — check its real bytes.
    if (SNIFF_FOR_DISGUISE_EXTENSIONS.includes(extension)) {
      const disguisedExecutable = await this.verifyFileHeader(
        file,
        new RegExp(`^(${EXECUTABLE_SIGNATURES.join('|')})`, 'i'),
      );
      if (disguisedExecutable) {
        return { isSafe: false, risk: 'file content does not match its extension' };
      }
    }

    // Double extensions (e.g. "invoice.pdf.exe") are unusual but not inherently
    // dangerous once the real extension above is confirmed safe — warn, don't block.
    if (/\.[a-z0-9]{2,4}\.[a-z0-9]{2,4}$/i.test(file.name)) {
      return { isSafe: true, warning: 'has an unusual double file extension' };
    }

    return { isSafe: true };
  }

  private verifyFileHeader(file: File, matches: RegExp): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const bytes = new Uint8Array(e.target.result).subarray(0, 4);
        let header = '';
        for (let i = 0; i < bytes.length; i++) {
          header += bytes[i].toString(16).padStart(2, '0');
        }
        resolve(matches.test(header));
      };
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private emitFiles(): void {
    const newFiles = this.selectedFiles.filter((f): f is File => f !== null);
    if (!this.multiple) {
      this.file.emit(newFiles[0] ?? null);
    } else {
      this.file.emit(newFiles.length ? newFiles : null);
    }
  }

  ngOnDestroy(): void {
    this.previews.forEach(p => { if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url); });
    this.destroy$.next();
    this.destroy$.complete();
  }

  onImgError(event: any): void {
    event.target.style.display = 'none';
    console.warn('Image failed to load:', event.target.src);
  }
}