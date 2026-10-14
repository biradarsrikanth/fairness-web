import {
  formatAgo,
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

describe('formatAgo', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');

  it('rounds down to whole minutes, hours and days', () => {
    expect(formatAgo('2026-10-14T11:59:30Z', now)).toBe('just now');
    expect(formatAgo('2026-10-14T11:56:00Z', now)).toBe('4 min ago');
    expect(formatAgo('2026-10-14T09:00:00Z', now)).toBe('3 h ago');
    expect(formatAgo('2026-10-12T11:00:00Z', now)).toBe('2 d ago');
  });

  it('takes epoch milliseconds and treats the future as now', () => {
    expect(formatAgo(now - 120_000, now)).toBe('2 min ago');
    expect(formatAgo(now + 60_000, now)).toBe('just now');
  });

  it('shows a dash for an unreadable time', () => {
    expect(formatAgo('not a time', now)).toBe('–');
  });
});
