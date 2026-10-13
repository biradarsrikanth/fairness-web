import { Component, input } from '@angular/core';
import { ServiceStats } from '../../api/models';
import { formatMinutes, formatPct } from '../../shared/format';

/** The services that paged the most. */
@Component({
  selector: 'app-top-services',
  template: `
    <table class="data-table" aria-label="Services with the most alerts">
      <thead>
        <tr>
          <th scope="col">Service</th>
          <th scope="col" class="num">Alerts</th>
          <th scope="col" class="num">Time to resolve</th>
          <th scope="col" class="num">After hours</th>
        </tr>
      </thead>
      <tbody>
        @for (service of services(); track service.name) {
          <tr>
            <td>{{ service.name }}</td>
            <td class="num">{{ service.alertCount }}</td>
            <td class="num">{{ formatMinutes(service.mttrMinutes) }}</td>
            <td class="num">{{ formatPct(service.afterHoursPct) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TopServices {
  readonly services = input.required<readonly ServiceStats[]>();

  protected readonly formatMinutes = formatMinutes;
  protected readonly formatPct = formatPct;
}
