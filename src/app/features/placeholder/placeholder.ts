import { Component, input } from '@angular/core';

/** Stands in for a page a later group builds (route data: heading and note). */
@Component({
  selector: 'app-placeholder',
  template: `
    <h1>{{ heading() }}</h1>
    <p>{{ note() }}</p>
  `,
  styles: `
    h1 {
      margin: 0 0 8px;
      font: var(--mat-sys-headline-small);
    }
    p {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Placeholder {
  readonly heading = input('');
  readonly note = input('');
}
