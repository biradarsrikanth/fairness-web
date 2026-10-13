import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { provideDayFirstDates } from './day-first-dates';

describe('DayFirstDateAdapter', () => {
  let adapter: DateAdapter<Date>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDayFirstDates() });
    adapter = TestBed.inject(DateAdapter);
  });

  it('reads typed dates day first', () => {
    const date = adapter.parse('01/10/2026', null)!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 1]);
    expect(adapter.parse('13.10.2026', null)!.getDate()).toBe(13);
  });

  it('rejects days that do not exist', () => {
    expect(adapter.isValid(adapter.parse('31/02/2026', null)!)).toBe(false);
  });

  it('shows dates day first', () => {
    expect(
      adapter.format(new Date(2026, 9, 1), { year: 'numeric', month: '2-digit', day: '2-digit' }),
    ).toBe('01/10/2026');
  });
});
