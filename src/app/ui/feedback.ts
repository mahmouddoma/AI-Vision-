import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiError } from '../core/api';
import { Icon, IconName } from './icon';
@Component({
  selector: 'app-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` @if (loading()) {
      <div class="loading-state" role="status" aria-label="Loading data" aria-busy="true">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <span class="visually-hidden">Loading data…</span>
      </div>
    } @else if (error(); as problem) {
      <div class="state-view" role="alert">
        <app-icon name="link" />
        <h2>{{ problem.title }}</h2>
        <p>{{ problem.message }}</p>
        @if (problem.traceId) {
          <small>Support reference: {{ problem.traceId }}</small>
        }
        <button class="button secondary" (click)="retry.emit()">
          <app-icon name="refresh" />Try again
        </button>
      </div>
    } @else {
      <div class="state-view">
        <app-icon [name]="icon()" />
        <h2>{{ title() }}</h2>
        <p>{{ message() }}</p>
        <ng-content />
      </div>
    }`,
})
export class StateView {
  readonly loading = input(false);
  readonly error = input<UiError | null>(null);
  readonly title = input('Nothing here yet');
  readonly message = input('Data will appear here when it is available.');
  readonly icon = input<IconName>('database');
  readonly retry = output<void>();
}
@Component({
  selector: 'app-metric',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="metric">
    <p>{{ label() }}</p>
    <strong>{{ value() }}</strong><span>{{ detail() }}</span>
  </article>`,
})
export class Metric {
  readonly label = input.required<string>();
  readonly value = input<string | number>('N/A');
  readonly detail = input('');
}
