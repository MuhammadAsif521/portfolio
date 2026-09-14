import {  } from '@angular/common';
import { RouterLink } from '@angular/router'; 
import { IconComponent } from '../icon-component/icon-component';
import { Component, AfterViewInit, OnChanges, Input, Output, EventEmitter, ViewChild, ElementRef, SimpleChanges, HostListener } from '@angular/core';
import { NavTab } from '@shared/interfaces/tabs.interface';

@Component({
    selector: 'app-custom-tabs',
    standalone: true,
    imports: [ RouterLink, IconComponent],
    templateUrl: './custom-tabs.html',
    styleUrls: ['./custom-tabs.scss']
})
export class TabsComponent implements AfterViewInit, OnChanges {
    @Input() tabs: NavTab[] = [];
    @Input() activeTab = '';
    @Output() activeTabChange = new EventEmitter<string>();

    @ViewChild('tabsContainer') tabsContainerRef!: ElementRef<HTMLDivElement>;

    canScrollLeft = false;
    canScrollRight = false;
    hasOverflow = false;

    ngAfterViewInit() {
        setTimeout(() => this.updateScrollButtons());
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['tabs'] && !changes['tabs'].firstChange) {
            setTimeout(() => this.updateScrollButtons());
        }
    }

    @HostListener('window:resize')
    onResize() {
        setTimeout(() => this.updateScrollButtons());
    }

    onTabClick(tab: NavTab) {
        if (tab.disabled) return;
        if (!tab.routeUrl) {
            this.activeTab = tab.value;
            this.activeTabChange.emit(tab.value);
        }
    }

    scrollTabs(direction: 'left' | 'right') {
        const container = this.tabsContainerRef?.nativeElement;
        if (!container) return;
        container.scrollTo({
            left: container.scrollLeft + (direction === 'left' ? -200 : 200),
            behavior: 'smooth'
        });
    }

    onTabsScroll(event: Event) {
        this.updateScrollButtons(event.target as HTMLDivElement);
    }

    private updateScrollButtons(container?: HTMLDivElement) {
        const el = container || this.tabsContainerRef?.nativeElement;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        this.canScrollLeft = scrollLeft > 0;
        this.canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
        this.hasOverflow = scrollWidth > clientWidth;
    }
}