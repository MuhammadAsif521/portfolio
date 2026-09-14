import { Injectable, inject } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { ViewportScroller } from '@angular/common';

@Injectable({
    providedIn: 'root',
})
export class UtilityService {
    private readonly router = inject(Router);
    private readonly viewportScroller = inject(ViewportScroller);

    /**
     * Navigate to a route.
     */
    async navigate(
        commands: string | any[],
        extras?: NavigationExtras
    ): Promise<boolean> {
        return Array.isArray(commands)
            ? this.router.navigate(commands, extras)
            : this.router.navigateByUrl(commands);
    }

    /**
     * Navigate to a route and scroll to an element by id.
     */
    async navigateAndScroll(
        commands: string | any[],
        sectionId: string,
        extras?: NavigationExtras
    ): Promise<boolean> {
        const success = Array.isArray(commands)
            ? await this.router.navigate(commands, extras)
            : await this.router.navigateByUrl(commands);

        if (success) {
            setTimeout(() => {
                this.viewportScroller.scrollToAnchor(sectionId);
            });
        }

        return success;
    }

    /**
     * Scroll to an element on the current page.
     */
    scrollTo(sectionId: string): void {
        setTimeout(() => {
            this.viewportScroller.scrollToAnchor(sectionId);
        });
    }

    /**
     * Navigate with router state.
     */
    async navigateWithState(
        commands: string | any[],
        state: Record<string, unknown>,
        extras?: NavigationExtras
    ): Promise<boolean> {
        const navigationExtras: NavigationExtras = {
            ...extras,
            state,
        };

        return Array.isArray(commands)
            ? this.router.navigate(commands, navigationExtras)
            : this.router.navigateByUrl(commands, navigationExtras);
    }
}