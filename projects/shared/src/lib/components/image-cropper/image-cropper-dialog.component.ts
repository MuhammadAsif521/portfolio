import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IconComponent } from '../icon-component/icon-component';
import { LoadingButtonComponent } from '../loading-button/loading-button';

export interface ImageCropperData {
  file: File;
  maxWidth: number;
  maxHeight: number;
  aspectRatio?: number;
}

@Component({
  selector: 'app-image-cropper-dialog',
  standalone: true,
  imports: [MatDialogModule, IconComponent, LoadingButtonComponent],
  templateUrl: './image-cropper-dialog.component.html',
})
export class ImageCropperDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ImageCropperDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as ImageCropperData;

  readonly viewportWidth = 320;
  readonly aspectRatio = this.data.aspectRatio || this.data.maxWidth / this.data.maxHeight || 1;
  readonly viewportHeight = Math.round(this.viewportWidth / this.aspectRatio);
  readonly maxZoom = 3;

  readonly imageUrl = URL.createObjectURL(this.data.file);
  readonly imageReady = signal(false);
  readonly zoom = signal(1);

  posX = 0;
  posY = 0;

  private naturalWidth = 0;
  private naturalHeight = 0;
  private baseScale = 1;

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 0;
  private startPosY = 0;

  get displayWidth(): number {
    return this.naturalWidth * this.baseScale * this.zoom();
  }

  get displayHeight(): number {
    return this.naturalHeight * this.baseScale * this.zoom();
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    this.baseScale = Math.max(
      this.viewportWidth / this.naturalWidth,
      this.viewportHeight / this.naturalHeight,
    );
    this.zoom.set(1);
    this.posX = (this.viewportWidth - this.displayWidth) / 2;
    this.posY = (this.viewportHeight - this.displayHeight) / 2;
    this.imageReady.set(true);
  }

  onZoomInput(value: string): void {
    const previousWidth = this.displayWidth;
    const previousHeight = this.displayHeight;
    const centerX = this.posX + previousWidth / 2;
    const centerY = this.posY + previousHeight / 2;

    this.zoom.set(Number(value));

    // Zoom around the viewport's current center rather than the image's origin.
    this.posX = centerX - this.displayWidth / 2;
    this.posY = centerY - this.displayHeight / 2;
    this.clampPosition();
  }

  onPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.startPosX = this.posX;
    this.startPosY = this.posY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    this.posX = this.startPosX + (event.clientX - this.dragStartX);
    this.posY = this.startPosY + (event.clientY - this.dragStartY);
    this.clampPosition();
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  private clampPosition(): void {
    const minX = this.viewportWidth - this.displayWidth;
    const minY = this.viewportHeight - this.displayHeight;

    this.posX = Math.min(0, Math.max(minX, this.posX));
    this.posY = Math.min(0, Math.max(minY, this.posY));
  }

  cancel(): void {
    URL.revokeObjectURL(this.imageUrl);
    this.dialogRef.close(null);
  }

  apply(): void {
    const outputWidth = this.data.maxWidth;
    const outputHeight = this.data.maxHeight;
    const scaleX = outputWidth / this.viewportWidth;
    const scaleY = outputHeight / this.viewportHeight;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.cancel();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        this.posX * scaleX,
        this.posY * scaleY,
        this.displayWidth * scaleX,
        this.displayHeight * scaleY,
      );

      const isPng = this.data.file.type === 'image/png';
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(this.imageUrl);

          if (!blob) {
            this.dialogRef.close(null);
            return;
          }

          const croppedFile = new File([blob], this.data.file.name, {
            type: isPng ? 'image/png' : 'image/jpeg',
          });
          this.dialogRef.close(croppedFile);
        },
        isPng ? 'image/png' : 'image/jpeg',
        0.92,
      );
    };
    img.src = this.imageUrl;
  }
}
