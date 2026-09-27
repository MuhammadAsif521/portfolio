import { NgClass, NgStyle } from '@angular/common';
import { ChangeDetectorRef, Component, inject, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

type IconNode = [string, Record<string, string>];
 
let lucideModule: Promise<Record<string, IconNode[]>> | null = null;
function loadLucide(): Promise<Record<string, IconNode[]>> {
    return (lucideModule ??= import('lucide') as unknown as Promise<Record<string, IconNode[]>>);
}

@Component({
    selector: 'i-lucide',
    templateUrl: './icon-component.html',
    styleUrl: './icon-component.scss',
    standalone: true,
    imports: [NgStyle, NgClass],
})
export class IconComponent implements OnChanges {
    private sanitizer = inject(DomSanitizer);
    private cdr = inject(ChangeDetectorRef);

    @Input() name = '';
    @Input() color = 'currentColor';
    @Input() stroke: number | string = 2;
    @Input() fill: string = 'none';
    /** Pixels (e.g. [size]="20") or a named size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'. */
    @Input() size: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 16;

    svgIcon: SafeHtml = '';

    resolvedColor = 'currentColor';
    sizeClass = '';
    /** Numeric sizes are applied inline so the box always matches the SVG. */
    pixelSize: number | null = 16;

    /** Theme names accepted by `color` (e.g. color="primary"), resolved to the design tokens. */
    private readonly themeColorMap: Record<string, string> = {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        'on-primary': 'var(--on-primary)',
        heading: 'var(--heading)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        success: 'var(--success)',
        info: 'var(--info)',
        white: '#ffffff',
    };

    ngOnChanges(): void {
        this.resolvedColor = this.resolveThemeColor(this.color);
        this.sizeClass = this.resolveSizeClass(this.size);
        this.pixelSize = typeof this.size === 'number' ? this.size : null;

        if (!this.name) {
            this.svgIcon = '';
            return;
        }

        const name = this.name; 
        loadLucide().then(icons => {
            if (this.name !== name) return;
            this.svgIcon = this.renderIcon(name, icons);
            this.cdr.markForCheck();
        });
    }

    private resolveThemeColor(color: string): string {
        if (!color) return 'currentColor';

        const normalizedColor = color.trim();

        return this.themeColorMap[normalizedColor] ?? normalizedColor;
    }

    private resolveSizeClass(size: IconComponent['size']): string {
        if (typeof size === 'number') {
            return '';
        }

        return `icon-${size}`;
    }

    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    private renderIcon(name: string, icons: Record<string, IconNode[]>): SafeHtml {
        const key = this.toPascalCase(name);
        const children = icons[key];

        if (!children) {
            console.warn(`[IconComponent] Icon "${name}" not found`);
            return '';
        }

        const innerHtml = children
            .map(([tag, attrs]) => {
                const attrStr = Object.entries(attrs)
                    .map(([key, value]) => `${key}="${value}"`)
                    .join(' ');

                return `<${tag} ${attrStr} />`;
            })
            .join('');

        const width = typeof this.size === 'number' ? this.size : 24;
        const height = typeof this.size === 'number' ? this.size : 24;

        const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 24 24"
        fill="${this.fill}"
        stroke="currentColor"
        stroke-width="${this.stroke}"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        ${innerHtml}
      </svg>
    `;

        return this.sanitizer.bypassSecurityTrustHtml(svg);
    }
}