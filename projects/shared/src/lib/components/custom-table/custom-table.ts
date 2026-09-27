import { Component, ChangeDetectionStrategy, Input, TemplateRef, Output, EventEmitter } from '@angular/core';
import {  NgTemplateOutlet } from '@angular/common';
import { PageLoaderComponent } from '../page-loader/page-loader.component';
import { CustomPaginatorComponent, PaginationMeta } from '@shared/components/custom-paginator/custom-paginator';
import { MatTooltip } from "@angular/material/tooltip"; 
import { IconComponent } from "../icon-component/icon-component";
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state';

export interface TableColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    wrap?: boolean;
}

export interface TableAction {
    key: string;
    label: string;
    icon: string;
    iconSize?: number;
    color?: 'primary' | 'secondary' | 'error' | 'accent' | 'muted';
    hidden?: (row: any) => boolean;
    rawRow?: boolean;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortEvent {
    column: string;
    direction: SortDirection;
}

@Component({
    selector: 'app-custom-table',
    standalone: true,
    templateUrl: './custom-table.html',
    imports: [
        NgTemplateOutlet,
        PageLoaderComponent,
        CustomPaginatorComponent,
        MatTooltip,
        EmptyStateComponent,
        IconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomTableComponent {
    @Input() data: any[] = [];
    @Input() columns: TableColumn[] = [];
    @Input() actions: TableAction[] = [];
    @Input() rowKey = '_id';
    @Input() showPageSize = true;
    @Input() isLoading = false;
    @Input() emptyMessage = 'No records found.';
    @Input() pagination!: PaginationMeta;
    @Input() iconSize: number = 15;
    @Input() cellTemplates: { [key: string]: TemplateRef<any> } = {};

    @Output() sortChange = new EventEmitter<SortEvent>();
    @Output() actionClick = new EventEmitter<{ action: string; row: any }>();
    @Output() pageChange = new EventEmitter<number>();
    @Output() pageSizeChange = new EventEmitter<number>();

    sortColumn: string | null = null;
    sortDirection: SortDirection = null;

    getCellTemplate(key: string): TemplateRef<any> | null {
        return this.cellTemplates?.[key] ?? null;
    }

    getRowIndex(i: number): number {
        if (!this.pagination) return i + 1;
        return (this.pagination.currentPage - 1) * this.pagination.pageSize + i + 1;
    }

    onAction(action: string, row: any): void {
        this.actionClick.emit({ action, row });
    }

    toggleSort(col: string): void {
        if (this.sortColumn !== col) {
            this.sortColumn = col;
            this.sortDirection = 'asc';
        } else if (this.sortDirection === 'asc') {
            this.sortDirection = 'desc';
        } else {
            this.sortColumn = null;
            this.sortDirection = null;
        }
        this.sortChange.emit({ column: this.sortColumn ?? '', direction: this.sortDirection });
    }

    getHeaderClass(col: TableColumn): string {
        const base = 'px-4 py-3.5 text-xs font-semibold text-gray-500  tracking-wide whitespace-nowrap';
        const align = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
        const cursor = col.sortable ? 'cursor-pointer select-none hover:text-green transition-colors' : '';
        return `${base} ${align} ${cursor} ${col.width ?? ''}`.trim();
    }

    getCellClass(col: TableColumn): string {
        const align = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
        const wrap = col.wrap ? 'whitespace-normal' : 'whitespace-nowrap';
        return `px-4 py-8 text-gray-700 ${align} ${wrap}`;
    }

    getActionClass(color?: string): string {
        const map: Record<string, string> = {
            primary: 'text-primary hover:text-on-primary hover:bg-primary',
            secondary: 'text-info hover:text-white hover:bg-info',
            accent: 'text-accent hover:text-on-accent hover:bg-accent',
            error: 'text-error hover:text-white hover:bg-error',
            muted: 'text-muted hover:text-heading hover:bg-surface-muted'
        };
        return `${map[color ?? 'secondary']}`;
    }

    private normalizeValue(v: any): any {
        if (typeof v === 'string') return v.toLowerCase().trim();
        if (typeof v === 'boolean') return v ? 'active' : 'inactive';
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return this.normalizeRow(v);
        return v;
    }

    private normalizeRow(row: any): any {
        return Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, this.normalizeValue(v)])
        );
    }

    isActionHidden(action: TableAction, row: any): boolean {
        if (!action.hidden) return false;
        return action.hidden(action.rawRow ? row : this.normalizeRow(row));
    }
}