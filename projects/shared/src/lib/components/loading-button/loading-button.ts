import { Component, Input, Output, EventEmitter } from '@angular/core';
import { } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon-component/icon-component';

export type ButtonVariant = 'flat' | 'stroked';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonColor = 'primary' | 'secondary' | 'accent' | 'warn' | 'error';
export type ButtonRadius = 'none' | 'small' | 'medium' | 'large';
export type ButtonIconPos = 'left' | 'right';

@Component({
  selector: 'app-loading-button',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './loading-button.html',
  styleUrls: ['./loading-button.scss'],
})
export class LoadingButtonComponent {
  @Input() buttonText: string = 'Action';
  @Input() loading: boolean = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled: boolean = false;
  @Input() customClass: string = '';
  @Input() variant: ButtonVariant = 'flat';
  @Input() size: ButtonSize = 'medium';
  @Input() color: ButtonColor = 'secondary';
  @Input() radius: ButtonRadius = 'none';

  // ── Icon support ──
  @Input() icon?: string;
  @Input() iconPos: ButtonIconPos = 'left';
  @Input() iconSize: number = 18;
  @Input() iconColor?: any;

  // ── Navigation / click support ──
  @Input() routerLink?: string | any[];
  @Input() queryParams?: { [key: string]: any };
  @Output() btnClick = new EventEmitter<Event>();

  handleClick(event: Event): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.btnClick.emit(event);
  }
}