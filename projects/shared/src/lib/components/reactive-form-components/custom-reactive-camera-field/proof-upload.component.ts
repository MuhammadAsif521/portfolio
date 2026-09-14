import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { SlicePipe } from '@angular/common';
import { MatHint } from '@angular/material/form-field';
import { IconComponent } from '@shared/components/icon-component/icon-component';

export interface ProofFilePreview {
  file: File;
  url: string;
  isVideo: boolean;
}
type CaptureMode = 'photo' | 'video';

@Component({
  selector: 'app-reactive-camera-field',
  templateUrl: './proof-upload.component.html',
  styleUrl: './proof-upload.component.scss',
  standalone: true,
  imports: [IconComponent, MatHint, SlicePipe],
})
export class CustomReactiveCameraComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild('liveVideo') liveVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('galleryInput') galleryInput?: ElementRef<HTMLInputElement>;
  @Input() controlName!: string;
  @Input() control!: FormControl;
  @Input() label$!: Observable<string>;
  @Input() multiple = true;
  @Input() maxFiles: number | null = null;
  @Input() allowPhoto = true;
  @Input() allowVideo = true;
  @Input() allowGallery = true;
  @Output() file = new EventEmitter<File[] | File | null>();
  
  label = '';
  previews: ProofFilePreview[] = [];
  private files: File[] = [];
  private readonly destroy$ = new Subject<void>();
  isCameraOpen = false;
  captureMode: CaptureMode = 'photo';
  facingMode: 'user' | 'environment' = 'environment';
  isRecording = false;
  recordingSeconds = 0;
  cameraError: string | null = null;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.label$?.pipe(takeUntil(this.destroy$)).subscribe(label => {
      this.label = label;
      this.cdr.markForCheck();
    });
  }
  get hasRequiredValidator(): boolean {
    return !!this.control?.hasValidator(Validators.required);
  }
  get atFileLimit(): boolean {
    if (!this.multiple) return false;
    if (this.maxFiles === null || this.maxFiles <= 0) return false;
    return this.files.length >= this.maxFiles;
  }
  get recordingTimeDisplay(): string {
    const minutes = Math.floor(this.recordingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.recordingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  openDefaultCapture(): void {
    if (this.atFileLimit) return;
    if (this.allowPhoto) {
      void this.openCamera('photo');
      return;
    }
    if (this.allowVideo) {
      void this.openCamera('video');
      return;
    }
    if (this.allowGallery) {
      this.chooseFromGallery();
    }
  }
  async openCamera(mode: CaptureMode): Promise<void> {
    if (this.atFileLimit) return;
    this.captureMode = mode;
    this.cameraError = null;
    this.isCameraOpen = true;
    this.cdr.detectChanges();
    try {
      await this.startStream();
    } catch (error) {
      console.error('[ReactiveCamera] Camera error:', error);
      this.cameraError = this.getCameraErrorMessage(error);
      this.isCameraOpen = false;
      this.stopStream();
      this.cdr.detectChanges();
    }
  }
  async setCaptureMode(mode: CaptureMode): Promise<void> {
    if (this.isRecording || this.captureMode === mode) return;
    this.captureMode = mode;
    this.cameraError = null;
    this.cdr.detectChanges();
    try {
      await this.startStream();
    } catch (error) {
      console.error('[ReactiveCamera] Mode switch error:', error);
      this.cameraError = 'Unable to switch camera mode.';
      this.cdr.detectChanges();
    }
  }
  async switchCamera(): Promise<void> {
    if (this.isRecording) return;
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.cameraError = null;
    try {
      await this.startStream();
    } catch (error) {
      console.error('[ReactiveCamera] Camera switch error:', error);
      this.cameraError = 'Unable to switch camera.';
      this.cdr.detectChanges();
    }
  }
  private async startStream(): Promise<void> {
    this.stopStream();
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: this.captureMode === 'video',
    };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.stream = newStream;
    this.cdr.detectChanges();
    await this.attachStreamToVideo();
  }
  private async attachStreamToVideo(): Promise<void> {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve());
    });
    const video = this.liveVideoRef?.nativeElement;
    if (!video || !this.stream) {
      console.warn('[ReactiveCamera] Video element is not available.');
      return;
    }
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    try {
      await video.play();
    } catch (error) {
      console.debug('[ReactiveCamera] Initial video.play() deferred:', error);
      await new Promise<void>(resolve => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      });
      try {
        await video.play();
      } catch (playError) {
        console.warn('[ReactiveCamera] Unable to autoplay camera:', playError);
      }
    }
    this.cdr.detectChanges();
  }
  private stopStream(): void {
    const video = this.liveVideoRef?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
  closeCamera(): void {
    if (this.isRecording) {
      this.stopRecording(true);
    }
    this.stopStream();
    this.isCameraOpen = false;
    this.cdr.detectChanges();
  }
  capturePhoto(): void {
    const video = this.liveVideoRef?.nativeElement;
    const canvas = this.captureCanvasRef?.nativeElement;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      this.cameraError = 'Camera is not ready yet. Please try again.';
      this.cdr.detectChanges();
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (this.facingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) return;
        const file = new File([blob], `proof-photo-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        this.addFile(file, false, true);
        this.closeCamera();
      },
      'image/jpeg',
      0.92
    );
  }
  toggleRecording(): void {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }
  private startRecording(): void {
    if (!this.stream) return;
    if (typeof MediaRecorder === 'undefined') {
      this.cameraError = 'Video recording is not supported by this browser.';
      this.cdr.detectChanges();
      return;
    }
    this.recordedChunks = [];
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const supportedType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
    try {
      this.mediaRecorder = supportedType
        ? new MediaRecorder(this.stream, { mimeType: supportedType })
        : new MediaRecorder(this.stream);
    } catch (error) {
      console.error('[ReactiveCamera] MediaRecorder error:', error);
      this.cameraError = 'Unable to start video recording.';
      this.cdr.detectChanges();
      return;
    }
    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    this.mediaRecorder.onerror = event => {
      console.error('[ReactiveCamera] Recording error:', event);
      this.cameraError = 'An error occurred while recording.';
      this.isRecording = false;
      this.stopRecordingTimer();
      this.cdr.detectChanges();
    };
    this.mediaRecorder.onstop = () => {
      this.finishRecording();
    };
    try {
      this.mediaRecorder.start(250);
    } catch (error) {
      console.error('[ReactiveCamera] Unable to start recording:', error);
      this.cameraError = 'Unable to start recording.';
      this.cdr.detectChanges();
      return;
    }
    this.isRecording = true;
    this.recordingSeconds = 0;
    this.startRecordingTimer();
    this.cdr.detectChanges();
  }
  private finishRecording(): void {
    const recorder = this.mediaRecorder;
    const type = recorder?.mimeType || 'video/webm';
    const blob = new Blob(this.recordedChunks, { type });
    if (!blob.size) {
      this.cameraError = 'The recording was empty. Please try again.';
      this.stopStream();
      this.isCameraOpen = false;
      this.cdr.detectChanges();
      return;
    }
    const extension = type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `proof-video-${Date.now()}.${extension}`, {
      type,
      lastModified: Date.now(),
    });
    this.addFile(file, true, true);
    this.stopStream();
    this.isCameraOpen = false;
    this.isRecording = false;
    this.cdr.detectChanges();
  }
  private stopRecording(silent = false): void {
    this.stopRecordingTimer();
    const recorder = this.mediaRecorder;
    this.isRecording = false;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else if (silent) {
      this.stopStream();
    }
    this.cdr.detectChanges();
  }
  private startRecordingTimer(): void {
    this.stopRecordingTimer();
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      this.cdr.detectChanges();
    }, 1000);
  }
  private stopRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }
  chooseFromGallery(): void {
    if (this.atFileLimit) return;
    this.galleryInput?.nativeElement.click();
  }
  onGalleryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    let selected = Array.from(input.files ?? []);
    if (!selected.length) return;
    selected = selected.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (this.multiple && this.maxFiles) {
      const remaining = this.maxFiles - this.files.length;
      selected = selected.slice(0, Math.max(remaining, 0));
    }
    if (!this.multiple) {
      selected = selected.slice(0, 1);
    }
    selected.forEach(file => {
      this.addFile(file, file.type.startsWith('video/'), false);
    });
    this.emitFiles();
    input.value = '';
  }
  private addFile(file: File, isVideo: boolean, emit = true): void {
    if (!this.multiple) {
      this.clearPreviews();
      this.files = [];
    }
    this.files.push(file);
    this.previews.push({
      file,
      url: URL.createObjectURL(file),
      isVideo,
    });
    if (emit) {
      this.emitFiles();
    }
    this.cdr.detectChanges();
  }
  removeFile(index: number): void {
    const removed = this.previews[index];
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    this.previews.splice(index, 1);
    this.files.splice(index, 1);
    this.emitFiles();
    this.cdr.detectChanges();
  }
  private emitFiles(): void {
    const value = this.multiple ? [...this.files] : (this.files[0] ?? null);
    this.file.emit(value);
    if (this.control) {
      this.control.setValue(value);
      this.control.markAsTouched();
      this.control.markAsDirty();
      this.control.updateValueAndValidity({ emitEvent: false });
    }
  }
  private clearPreviews(): void {
    this.previews.forEach(preview => URL.revokeObjectURL(preview.url));
    this.previews = [];
  }
  private getCameraErrorMessage(error: unknown): string {
    const name =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Please allow camera access in your browser settings.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is already being used by another application.';
      case 'OverconstrainedError':
        return 'The selected camera is not available. Please try switching cameras.';
      case 'SecurityError':
        return 'Camera access requires a secure connection (HTTPS or localhost).';
      default:
        return 'Camera access was denied or is unavailable on this device.';
    }
  }
  ngOnDestroy(): void {
    this.stopRecordingTimer();
    this.stopStream();
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
    }
    this.clearPreviews();
    this.destroy$.next();
    this.destroy$.complete();
  }
}