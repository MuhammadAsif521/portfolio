import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
 
@Injectable({ providedIn: 'root' })
export class DropdownCoordinatorService {
    private activeId: string | number | null = null;
    private closeRequested = new Subject<string | number | null>();
 
    closeRequested$ = this.closeRequested.asObservable();
 
    open(id: string | number): void {
        if (this.activeId === id) return;
        this.activeId = id;
        this.closeRequested.next(id);
    }
 
    close(id: string | number): void {
        if (this.activeId === id) {
            this.activeId = null;
        }
    }

    closeAll(): void {
        this.activeId = null;
        this.closeRequested.next(null);
    }
}