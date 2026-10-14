import { Summary } from '../../api/models';
import { kpiChange, kpiTiles } from './kpis';

const window = { start: '2026-09-14', end: '2026-10-13', timezone: 'Asia/Kolkata' };

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    window,
    previousWindow: { ...window, start: '2026-08-15', end: '2026-09-13' },
    team: 'SRE',
    alerts: { value: 48, previous: 40, changePct: 20 },
    mttaMinutes: { value: 4.5, previous: 6, changePct: -25 },
    mttrMinutes: { value: 95, previous: 95, changePct: 0 },
    afterHoursPct: { value: 30, previous: 20, changePct: 50 },
    escalationRatePct: { value: 5, previous: null, changePct: null },
    gini: { value: 0.32, previous: 0.28, changePct: 14.3 },
    fairnessLabel: 'MODERATE',
    highRiskEngineers: { value: 1, previous: 0, changePct: null },
    scores: { available: true, reason: null },
    ...overrides,
  };
}

describe('KPI tiles', () => {
  it('marks a rise as bad and a fall as good', () => {
    expect(kpiChange('count', { value: 48, previous: 40, changePct: 20 })).toEqual({
      text: '+20%',
      direction: 'up',
      tone: 'bad',
    });
    expect(kpiChange('minutes', { value: 4.5, previous: 6, changePct: -25 })).toEqual({
      text: '−25%',
      direction: 'down',
      tone: 'good',
    });
  });

  it('changes percentages and the Gini by points', () => {
    expect(kpiChange('pct', { value: 30, previous: 20, changePct: 50 })?.text).toBe('+10 pts');
    expect(kpiChange('gini', { value: 0.32, previous: 0.28, changePct: 14.3 })?.text).toBe('+0.04');
  });

  it('counts up from zero instead of a percentage', () => {
    expect(kpiChange('count', { value: 3, previous: 0, changePct: null })?.text).toBe('+3');
  });

  it('has no change without a previous figure, and says so when nothing moved', () => {
    expect(kpiChange('pct', { value: 5, previous: null, changePct: null })).toBeNull();
    expect(kpiChange('minutes', { value: 95, previous: 95, changePct: 0 })).toEqual({
      text: 'No change',
      direction: 'flat',
      tone: 'neutral',
    });
  });

  it('builds every tile, scores included', () => {
    const tiles = kpiTiles(summary());
    expect(tiles.map((t) => t.id)).toEqual([
      'alerts',
      'mtta',
      'mttr',
      'after-hours',
      'escalations',
      'gini',
      'high-risk',
    ]);
    const gini = tiles.find((t) => t.id === 'gini')!;
    expect(gini.value).toBe('0.32');
    expect(gini.note).toBe('Moderate');
    expect(tiles[2].value).toBe('1 h 35 min');
    expect(tiles[0].previous).toBe('Previous period: 40');
  });

  it('explains missing scores', () => {
    const tiles = kpiTiles(
      summary({
        gini: null,
        fairnessLabel: null,
        highRiskEngineers: null,
        scores: { available: false, reason: 'SEVERAL_TEAMS' },
      }),
    );
    const gini = tiles.find((t) => t.id === 'gini')!;
    expect(gini.value).toBe('–');
    expect(gini.note).toBe('Pick one team to see scores');
    expect(tiles.some((t) => t.id === 'high-risk')).toBe(false);
  });

  it('says when the Gini averages several teams', () => {
    const gini = kpiTiles(summary(), 3).find((t) => t.id === 'gini')!;
    expect(gini.note).toBe('Moderate · average of 3 teams');
  });

  it('leaves out the high-risk count for an engineer', () => {
    const tiles = kpiTiles(summary({ highRiskEngineers: null }));
    expect(tiles.some((t) => t.id === 'high-risk')).toBe(false);
    expect(tiles.some((t) => t.id === 'gini')).toBe(true);
  });
});
