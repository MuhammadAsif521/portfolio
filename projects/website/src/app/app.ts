import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TOASTER_OPTIONS } from '@shared/constants/const';
import { NgxSonnerToaster } from 'ngx-sonner';
import { SiteFooter } from './layout/site-footer/site-footer';
import { SiteHeader } from './layout/site-header/site-header';

@Component({
  // NgxSonnerToaster is only used inside @defer, so ngx-sonner stays out of the initial bundle.
  imports: [RouterOutlet, NgxSonnerToaster, SiteHeader, SiteFooter],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly toaster = TOASTER_OPTIONS;
}
