import { Component, ChangeDetectionStrategy, Input, TemplateRef, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { IconComponent } from "../icon-component/icon-component";
import { EmptyStateComponent } from "../empty-state/empty-state";
import { CustomPaginatorComponent, PaginationMeta } from '../custom-paginator/custom-paginator';
import { PageLoaderComponent } from "../page-loader/page-loader.component";
import { MatTooltipModule } from "@angular/material/tooltip"; 

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
    color?: 'primary' | 'secondary' | 'info' | 'success' | 'error';
    hidden?: (row: any) => boolean;
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
    CommonModule,
    NgTemplateOutlet,
    CustomPaginatorComponent,
    IconComponent,
    EmptyStateComponent,
    PageLoaderComponent,
    MatTooltipModule
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
    @Input() emptyTitle = 'Nothing Found Try Later.';
    @Input() pagination!: PaginationMeta;
    @Input() iconSize: number = 15;
    @Input() cellTemplates: { [key: string]: TemplateRef<any> } = {};
    @Input() templateContext: Record<string, any> = {};

    // Add these
    @Input() expandedRowTemplate: TemplateRef<any> | null = null;
    @Input() isRowExpanded: ((row: any) => boolean) | null = null;

    @Output() sortChange = new EventEmitter<SortEvent>();
    @Output() actionClick = new EventEmitter<{ action: string; row: any }>();
    @Output() pageChange = new EventEmitter<number>();
    @Output() pageSizeChange = new EventEmitter<number>();

    sortColumn: string | null = null;
    sortDirection: SortDirection = null;


    getTemplateContext(row: any, col: TableColumn): any {
        return {
            $implicit: row,
            row,
            col,
            value: row?.[col.key],
            ...this.templateContext
        };
    }
    getCellTemplate(key: string): TemplateRef<any> | null {
        return this.cellTemplates?.[key] ?? null;
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
        const base =
            'px-4 py-4 text-xs font-semibold tracking-wide whitespace-nowrap';

        const align =
            col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

        const cursor = col.sortable
            ? 'cursor-pointer select-none hover:text-primary transition-colors'
            : '';

        return `${base} ${align} ${cursor} ${col.width ?? ''}`.trim();
    }

    getCellClass(col: TableColumn): string {
        const align =
            col.align === 'right'
                ? 'text-right'
                : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

        const wrap = col.wrap ? 'whitespace-normal' : 'whitespace-nowrap';

        return `px-4 py-4 text-form-label ${align} ${wrap}`;
    }

    getActionClass(color?: string): string {
        const map: Record<string, string> = {
            primary: 'text-primary hover:bg-primary hover:text-black',
            secondary: 'text-secondary hover:bg-secondary hover:text-white',
            info: 'text-info hover:bg-info hover:text-black',
            success: 'text-success hover:bg-success hover:text-white',
            error: 'text-error hover:bg-error hover:text-white',
        };

        return map[color ?? ''];
    }

    isActionHidden(action: TableAction, row: any): boolean {
        if (!action.hidden) return false;
        return action.hidden(row);
    }
}