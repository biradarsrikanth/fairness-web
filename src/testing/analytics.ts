import { Component, input, output } from '@angular/core';
import { EngineerReport, Snapshot } from '../app/api/models';

const window = { start: '2026-09-14', end: '2026-10-13', timezone: 'Asia/Kolkata' };
const none = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, other: 0 };

const burnout = {
  engineerId: 3,
  name: 'Asha Rao',
  team: 'SRE',
  score: 64,
  risk: 'HIGH',
  alertCount: 12,
  escalationsReceived: 1,
  nightPct: 40,
  eveningPct: 20,
  weekendPct: 25,
  trendRatio: 1.5,
  medianAckMinutes: 4,
  oncallHours: 120,
  components: { exposure: 0.7, relativeLoad: 0.6, trend: 0.5 },
};

/** A snapshot as the gateway returns it for one team over the default 30 days. */
export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    summary: {
      window,
      previousWindow: { ...window, start: '2026-08-15', end: '2026-09-13' },
      team: 'SRE',
      alerts: { value: 20, previous: 16, changePct: 25 },
      mttaMinutes: { value: 5, previous: 5, changePct: 0 },
      mttrMinutes: { value: 42, previous: 60, changePct: -30 },
      afterHoursPct: { value: 35, previous: 30, changePct: 16.7 },
      escalationRatePct: { value: 5, previous: 10, changePct: -50 },
      gini: { value: 0.31, previous: 0.25, changePct: 24 },
      fairnessLabel: 'MODERATE',
      highRiskEngineers: { value: 1, previous: 0, changePct: null },
      scores: { available: true, reason: null },
    },
    alertsOverTime: {
      window,
      team: 'SRE',
      granularity: 'week',
      points: [
        { start: '2026-09-14', total: 12, bySeverity: { ...none, p1: 2, p3: 10 } },
        { start: '2026-09-21', total: 8, bySeverity: { ...none, p3: 8 } },
      ],
    },
    heatmap: {
      window,
      team: 'SRE',
      max: 3,
      cells: [{ dayOfWeek: 2, hour: 23, count: 3 }],
    },
    topServices: {
      window,
      team: 'SRE',
      services: [
        { serviceId: 1, name: 'payments-api', alertCount: 9, mttrMinutes: 30, afterHoursPct: 44 },
      ],
    },
    trend: {
      window,
      team: 'SRE',
      granularity: 'week',
      scores: { available: true, reason: null },
      periods: [
        {
          start: '2026-09-14',
          end: '2026-09-20',
          label: '2026-W38',
          gini: 0.3,
          alertCount: 12,
          averageBurnout: 30,
          highRiskCount: 1,
          confidence: 'NORMAL',
        },
      ],
    },
    loadShare: [
      {
        engineerId: 3,
        name: 'Asha Rao',
        team: 'SRE',
        alertCount: 12,
        escalationsReceived: 1,
        load: 30,
        sharePct: 60,
        oncallHours: 120,
        loadPerOncallHour: 0.25,
      },
      {
        engineerId: 4,
        name: 'Ravi Kumar',
        team: 'SRE',
        alertCount: 8,
        escalationsReceived: 0,
        load: 20,
        sharePct: 40,
        oncallHours: 120,
        loadPerOncallHour: 0.17,
      },
    ],
    burnout: [burnout, { ...burnout, engineerId: 4, name: 'Ravi Kumar', score: 20, risk: 'LOW' }],
    ...overrides,
  };
}

export function engineerReport(overrides: Partial<EngineerReport> = {}): EngineerReport {
  return {
    engineer: { engineerId: 3, name: 'Asha Rao', team: 'SRE' },
    active: true,
    window,
    teamSharePct: 60,
    timeOfDay: { morning: 2, afternoon: 3, evening: 3, night: 4 },
    burnout,
    ...overrides,
  };
}

/** Stands in for the ECharts canvas, which jsdom can't draw. */
@Component({ selector: 'app-chart', template: '<div class="chart-stub">{{ label() }}</div>' })
export class ChartStub {
  readonly options = input<unknown>();
  readonly label = input('');
  readonly height = input(0);
  readonly itemClick = output<unknown>();
}
