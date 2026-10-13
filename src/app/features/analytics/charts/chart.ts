import { Component, input, output } from '@angular/core';
import type { ECElementEvent, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { echarts } from './echarts';

/** An ECharts canvas. The label describes the chart for screen readers; the card's table view has the values. */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div
      echarts
      class="canvas"
      role="img"
      [attr.aria-label]="label()"
      [options]="options()"
      [style.height.px]="height()"
      (chartClick)="itemClick.emit($event)"
    ></div>
  `,
  styles: `
    :host {
      display: block;
    }
    .canvas {
      width: 100%;
    }
  `,
})
export class Chart {
  readonly options = input.required<EChartsCoreOption>();
  readonly label = input.required<string>();
  readonly height = input(280);
  readonly itemClick = output<ECElementEvent>();
}
