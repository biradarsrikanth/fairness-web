import {
  formatCount,
  formatDay,
  formatInstant,
  formatMinutes,
  formatPct,
  formatRange,
  humanize,
} from './format';

describe('format', () => {
  it('shows ISO days as they are, whatever the browser timezone', () => {
    expect(formatDay('2026-10-01')).toBe('1 Oct 2026');
  });

  it('shortens ranges within a month or a year', () => {
    expect(formatRange('2026-10-01', '2026-10-30')).toBe('1–30 Oct 2026');
    expect(formatRange('2026-10-26', '2026-11-01')).toBe('26 Oct – 1 Nov 2026');
    expect(formatRange('2025-12-20', '2026-01-03')).toBe('20 Dec 2025 – 3 Jan 2026');
    expect(formatRange('2026-10-05', '2026-10-05')).toBe('5 Oct 2026');
  });

  it('shows instants in the given timezone', () => {
    expect(formatInstant('2026-10-13T17:11:00Z', 'Asia/Kolkata')).toBe('13 Oct 2026, 22:41');
  });

  it('picks a unit for durations', () => {
    expect(formatMinutes(0.5)).toBe('30 s');
    expect(formatMinutes(12.4)).toBe('12 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(65)).toBe('1 h 5 min');
    expect(formatMinutes(51 * 60)).toBe('2 d 3 h');
    expect(formatMinutes(null)).toBe('–');
  });

  it('keeps one decimal for small percentages', () => {
    expect(formatPct(2.46)).toBe('2.5%');
    expect(formatPct(35.4)).toBe('35%');
    expect(formatPct(undefined)).toBe('–');
  });

  it('groups thousands and humanizes enum values', () => {
    expect(formatCount(1234)).toBe('1,234');
    expect(humanize('ONCALL_ROTATION')).toBe('Oncall rotation');
  });
});
