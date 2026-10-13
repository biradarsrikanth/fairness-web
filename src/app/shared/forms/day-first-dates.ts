import { Injectable, Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MAT_NATIVE_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';

const DAY_FIRST = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * Native dates shown as 13/10/2026 (en-GB) and read back the same way: the native adapter alone parses typed
 * dates with Date.parse, which reads 01/10/2026 as 10 January.
 */
@Injectable()
export class DayFirstDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const match = DAY_FIRST.exec(value.trim());
      if (match) {
        const [day, month, year] = match.slice(1).map(Number);
        const date = new Date(year, month - 1, day);
        // new Date() rolls 31/02 over into March; that's a typo, not a date
        return date.getMonth() === month - 1 && date.getDate() === day ? date : this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}

export function provideDayFirstDates(): Provider[] {
  return [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: DayFirstDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ];
}
