import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Only what the analytics charts draw, so the lazy analytics chunk stays small
echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
  CanvasRenderer,
]);

export { echarts };
