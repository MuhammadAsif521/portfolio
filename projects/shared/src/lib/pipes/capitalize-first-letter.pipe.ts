import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'capitalizeFirstLetter',
  standalone:true
})
export class CapitalizeFirstLetterPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;

    return value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
