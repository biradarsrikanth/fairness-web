import {
  DEFAULT_FILTER,
  addDays,
  fromLocalDate,
  isIsoDay,
  matchingPreset,
  parseFilter,
  presetRange,
  teamOptions,
  toApiParams,
  toLocalDate,
  toQueryParams,
  todayIn,
} from './analytics-filter';

describe('analytics filter', () => {
  it('reads a complete filter from the URL', () => {
    expect(
      parseFilter({ team: 'SRE', start: '2026-09-01', end: '2026-09-30', granularity: 'week' }),
    ).toEqual({ team: 'SRE', start: '2026-09-01', end: '2026-09-30', granularity: 'week' });
  });

  it('falls back to the defaults for values it cannot use', () => {
    expect(parseFilter({})).toEqual(DEFAULT_FILTER);
    expect(parseFilter({ team: '  ', granularity: 'hour' })).toEqual(DEFAULT_FILTER);
    // Not a real day, half a range, or a range backwards
    expect(parseFilter({ start: '2026-02-30', end: '2026-03-10' })).toEqual(DEFAULT_FILTER);
    expect(parseFilter({ start: '2026-03-01' })).toEqual(DEFAULT_FILTER);
    expect(parseFilter({ start: '2026-03-10', end: '2026-03-01' })).toEqual(DEFAULT_FILTER);
    // Longer than the gateway accepts
    expect(parseFilter({ start: '2000-01-01', end: '2026-01-01' })).toEqual(DEFAULT_FILTER);
  });

  it('accepts a one-day range', () => {
    expect(parseFilter({ start: '2026-03-01', end: '2026-03-01' }).start).toBe('2026-03-01');
  });

  it('checks calendar days', () => {
    expect(isIsoDay('2024-02-29')).toBe(true);
    expect(isIsoDay('2026-02-29')).toBe(false);
    expect(isIsoDay('2026-1-05')).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });

  it('removes defaults from the URL but leaves them out of API calls', () => {
    const filter = { ...DEFAULT_FILTER, team: 'SRE' };
    expect(toQueryParams(filter)).toEqual({
      team: 'SRE',
      start: null,
      end: null,
      granularity: null,
    });
    expect(toApiParams(filter)).toEqual({ team: 'SRE' });
  });

  it('works out preset ranges and recognises them', () => {
    expect(presetRange(30, '2026-10-13')).toEqual({ start: '2026-09-14', end: '2026-10-13' });
    expect(matchingPreset('2026-09-14', '2026-10-13', '2026-10-13')?.label).toBe('Last 30 days');
    expect(matchingPreset('2026-09-14', '2026-10-12', '2026-10-13')).toBeNull();
  });

  it('counts days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('takes today from the analytics timezone', () => {
    // 20:00 UTC on 13 Oct is already 14 Oct in India
    const now = new Date('2026-10-13T20:00:00Z');
    expect(todayIn('Asia/Kolkata', now)).toBe('2026-10-14');
    expect(todayIn('UTC', now)).toBe('2026-10-13');
  });

  it('converts datepicker dates without shifting the day', () => {
    expect(fromLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(fromLocalDate(toLocalDate('2026-10-31'))).toBe('2026-10-31');
  });

  describe('team options', () => {
    const teams = [
      { id: 2, name: 'Platform' },
      { id: 1, name: 'Data' },
    ];

    it('lets an admin look across all teams', () => {
      expect(teamOptions('ADMIN', teams)).toEqual([
        { value: null, label: 'All teams' },
        { value: 'Data', label: 'Data' },
        { value: 'Platform', label: 'Platform' },
      ]);
    });

    it('lets a manager of several teams look across them', () => {
      expect(teamOptions('MANAGER', teams)[0]).toEqual({ value: null, label: 'All my teams' });
    });

    it('gives someone with one team just that team', () => {
      expect(teamOptions('ENGINEER', [teams[1]])).toEqual([{ value: null, label: 'Data' }]);
      expect(teamOptions('MANAGER', [teams[0]])).toEqual([{ value: null, label: 'Platform' }]);
    });
  });
});
