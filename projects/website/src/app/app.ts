import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TOASTER_OPTIONS } from '@shared/constants/const';
import { NgxSonnerToaster } from 'ngx-sonner';
import { SiteHeader } from './layout/site-header/site-header';

@Component({
  imports: [RouterOutlet, NgxSonnerToaster, SiteHeader],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly toaster = TOASTER_OPTIONS;
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
}
