import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { LAYOUT_CONFIGS, LayoutMode, LayoutService } from '@shared/services/layout.service';
import { IconComponent } from "@shared/components/icon-component/icon-component";

@Component({
  selector: 'app-layout-switcher',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './layout-switcher.html',
  styleUrls: ['./layout-switcher.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scaleX(0.85)' }),
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'scaleX(1)' }))
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'scaleX(0.85)' }))
      ])
    ])
  ]
})
export class LayoutSwitcherComponent {
  private layoutService = inject(LayoutService);
  private cdr = inject(ChangeDetectorRef);

  panelOpen = false;
  layouts = LAYOUT_CONFIGS;
  activeLayout = this.layoutService.layoutMode;

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.cdr.detectChanges();
  }

  selectLayout(mode: LayoutMode): void {
    this.layoutService.setLayout(mode);
    this.panelOpen = false;
  }
}