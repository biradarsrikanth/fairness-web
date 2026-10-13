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
import {
  CHART_SURFACE,
  EMPTY_CELL,
  FONT_FAMILY,
  INK,
  SEQUENTIAL,
  SERIES_1,
  SEVERITY_COLORS,
} from './palette';

/*
 * ECharts options for the analytics charts. Each builder is a pure function of the gateway's data, so the
 * charts are tested without drawing them. Every chart also has a table view on the page; tooltips add
 * detail but never hold the only copy of a value.
 */

export type SeverityKey = keyof typeof SEVERITY_COLORS;

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

const textStyle = { fontFamily: FONT_FAMILY, color: INK.secondary, fontSize: 12 };

const tooltip = {
  backgroundColor: '#ffffff',
  borderColor: INK.grid,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { fontFamily: FONT_FAMILY, color: INK.primary, fontSize: 12 },
  extraCssText: 'box-shadow: 0 2px 8px rgba(11, 11, 11, 0.12); border-radius: 8px;',
};

const categoryAxis = {
  type: 'category',
  axisLine: { lineStyle: { color: INK.axis } },
  axisTick: { show: false },
  axisLabel: { color: INK.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
};

const valueAxis = {
  type: 'value',
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: INK.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
  splitLine: { lineStyle: { color: INK.grid, width: 1, type: 'solid' } },
};

function row(marker: string, label: string, value: string): string {
  return (
    `<div style="display:flex;gap:12px;justify-content:space-between">` +
    `<span>${marker}${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
  );
}

function swatch(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${color}"></span>`;
}

function heading(text: string): string {
  return `<div style="margin-bottom:4px;color:${INK.secondary}">${escapeHtml(text)}</div>`;
}

/** Severities that occur in the series; the others stay out of the legend. Colors never move. */
export function severitiesIn(series: TimeSeries): typeof SEVERITIES {
  return SEVERITIES.filter((s) => series.points.some((p) => p.bySeverity[s.key] > 0));
}

/** Alerts per period, stacked by severity (P1 at the bottom). */
export function alertsOverTimeOption(series: TimeSeries): EChartsCoreOption {
  const present = severitiesIn(series);
  const labels = series.points.map((p) => periodLabel(p.start, series.granularity));
  // Only the top segment of each stack gets rounded corners
  const topOf = series.points.map((p) => {
    for (let i = present.length - 1; i >= 0; i--) {
      if (p.bySeverity[present[i].key] > 0) return present[i].key;
    }
    return null;
  });
  return {
    textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    legend: {
      show: present.length > 1,
      top: 0,
      left: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle,
    },
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(11, 11, 11, 0.04)' } },
      formatter: (params: { dataIndex: number }[]) => {
        const index = params[0]?.dataIndex ?? 0;
        const point = series.points[index];
        const rows = present
          .filter((s) => point.bySeverity[s.key] > 0)
          .map((s) =>
            row(swatch(SEVERITY_COLORS[s.key]), s.label, String(point.bySeverity[s.key])),
          );
        return heading(labels[index]) + rows.join('') + row('', 'Total', String(point.total));
      },
    },
    xAxis: { ...categoryAxis, data: labels },
    yAxis: { ...valueAxis, minInterval: 1 },
    series: present.map((s) => ({
      name: s.label,
      type: 'bar',
      stack: 'alerts',
      barMaxWidth: 28,
      color: SEVERITY_COLORS[s.key],
      emphasis: { focus: 'series' },
      itemStyle: { borderColor: CHART_SURFACE, borderWidth: 1 },
      data: series.points.map((p, i) => ({
        value: p.bySeverity[s.key],
        itemStyle: topOf[i] === s.key ? { borderRadius: [4, 4, 0, 0] } : undefined,
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
): EChartsCoreOption {
  const labels = periods.map((p) => trendPeriodLabel(p, granularity, timeZone));
  const highest = Math.max(0, ...periods.map((p) => p.gini));
  return {
    textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 72, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (params: { dataIndex: number }[]) => {
        const period = periods[params[0]?.dataIndex ?? 0];
        const burnout =
          period.averageBurnout === null || period.averageBurnout === undefined
            ? '–'
            : period.averageBurnout.toFixed(0);
        return (
          heading(labels[params[0]?.dataIndex ?? 0]) +
          row(swatch(SERIES_1), 'Gini', period.gini.toFixed(2)) +
          row('', 'Alerts', String(period.alertCount)) +
          row('', 'Average burnout', burnout) +
          row('', 'High burnout risk', String(period.highRiskCount)) +
          (period.confidence === 'LOW'
            ? `<div style="margin-top:4px;color:${INK.secondary}">Few alerts or engineers: indicative only</div>`
            : '')
        );
      },
    },
    xAxis: { ...categoryAxis, boundaryGap: false, data: labels },
    yAxis: {
      ...valueAxis,
      min: 0,
      max: Math.min(1, Math.max(0.7, Math.ceil((highest + 0.05) * 10) / 10)),
      interval: 0.2,
      axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => v.toFixed(1) },
    },
    series: [
      {
        name: 'Gini',
        type: 'line',
        color: SERIES_1,
        lineStyle: { width: 2 },
        symbolSize: 8,
        itemStyle: { borderColor: CHART_SURFACE, borderWidth: 2 },
        data: periods.map((p) => ({
          value: p.gini,
          symbol: p.confidence === 'LOW' ? 'emptyCircle' : 'circle',
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: INK.axis, type: 'solid', width: 1 },
          label: { position: 'end', color: INK.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
          data: GINI_BANDS.map((band) => ({ yAxis: band.from, label: { formatter: band.label } })),
        },
      },
    ],
  };
}

/** Each engineer's share of the load, largest first, against an even split. */
export function loadShareOption(engineers: readonly EngineerLoad[]): EChartsCoreOption {
  const sorted = [...engineers].sort((a, b) => b.sharePct - a.sharePct);
  const even = engineers.length > 0 ? 100 / engineers.length : 0;
  return {
    textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(11, 11, 11, 0.04)' } },
      formatter: (params: { dataIndex: number }[]) => {
        const engineer = sorted[params[0]?.dataIndex ?? 0];
        return (
          heading(engineer.name) +
          row(swatch(SERIES_1), 'Share of load', formatPct(engineer.sharePct)) +
          row('', 'Alerts', String(engineer.alertCount)) +
          (engineer.oncallHours === null || engineer.oncallHours === undefined
            ? ''
            : row('', 'On-call hours', String(Math.round(engineer.oncallHours))))
        );
      },
    },
    xAxis: {
      ...valueAxis,
      min: 0,
      axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => `${v}%` },
    },
    yAxis: { ...categoryAxis, inverse: true, data: sorted.map((e) => e.name) },
    series: [
      {
        name: 'Share of load',
        type: 'bar',
        color: SERIES_1,
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        data: sorted.map((e) => ({ value: e.sharePct, engineerId: e.engineerId })),
        markLine:
          engineers.length > 1
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: INK.secondary, type: 'solid', width: 1 },
                label: {
                  position: 'end',
                  formatter: 'Even share',
                  color: INK.secondary,
                  fontFamily: FONT_FAMILY,
                  fontSize: 11,
                },
                data: [{ xAxis: Math.round(even * 10) / 10 }],
              }
            : undefined,
      },
    ],
  };
}

/** Rows the load-share chart needs: 28px per engineer plus the axis. */
export function loadShareHeight(count: number): number {
  return Math.max(160, count * 28 + 48);
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Alerts by weekday (rows, Monday on top) and hour (columns). Empty cells in neutral gray. */
export function heatmapOption(heatmap: Heatmap): EChartsCoreOption {
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  return {
    textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'item',
      formatter: (params: { value: [number, number, number] }) => {
        const [hour, day, count] = params.value;
        return (
          heading(`${WEEKDAYS[day]} ${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`) +
          row('', 'Alerts', String(count))
        );
      },
    },
    xAxis: { ...categoryAxis, data: hours, axisLine: { show: false }, splitArea: { show: false } },
    yAxis: {
      ...categoryAxis,
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
      itemWidth: 12,
      itemHeight: 160,
      text: [String(Math.max(1, heatmap.max)), '1'],
      textStyle,
      inRange: { color: SEQUENTIAL },
      outOfRange: { color: EMPTY_CELL },
    },
    series: [
      {
        name: 'Alerts',
        type: 'heatmap',
        itemStyle: { borderColor: CHART_SURFACE, borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: INK.primary, borderWidth: 1 } },
        data: heatmap.cells.map((c) => [c.hour, c.dayOfWeek - 1, c.count]),
      },
    ],
  };
}

/** One engineer's alerts by part of the day. */
export function timeOfDayOption(counts: TimeOfDayCounts): EChartsCoreOption {
  return {
    textStyle,
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(11, 11, 11, 0.04)' } },
      formatter: (params: { dataIndex: number }[]) => {
        const part = DAY_PARTS[params[0]?.dataIndex ?? 0];
        return (
          heading(`${part.label}, ${part.hours}`) + row('', 'Alerts', String(counts[part.key]))
        );
      },
    },
    xAxis: { ...categoryAxis, data: DAY_PARTS.map((p) => p.label) },
    yAxis: { ...valueAxis, minInterval: 1 },
    series: [
      {
        name: 'Alerts',
        type: 'bar',
        color: SERIES_1,
        barMaxWidth: 40,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: DAY_PARTS.map((p) => counts[p.key]),
      },
    ],
  };
}
