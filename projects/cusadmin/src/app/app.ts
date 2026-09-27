import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TOASTER_OPTIONS } from '@shared/constants/const';
import { NgxSonnerToaster } from 'ngx-sonner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxSonnerToaster],
  templateUrl: './app.html',
})
export class App {
  protected readonly toaster = TOASTER_OPTIONS;
}
