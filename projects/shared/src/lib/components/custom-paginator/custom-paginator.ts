
import {  } from '@angular/common';
import { Component, ChangeDetectionStrategy, OnChanges, Input, Output, EventEmitter, SimpleChanges } from '@angular/core'; 
import { CustomDropdownComponent } from '@shared/components/form-components/custom-dropdown/custom-dropdown.component';
import { IconComponent } from "../icon-component/icon-component";

export interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
}

@Component({
    selector: 'app-custom-paginator', 
    templateUrl: './custom-paginator.html',
    imports: [ CustomDropdownComponent, IconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomPaginatorComponent implements OnChanges {
    @Input() pagination!: PaginationMeta;

    /** Show or hide the page-size dropdown. Default: true */
    @Input() showPageSize = true;

    /**
     * Override page size options from parent.
     * Each item: { name: string; value: string }
     * Falls back to default list if not provided.
     */
    @Input() pageSizeOptions: { name: string; value: string }[] = [];

    @Output() pageChange = new EventEmitter<number>();
    @Output() pageSizeChange = new EventEmitter<number>();

    pageNumbers: (number | string)[] = [];

    private readonly defaultPageSizeOptions = [
        { name: '10', value: '10' },
        { name: '20', value: '20' },
        { name: '50', value: '50' },
        { name: '100', value: '100' },
    ];

    get resolvedPageSizeOptions() {
        return this.pageSizeOptions?.length
            ? this.pageSizeOptions
            : this.defaultPageSizeOptions;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['pagination']) {
            this.pageNumbers = this.buildPageNumbers();
        }
    }

    get rangeStart(): number {
        if (!this.pagination) return 0;
        return (this.pagination.currentPage - 1) * this.pagination.pageSize + 1;
    }

    get rangeEnd(): number {
        if (!this.pagination) return 0;
        return Math.min(
            this.pagination.currentPage * this.pagination.pageSize,
            this.pagination.totalItems
        );
    }

    goToPage(page: number): void {
        if (!this.pagination) return;
        if (page < 1 || page > this.pagination.totalPages) return;
        if (page === this.pagination.currentPage) return;
        this.pageChange.emit(page);
    }

    onPageSizeChange(value: any): void {
        this.pageSizeChange.emit(Number(value));
    }

    getPageClass(page: number): string {
        const base = 'w-9 h-9 rounded-[1.5rem] border-2 flex items-center justify-center text-sm font-medium font-body transition';
        return page === this.pagination?.currentPage
            ? `${base} bg-accent text-white border-accent`
            : `${base} bg-surface text-secondary border-accent hover:bg-background`;
    }

    private buildPageNumbers(): (number | string)[] {
        const total = this.pagination?.totalPages ?? 0;
        const current = this.pagination?.currentPage ?? 1;
        if (total <= 1) return [1];

        const delta = 2;
        const range: number[] = [];
        const result: (number | string)[] = [];

        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }

        let prev: number | null = null;
        for (const page of range) {
            if (prev !== null) {
                if (page - prev === 2) result.push(prev + 1);
                else if (page - prev > 2) result.push('...');
            }
            result.push(page);
            prev = page;
        }

        return result;
    }
}