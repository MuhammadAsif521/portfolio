import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TOASTER_OPTIONS } from '@shared/constants/const';
import { NgxSonnerToaster } from 'ngx-sonner';

@Component({
  imports: [RouterOutlet, NgxSonnerToaster],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('website');

  protected readonly toaster = TOASTER_OPTIONS;
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

}
