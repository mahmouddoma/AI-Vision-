import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { UiError } from '../core/api';
import { I18nService, TranslatePipe } from '../core/i18n';
import { Icon, IconName } from './icon';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-state',
  imports: [Icon, TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` @if (loading()) {
      <div
        class="loading-state"
        role="status"
        [attr.aria-label]="'Loading data' | t"
        aria-busy="true"
      >
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <span class="visually-hidden">{{ 'Loading data…' | t }}</span>
      </div>
    } @else if (error(); as problem) {
      <div class="state-view" role="alert">
        <app-icon name="link" />
        <h2>{{ problem.title | t }}</h2>
        <p>{{ i18n.errorMessage(problem) }}</p>
        @if (problem.traceId) {
          <small>{{ 'Support reference:' | t }} {{ problem.traceId }}</small>
        }
        @if (problem.status === 401) {
          <a class="button" routerLink="/auth">{{ 'Sign in' | t }}</a>
        } @else {
          <button class="button secondary" (click)="retry.emit()">
            <app-icon name="refresh" />{{ 'action.retry' | t }}
          </button>
        }
      </div>
    } @else {
      <div class="state-view">
        <app-icon [name]="icon()" />
        <h2>{{ title() | t }}</h2>
        <p>{{ message() | t }}</p>
        <ng-content />
      </div>
    }`,
})
export class StateView {
  readonly i18n = inject(I18nService);
  readonly loading = input(false);
  readonly error = input<UiError | null>(null);
  readonly title = input('Nothing here yet');
  readonly message = input('Data will appear here when it is available.');
  readonly icon = input<IconName>('database');
  readonly retry = output<void>();
}
@Component({
  selector: 'app-metric',
  imports: [Icon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="metric" [attr.data-tone]="tone()">
    <div class="metric-top">
      <p>{{ label() | t }}</p>
      @if (icon(); as iconName) {
        <div class="metric-icon" [attr.data-tone]="tone()">
          <app-icon [name]="iconName" />
        </div>
      }
    </div>
    <strong>{{ localizedValue() }}</strong>
    @if (detail()) {
      <span class="metric-detail">{{ detail() | t }}</span>
    }
  </article>`,
})
export class Metric {
  private readonly i18n = inject(I18nService);
  localizedValue(): string | number {
    const value = this.value();
    return typeof value === 'string' ? this.i18n.t(value) : value;
  }
  readonly label = input.required<string>();
  readonly value = input<string | number>('N/A');
  readonly detail = input('');
  readonly icon = input<IconName>();
  readonly tone = input<string>('accent');
}
