import { Heatmap, TimeSeries, TrendPeriod } from '../../../api/models';
import {
  alertsOverTimeOption,
  escapeHtml,
  giniTrendOption,
  heatmapOption,
  loadShareHeight,
  loadShareOption,
  loadShareRows,
  periodLabel,
  timeOfDayOption,
} from './chart-options';
import { CONSOLE, EMPTY_CELL, PAPER, SEVERITY_COLORS } from './palette';

const window = { start: '2026-09-01', end: '2026-09-30', timezone: 'Asia/Kolkata' };
const none = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, other: 0 };

// The options are loosely typed (EChartsCoreOption); the tests read them as plain objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

describe('chart options', () => {
  describe('alerts over time', () => {
    const series: TimeSeries = {
      window,
      granularity: 'week',
      team: 'SRE',
      points: [
        { start: '2026-10-05', total: 3, bySeverity: { ...none, p1: 1, p3: 2 } },
        { start: '2026-10-12', total: 1, bySeverity: { ...none, p1: 1 } },
      ],
    };

    it('stacks only the severities that occur, each in its own fixed color', () => {
      const option: Loose = alertsOverTimeOption(series);
      expect(option.series.map((s: Loose) => s.name)).toEqual(['P1', 'P3']);
      expect(option.series[1].color).toBe(SEVERITY_COLORS.p3);
      expect(option.series[0].stack).toBe(option.series[1].stack);
      expect(option.xAxis.data).toEqual(['5 Oct', '12 Oct']);
    });

    it('rounds only the top segment of each bar', () => {
      const option: Loose = alertsOverTimeOption(series);
      const [p1, p3] = option.series;
      // Week 1: P3 is on top; week 2 only has P1
      expect(p1.data[0].itemStyle).toBeUndefined();
      expect(p3.data[0].itemStyle.borderRadius).toEqual([2, 2, 0, 0]);
      expect(p1.data[1].itemStyle.borderRadius).toEqual([2, 2, 0, 0]);
    });

    it('lists the period in the tooltip with its total', () => {
      const option: Loose = alertsOverTimeOption(series);
      const html: string = option.tooltip.formatter([{ dataIndex: 0 }]);
      expect(html).toContain('5 Oct');
      expect(html).toContain('Total');
      expect(html).not.toContain('P2');
    });
  });

  it('labels months by month', () => {
    expect(periodLabel('2026-10-01', 'month')).toBe('Oct 2026');
    expect(periodLabel('2026-10-05', 'week')).toBe('5 Oct');
  });

  it('draws the Gini against the label thresholds, with low-confidence points hollow', () => {
    const periods: TrendPeriod[] = [
      {
        start: '2026-09-07T00:00:00+05:30',
        end: '2026-09-14T00:00:00+05:30',
        label: '2026-W37',
        gini: 0.31,
        alertCount: 30,
        averageBurnout: 22,
        highRiskCount: 0,
        confidence: 'NORMAL',
      },
      {
        start: '2026-09-14T00:00:00+05:30',
        end: '2026-09-21T00:00:00+05:30',
        label: '2026-W38',
        gini: 0.82,
        alertCount: 4,
        averageBurnout: null,
        highRiskCount: 1,
        confidence: 'LOW',
      },
    ];
    // Midnight in India is the evening before in UTC; the labels must still name the Monday
    const option: Loose = giniTrendOption(periods, 'week', 'Asia/Kolkata');
    expect(option.xAxis.data).toEqual(['7 Sept', '14 Sept'].map((l) => l.replace('Sept', sep())));
    expect(option.series[0].data.map((d: Loose) => d.symbol)).toEqual(['circle', 'emptyCircle']);
    expect(option.series[0].markLine.data.map((d: Loose) => d.yAxis)).toEqual([0.2, 0.4, 0.6]);
    expect(option.yAxis.max).toBe(0.9);
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('indicative only');
  });

  it('sorts load share largest first, with an even-share line, and escapes names', () => {
    const engineer = {
      team: 'SRE',
      escalationsReceived: 0,
      load: 1,
      oncallHours: null,
      loadPerOncallHour: null,
    };
    const option: Loose = loadShareOption([
      { ...engineer, engineerId: 1, name: 'Asha', sharePct: 25, alertCount: 5 },
      { ...engineer, engineerId: 2, name: '<b>Ravi</b>', sharePct: 75, alertCount: 15 },
    ]);
    expect(option.yAxis.data).toEqual(['<b>Ravi</b>', 'Asha']);
    expect(option.series[0].data[0]).toEqual({ value: 75, engineerId: 2 });
    expect(option.series[0].markLine.data).toEqual([{ xAxis: 50 }]);
    expect(option.tooltip.formatter([{ dataIndex: 0 }])).toContain('&lt;b&gt;Ravi&lt;/b&gt;');
  });

  it('maps heatmap cells to hour and weekday, empty cells out of the color range', () => {
    const heatmap: Heatmap = {
      window,
      team: null,
      max: 4,
      cells: [
        { dayOfWeek: 1, hour: 0, count: 0 },
        { dayOfWeek: 7, hour: 23, count: 4 },
      ],
    };
    const option: Loose = heatmapOption(heatmap);
    expect(option.series[0].data).toEqual([
      [0, 0, 0],
      [23, 6, 4],
    ]);
    expect(option.visualMap.min).toBe(1);
    expect(option.visualMap.outOfRange.color).toBe(EMPTY_CELL);
    expect(option.tooltip.formatter({ value: [23, 6, 4] })).toContain('Sun 23:00–00:00');
  });

  it('orders the parts of the day as a day goes', () => {
    const option: Loose = timeOfDayOption({ night: 4, morning: 1, afternoon: 2, evening: 3 });
    expect(option.xAxis.data).toEqual(['Morning', 'Afternoon', 'Evening', 'Night']);
    expect(option.series[0].data.map((d: Loose) => d.value)).toEqual([1, 2, 3, 4]);
    // Night pages in the highlight colour
    expect(option.series[0].data[3].itemStyle.color).toBe(PAPER.highlight);
    expect(option.series[0].data[0].itemStyle.color).toBe(PAPER.series1);
  });

  describe('load share past the limit', () => {
    const engineers = Array.from({ length: 20 }, (_, i) => ({
      engineerId: i + 1,
      name: `Engineer ${i + 1}`,
      team: 'SRE',
      sharePct: i === 0 ? 43 : 3,
      alertCount: i === 0 ? 86 : 6,
      escalationsReceived: 0,
      load: 1,
      oncallHours: null,
      loadPerOncallHour: null,
    }));

    it('draws the top engineers and folds the rest into one bar', () => {
      const rows = loadShareRows(engineers, 12);
      expect(rows).toHaveLength(13);
      expect(rows[12]).toMatchObject({ name: '8 others', sharePct: 24, alertCount: 48, others: 8 });
      expect(rows[12].engineerId).toBeUndefined();
      expect(loadShareHeight(engineers.length, 12)).toBe(13 * 28 + 48);
    });

    it('draws one leftover engineer as themselves', () => {
      expect(loadShareRows(engineers.slice(0, 13), 12).map((r) => r.name)).not.toContain(
        '1 others',
      );
      expect(loadShareRows(engineers.slice(0, 13), 12)).toHaveLength(13);
    });

    it('highlights anyone carrying more than twice an even share', () => {
      const option: Loose = loadShareOption(engineers, CONSOLE, 12);
      expect(option.series[0].data[0].itemStyle.color).toBe(CONSOLE.highlight);
      expect(option.series[0].data[1].itemStyle).toBeUndefined();
      // The "others" bar is neutral and not a link to an engineer
      expect(option.series[0].data[12]).toEqual({
        value: 24,
        itemStyle: { color: CONSOLE.ink.axis },
      });
    });
  });

  it('draws every chart in the palette it is given', () => {
    const series: TimeSeries = {
      window,
      team: null,
      granularity: 'day',
      points: [{ start: '2026-10-01', total: 1, bySeverity: { ...none, p1: 1 } }],
    };
    const option: Loose = alertsOverTimeOption(series, CONSOLE);
    expect(option.series[0].color).toBe(CONSOLE.severity.p1);
    expect(option.series[0].itemStyle.borderColor).toBe(CONSOLE.surface);
    expect(option.tooltip.backgroundColor).toBe(CONSOLE.tooltip.background);
  });

  it('escapes HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

/** How this runtime's ICU abbreviates September in en-GB ("Sep" or "Sept"). */
function sep(): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
    new Date('2026-09-01T00:00:00Z'),
  );
}
