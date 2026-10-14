import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

/** How long typing has to pause before the search runs, so a word doesn't send one request per letter. */
export const SEARCH_DELAY_MS = 300;

/**
 * A search box for a list. It emits the trimmed text (null when cleared) once typing pauses; the page puts
 * it in the URL like its other filters, so `value` comes back from there.
 */
@Component({
  selector: 'app-search-field',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <mat-icon matIconPrefix svgIcon="search" />
      <input
        matInput
        type="search"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="value() ?? ''"
        (input)="typed($any($event.target).value)"
        (keydown.enter)="now($any($event.target).value)"
      />
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
      width: 260px;
      max-width: 100%;
    }
    mat-form-field {
      width: 100%;
    }
    mat-icon {
      width: 18px;
      height: 18px;
      margin: 0 4px 0 10px;
      color: var(--muted);
    }
  `,
})
export class SearchField {
  readonly label = input('Search');
  readonly placeholder = input('');
  readonly value = input<string | null>(null);
  readonly searched = output<string | null>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected typed(text: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emit(text), SEARCH_DELAY_MS);
  }

  /** Enter searches straight away. */
  protected now(text: string): void {
    clearTimeout(this.timer);
    this.emit(text);
  }

  private emit(text: string): void {
    const term = text.trim() || null;
    if (term !== (this.value() ?? null)) this.searched.emit(term);
  }
}
