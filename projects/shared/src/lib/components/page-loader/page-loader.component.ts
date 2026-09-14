import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-page-loader',
  template: `
    <div class="loader-container">
      <img
        src="assets/images/general/chef_clean_final.gif"
        class="mix-blend-darken"
        alt="khan_meat_pointe_loader"
        (contextmenu)="disableRightClick($event)"
      />
    </div>
  `,
  styles: [`
    .loader-container {
      min-height: 320px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 24px;
      background: transparent;
      user-select: none;
    }
  `]
})
export class PageLoaderComponent {
  disableRightClick(event: MouseEvent) {
    event.preventDefault();
  }
}