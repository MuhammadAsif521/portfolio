import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TabService {
    activeTab = signal<string>('');
}