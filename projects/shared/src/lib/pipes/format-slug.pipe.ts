import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'formatText',
    standalone: true,
})
export class FormatTextPipe implements PipeTransform {
    transform(value?: string): string {
        if (!value) return '-';

        return value
            .replace(/&/g, ' & ')   // "art&culture" → "art & culture"
            .replace(/-/g, ' ')     // "food-drink" → "food drink"
            .replace(/\s+/g, ' ')   // collapse any double spaces
            .trim();
    }
}