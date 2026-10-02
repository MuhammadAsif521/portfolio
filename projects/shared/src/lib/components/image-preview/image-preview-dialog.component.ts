import { Component, inject, Inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IconComponent } from "../icon-component/icon-component";

export interface ImagePreviewData {
  images: string[];
  startIndex: number;
  imageUrl: (path: string) => string;
}

@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  imports: [MatDialogModule, IconComponent],
  template: `
    <mat-dialog-content class="!p-0 dialog-content">
      <div class="relative bg-body/95 w-[95vw] h-[90vh] flex items-center justify-center">
      <button type="button" (click)="close()"
        class="absolute top-4 right-4 z-10 rounded-full bg-heading/10 p-2 hover:bg-heading/20 transition-base">
        <i-lucide name="x" [size]="22" class="text-heading"></i-lucide>
      </button>

      @if (images.length > 1) {
        <button type="button" (click)="prev()"
          class="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-heading/10 p-2 hover:bg-heading/20 transition-base">
          <i-lucide name="chevron-left" [size]="26" class="text-heading"></i-lucide>
        </button>
        <button type="button" (click)="next()"
          class="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-heading/10 p-2 hover:bg-heading/20 transition-base">
          <i-lucide name="chevron-right" [size]="26" class="text-heading"></i-lucide>
        </button>
      }

      <img [src]="data.imageUrl(images[activeIndex()])" alt="Preview"
           class="max-w-full max-h-full object-contain" />

      @if (images.length > 1) {
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-muted text-sm">
          {{ activeIndex() + 1 }} / {{ images.length }}
        </div>
      }
    </div>
    </mat-dialog-content>
  `,
})
export class ImagePreviewDialogComponent {

  private readonly dialogRef = inject(MatDialogRef<ImagePreviewDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as any | null;

  readonly images = this.data.images;
  readonly activeIndex = signal(this.data.startIndex);


  close() {
    this.dialogRef.close();
  }

  next() {
    this.activeIndex.update(i => (i + 1) % this.images.length);
  }

  prev() {
    this.activeIndex.update(i => (i - 1 + this.images.length) % this.images.length);
  }
}