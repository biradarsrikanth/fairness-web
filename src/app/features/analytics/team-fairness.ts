import { Component, computed, input } from '@angular/core';
import { TeamFairness } from '../../api/models';
import { humanize } from '../../shared/format';

/** Each team's own Gini when the page covers several teams, least even first. */
@Component({
  selector: 'app-team-fairness',
  template: `
    <table class="data-table" aria-label="Fairness of each team">
      <thead>
        <tr>
          <th scope="col">Team</th>
          <th scope="col" class="num">Gini</th>
          <th scope="col">Fairness</th>
          <th scope="col" class="num">Alerts</th>
          <th scope="col" class="num">Engineers</th>
        </tr>
      </thead>
      <tbody>
        @for (team of sorted(); track team.team) {
          <tr>
            <td>{{ team.team }}</td>
            <td class="num">{{ team.gini.toFixed(2) }}</td>
            <td>{{ humanize(team.label) }}</td>
            <td class="num">{{ team.alertCount }}</td>
            <td class="num">{{ team.engineerCount }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TeamFairnessTable {
  readonly teams = input.required<readonly TeamFairness[]>();

  protected readonly sorted = computed(() =>
    [...this.teams()].sort((a, b) => b.gini - a.gini || a.team.localeCompare(b.team)),
  );
  protected readonly humanize = humanize;
}
