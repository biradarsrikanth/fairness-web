import { TestBed } from '@angular/core/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDateRangeInputHarness } from '@angular/material/datepicker/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { AnalyticsFilter, DEFAULT_FILTER, todayIn } from './analytics-filter';
import { FilterBar } from './filter-bar';

describe('FilterBar', () => {
  const window = { start: '2026-09-14', end: '2026-10-13', timezone: 'UTC' };

  async function setup(inputs: {
    filter?: AnalyticsFilter;
    teams?: { value: string | null; label: string }[];
  }) {
    const fixture = TestBed.createComponent(FilterBar);
    fixture.componentRef.setInput('filter', inputs.filter ?? DEFAULT_FILTER);
    fixture.componentRef.setInput('window', window);
    fixture.componentRef.setInput('teams', inputs.teams ?? []);
    const emitted: AnalyticsFilter[] = [];
    fixture.componentInstance.changed.subscribe((filter) => emitted.push(filter));
    await fixture.whenStable();
    return { fixture, emitted, loader: TestbedHarnessEnvironment.loader(fixture) };
  }

  it('offers a team choice only when there is one', async () => {
    const single = await setup({ teams: [{ value: null, label: 'SRE' }] });
    expect(await single.loader.getAllHarnesses(MatSelectHarness)).toHaveLength(1);

    const several = await setup({
      teams: [
        { value: null, label: 'All teams' },
        { value: 'SRE', label: 'SRE' },
      ],
    });
    const [team] = await several.loader.getAllHarnesses(MatSelectHarness);
    // "All teams" (no team in the URL) shows as selected, not as an empty field
    expect(await team.getValueText()).toBe('All teams');
    await team.open();
    await team.clickOptions({ text: 'SRE' });
    expect(several.emitted).toEqual([{ ...DEFAULT_FILTER, team: 'SRE' }]);
    await team.open();
    await team.clickOptions({ text: 'All teams' });
    expect(several.emitted[1]).toEqual(DEFAULT_FILTER);
  });

  it('turns a preset into dates ending today', async () => {
    const { loader, emitted } = await setup({});
    const [period] = await loader.getAllHarnesses(MatSelectHarness);
    await period.open();
    await period.clickOptions({ text: 'Last 7 days' });
    const today = todayIn('UTC');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].end).toBe(today);
    expect(emitted[0].start).toBe(
      new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10),
    );
  });

  it('drops daily points for ranges too long to draw them', async () => {
    const { loader, emitted } = await setup({ filter: { ...DEFAULT_FILTER, granularity: 'day' } });
    const range = await loader.getHarness(MatDateRangeInputHarness);
    await (await range.getStartInput()).setValue('01/01/2025');
    await (await range.getEndInput()).setValue('01/10/2026');
    expect(emitted.at(-1)).toEqual({
      ...DEFAULT_FILTER,
      start: '2025-01-01',
      end: '2026-10-01',
      granularity: null,
    });
  });

  it('only offers daily points for ranges short enough', async () => {
    const long = await setup({
      filter: { ...DEFAULT_FILTER, start: '2025-01-01', end: '2026-10-01' },
    });
    const day = await long.loader.getHarness(MatButtonToggleHarness.with({ text: 'Day' }));
    expect(await day.isDisabled()).toBe(true);
  });

  it('sets the granularity, Auto clearing it', async () => {
    const { loader, emitted } = await setup({ filter: { ...DEFAULT_FILTER, granularity: 'week' } });
    await (await loader.getHarness(MatButtonToggleHarness.with({ text: 'Month' }))).check();
    await (await loader.getHarness(MatButtonToggleHarness.with({ text: 'Auto' }))).check();
    expect(emitted.map((f) => f.granularity)).toEqual(['month', null]);
  });
});
