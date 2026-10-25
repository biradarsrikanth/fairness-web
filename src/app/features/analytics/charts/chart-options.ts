import type { EChartsCoreOption } from 'echarts/core';
import {
  EngineerLoad,
  Heatmap,
  TimeOfDayCounts,
  TimeSeries,
  TrendPeriod,
} from '../../../api/models';
import { formatDayMonth, formatMonth, formatPct } from '../../../shared/format';
import { dayIn } from '../analytics-filter';
import { ChartPalette, FONT_FAMILY, MONO_FAMILY, PAPER } from './palette';

/*
 * ECharts options for the analytics charts. Each builder is a pure function of the gateway's data and the
 * palette of the current colour mode, so the charts are tested without drawing them. Every chart also has
 * a table view on the page; tooltips add detail but never hold the only copy of a value.
 */

export type SeverityKey = keyof ChartPalette['severity'];

export const SEVERITIES: readonly { key: SeverityKey; label: string }[] = [
  { key: 'p1', label: 'P1' },
  { key: 'p2', label: 'P2' },
  { key: 'p3', label: 'P3' },
  { key: 'p4', label: 'P4' },
  { key: 'p5', label: 'P5' },
  { key: 'other', label: 'No severity' },
];

/** Monday first, as the gateway numbers them (1 = Monday). */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The time-of-day buckets in the order of a day, with the scorer's hours. */
export const DAY_PARTS: readonly { key: keyof TimeOfDayCounts; label: string; hours: string }[] = [
  { key: 'morning', label: 'Morning', hours: '06:00–12:00' },
  { key: 'afternoon', label: 'Afternoon', hours: '12:00–18:00' },
  { key: 'evening', label: 'Evening', hours: '18:00–23:00' },
  { key: 'night', label: 'Night', hours: '23:00–06:00' },
];

/** Gini thresholds of the scorer's labels (docs/SCORING.md in the scorer). */
export const GINI_BANDS = [
  { from: 0.2, label: 'Moderate' },
  { from: 0.4, label: 'Unequal' },
  { from: 0.6, label: 'Critical' },
];

/** The load-share chart draws this many engineers; the rest share one "others" bar. */
export const LOAD_SHARE_LIMIT = 12;

/** A period by its first day: 14 Sep for days and weeks, Sep 2026 for months. */
export function periodLabel(start: string, granularity: string): string {
  return granularity === 'month' ? formatMonth(start) : formatDayMonth(start);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ---------- shared pieces, per palette ----------

function base(p: ChartPalette) {
  const textStyle = { fontFamily: FONT_FAMILY, color: p.ink.secondary, fontSize: 12 };
  const axisLabel = { color: p.ink.muted, fontFamily: MONO_FAMILY, fontSize: 10.5 };
  return {
    textStyle,
    axisLabel,
    tooltip: {
      backgroundColor: p.tooltip.background,
      borderColor: p.tooltip.border,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { fontFamily: FONT_FAMILY, color: p.ink.primary, fontSize: 12 },
      extraCssText: `box-shadow: ${p.tooltip.shadow}; border-radius: 4px;`,
    },
    categoryAxis: {
      type: 'category',
      axisLine: { lineStyle: { color: p.ink.axis } },
      axisTick: { show: false },
      axisLabel,
    },
    valueAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitLine: { lineStyle: { color: p.ink.grid, width: 1, type: 'solid' } },
    },
    shadowPointer: { type: 'shadow', shadowStyle: { color: p.hover } },
    heading: (text: string) =>
      `<div style="margin-bottom:4px;color:${p.ink.secondary};font-family:${MONO_FAMILY};font-size:11px;letter-spacing:0.04em">${escapeHtml(text)}</div>`,
  };
}

function row(marker: string, label: string, value: string): string {
  return (
    `<div style="display:flex;gap:12px;justify-content:space-between">` +
    `<span>${marker}${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
  );
}

function swatch(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:1px;margin-right:6px;background:${color}"></span>`;
}

/** Severities that occur in the series; the others stay out of the legend. Colors never move. */
export function severitiesIn(series: TimeSeries): typeof SEVERITIES {
  return SEVERITIES.filter((s) => series.points.some((p) => p.bySeverity[s.key] > 0));
}

/** Alerts per period, stacked by severity (P1 at the bottom). */
export function alertsOverTimeOption(
  series: TimeSeries,
  p: ChartPalette = PAPER,
): EChartsCoreOption {
  const b = base(p);
  const present = severitiesIn(series);
  const labels = series.points.map((point) => periodLabel(point.start, series.granularity));
  // Only the top segment of each stack gets rounded corners
  const topOf = series.points.map((point) => {
    for (let i = present.length - 1; i >= 0; i--) {
      if (point.bySeverity[present[i].key] > 0) return present[i].key;
    }
    return null;
  });
  return {
    textStyle: b.textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    legend: {
      show: present.length > 1,
      top: 0,
      left: 0,
      icon: 'rect',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { ...b.textStyle, fontFamily: MONO_FAMILY, fontSize: 11 },
    },
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: b.shadowPointer,
      formatter: (params: { dataIndex: number }[]) => {
        const index = params[0]?.dataIndex ?? 0;
        const point = series.points[index];
        const rows = present
          .filter((s) => point.bySeverity[s.key] > 0)
          .map((s) => row(swatch(p.severity[s.key]), s.label, String(point.bySeverity[s.key])));
        return b.heading(labels[index]) + rows.join('') + row('', 'Total', String(point.total));
      },
    },
    xAxis: { ...b.categoryAxis, data: labels },
    yAxis: { ...b.valueAxis, minInterval: 1 },
    series: present.map((s) => ({
      name: s.label,
      type: 'bar',
      stack: 'alerts',
      barMaxWidth: 28,
      color: p.severity[s.key],
      emphasis: { focus: 'series' },
      itemStyle: { borderColor: p.surface, borderWidth: 1 },
      data: series.points.map((point, i) => ({
        value: point.bySeverity[s.key],
        itemStyle: topOf[i] === s.key ? { borderRadius: [2, 2, 0, 0] } : undefined,
      })),
    })),
  };
}

/** A trend period (it starts at midnight in the scorer's timezone) by its first day. */
export function trendPeriodLabel(
  period: TrendPeriod,
  granularity: string,
  timeZone: string,
): string {
  return periodLabel(dayIn(period.start, timeZone), granularity);
}

/** Gini per period, against the label thresholds; low-confidence periods as hollow points. */
export function giniTrendOption(
  periods: readonly TrendPeriod[],
  granularity: string,
  timeZone: string,
  p: ChartPalette = PAPER,
): EChartsCoreOption {
  const b = base(p);
  const labels = periods.map((period) => trendPeriodLabel(period, granularity, timeZone));
  const highest = Math.max(0, ...periods.map((period) => period.gini));
  return {
    textStyle: b.textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 72, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: p.ink.axis } },
      formatter: (params: { dataIndex: number }[]) => {
        const period = periods[params[0]?.dataIndex ?? 0];
        const burnout =
          period.averageBurnout === null || period.averageBurnout === undefined
            ? '–'
            : period.averageBurnout.toFixed(0);
        return (
          b.heading(labels[params[0]?.dataIndex ?? 0]) +
          row(swatch(p.series1), 'Gini', period.gini.toFixed(2)) +
          row('', 'Alerts', String(period.alertCount)) +
          row('', 'Average burnout', burnout) +
          row('', 'High burnout risk', String(period.highRiskCount)) +
          (period.confidence === 'LOW'
            ? `<div style="margin-top:4px;color:${p.ink.secondary}">Few alerts or engineers: indicative only</div>`
            : '')
        );
      },
    },
    xAxis: { ...b.categoryAxis, boundaryGap: false, data: labels },
    yAxis: {
      ...b.valueAxis,
      min: 0,
      max: Math.min(1, Math.max(0.7, Math.ceil((highest + 0.05) * 10) / 10)),
      interval: 0.2,
      axisLabel: { ...b.axisLabel, formatter: (v: number) => v.toFixed(1) },
    },
    series: [
      {
        name: 'Gini',
        type: 'line',
        color: p.series1,
        lineStyle: { width: 2 },
        symbolSize: 8,
        itemStyle: { borderColor: p.surface, borderWidth: 2 },
        areaStyle: { color: p.series1, opacity: 0.07 },
        data: periods.map((period) => ({
          value: period.gini,
          symbol: period.confidence === 'LOW' ? 'emptyCircle' : 'circle',
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: p.ink.axis, type: 'dashed', width: 1 },
          label: { position: 'end', color: p.ink.muted, fontFamily: MONO_FAMILY, fontSize: 10.5 },
          data: GINI_BANDS.map((band) => ({ yAxis: band.from, label: { formatter: band.label } })),
        },
      },
    ],
  };
}

interface LoadRow {
  readonly name: string;
  readonly sharePct: number;
  readonly alertCount: number;
  readonly oncallHours: number | null;
  readonly engineerId?: number;
  /** For the "others" bar: how many engineers it stands for */
  readonly others?: number;
}

/** The engineers the chart draws, largest share first: the top ones, then everyone else as one row. */
export function loadShareRows(
  engineers: readonly EngineerLoad[],
  limit = LOAD_SHARE_LIMIT,
): LoadRow[] {
  const rows: LoadRow[] = [...engineers]
    .sort((a, b) => b.sharePct - a.sharePct)
    .map((e) => ({
      name: e.name,
      sharePct: e.sharePct,
      alertCount: e.alertCount,
      oncallHours: e.oncallHours ?? null,
      engineerId: e.engineerId,
    }));
  const rest = rows.slice(limit);
  // One engineer left over is drawn as themselves, not as "1 other"
  if (rest.length <= 1) return rows;
  const share = rest.reduce((sum, e) => sum + e.sharePct, 0);
  return [
    ...rows.slice(0, limit),
    {
      name: `${rest.length} others`,
      sharePct: Math.round(share * 10) / 10,
      alertCount: rest.reduce((sum, e) => sum + e.alertCount, 0),
      oncallHours: null,
      others: rest.length,
    },
  ];
}

/**
 * Each engineer's share of the load, largest first, against an even split. Anyone carrying more than twice
 * an even share is drawn in the highlight colour; past the limit, the rest share one neutral bar.
 */
export function loadShareOption(
  engineers: readonly EngineerLoad[],
  p: ChartPalette = PAPER,
  limit = LOAD_SHARE_LIMIT,
): EChartsCoreOption {
  const b = base(p);
  const rows = loadShareRows(engineers, limit);
  const even = engineers.length > 0 ? 100 / engineers.length : 0;
  const color = (r: LoadRow) =>
    r.others !== undefined
      ? p.ink.axis
      : engineers.length > 2 && r.sharePct > even * 2
        ? p.highlight
        : null;
  return {
    textStyle: b.textStyle,
    aria: { enabled: true },
    // Room at the top for the even-share label
    grid: { left: 8, right: 64, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: b.shadowPointer,
      formatter: (params: { dataIndex: number }[]) => {
        const r = rows[params[0]?.dataIndex ?? 0];
        return (
          b.heading(r.others !== undefined ? `${r.others} other engineers together` : r.name) +
          row(swatch(color(r) ?? p.series1), 'Share of load', formatPct(r.sharePct)) +
          row('', 'Alerts', String(r.alertCount)) +
          (r.oncallHours === null
            ? ''
            : row('', 'On-call hours', String(Math.round(r.oncallHours))))
        );
      },
    },
    xAxis: {
      ...b.valueAxis,
      min: 0,
      axisLabel: { ...b.axisLabel, formatter: (v: number) => `${v}%` },
    },
    yAxis: {
      ...b.categoryAxis,
      inverse: true,
      data: rows.map((r) => r.name),
      axisLabel: { ...b.axisLabel, fontFamily: FONT_FAMILY, fontSize: 12, color: p.ink.secondary },
    },
    series: [
      {
        name: 'Share of load',
        type: 'bar',
        color: p.series1,
        barMaxWidth: 14,
        itemStyle: { borderRadius: [0, 2, 2, 0] },
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value: number }) => formatPct(params.value),
          color: p.ink.secondary,
          fontFamily: MONO_FAMILY,
          fontSize: 10.5,
        },
        data: rows.map((r) => {
          const fill = color(r);
          return {
            value: r.sharePct,
            ...(r.engineerId !== undefined && { engineerId: r.engineerId }),
            ...(fill && { itemStyle: { color: fill } }),
          };
        }),
        markLine:
          engineers.length > 1
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: p.ink.secondary, type: 'dashed', width: 1 },
                // The category axis runs top to bottom, so the line starts at the top
                label: {
                  position: 'start',
                  formatter: 'Even share',
                  color: p.ink.secondary,
                  fontFamily: MONO_FAMILY,
                  fontSize: 10.5,
                },
                data: [{ xAxis: Math.round(even * 10) / 10 }],
              }
            : undefined,
      },
    ],
  };
}

/** Height the load-share chart needs: 28px per drawn row plus the axis. */
export function loadShareHeight(count: number, limit = LOAD_SHARE_LIMIT): number {
  const drawn = count > limit + 1 ? limit + 1 : count;
  return Math.max(160, drawn * 28 + 48);
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Alerts by weekday (rows, Monday on top) and hour (columns). Empty cells in a neutral tone. */
export function heatmapOption(heatmap: Heatmap, p: ChartPalette = PAPER): EChartsCoreOption {
  const b = base(p);
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  return {
    textStyle: b.textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
    tooltip: {
      ...b.tooltip,
      trigger: 'item',
      formatter: (params: { value: [number, number, number] }) => {
        const [hour, day, count] = params.value;
        return (
          b.heading(`${WEEKDAYS[day]} ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`) +
          row('', 'Alerts', String(count))
        );
      },
    },
    xAxis: {
      ...b.categoryAxis,
      data: hours,
      axisLine: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      ...b.categoryAxis,
      data: WEEKDAYS,
      inverse: true,
      axisLine: { show: false },
      splitArea: { show: false },
    },
    visualMap: {
      type: 'continuous',
      min: 1,
      max: Math.max(1, heatmap.max),
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 160,
      text: [String(Math.max(1, heatmap.max)), '1'],
      textStyle: { ...b.textStyle, fontFamily: MONO_FAMILY, fontSize: 10.5 },
      inRange: { color: [...p.sequential] },
      outOfRange: { color: p.emptyCell },
    },
    series: [
      {
        name: 'Alerts',
        type: 'heatmap',
        itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 1 },
        emphasis: { itemStyle: { borderColor: p.highlight, borderWidth: 1.5 } },
        data: heatmap.cells.map((c) => [c.hour, c.dayOfWeek - 1, c.count]),
      },
    ],
  };
}

/** One engineer's alerts by part of the day. */
export function timeOfDayOption(
  counts: TimeOfDayCounts,
  p: ChartPalette = PAPER,
): EChartsCoreOption {
  const b = base(p);
  return {
    textStyle: b.textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...b.tooltip,
      trigger: 'axis',
      axisPointer: b.shadowPointer,
      formatter: (params: { dataIndex: number }[]) => {
        const part = DAY_PARTS[params[0]?.dataIndex ?? 0];
        return (
          b.heading(`${part.label}, ${part.hours}`) + row('', 'Alerts', String(counts[part.key]))
        );
      },
    },
    xAxis: { ...b.categoryAxis, data: DAY_PARTS.map((part) => part.label) },
    yAxis: { ...b.valueAxis, minInterval: 1 },
    series: [
      {
        name: 'Alerts',
        type: 'bar',
        // Night pages are the costly ones: that bar in the highlight
        data: DAY_PARTS.map((part) => ({
          value: counts[part.key],
          itemStyle: { color: part.key === 'night' ? p.highlight : p.series1 },
        })),
        barMaxWidth: 40,
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      },
    ],
  };
}
