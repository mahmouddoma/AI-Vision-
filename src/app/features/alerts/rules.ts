import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { UiError, apiError } from '../../core/api';
import { SmartApi } from '../../core/smart-api';
import { AlertRule } from '../../core/smart-models';
import { AppContext } from '../../core/context';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Table, Pagination } from '../../ui/table';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'app-alert-rules',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    StateView,
    Table,
    Pagination,
    Icon,
    Status,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <section class="analytics-command-bar">
      <div class="analytics-cmd-top">
        <div class="analytics-cmd-title">
          <div class="page-title-badge" aria-hidden="true">
            <app-icon name="filters" />
          </div>
          <h1>{{ 'Alert rules' | t }}</h1>
        </div>
        <div class="analytics-cmd-actions">
          <nav class="subnav-pills" [attr.aria-label]="'Alerts' | t">
            <a
              routerLink="/alerts"
              routerLinkActive="active-subnav"
              [routerLinkActiveOptions]="{ exact: true }"
              class="subnav-pill"
            >
              <app-icon name="bell" />
              <span>{{ 'Alerts' | t }}</span>
            </a>
            <a routerLink="/alert-rules" routerLinkActive="active-subnav" class="subnav-pill">
              <app-icon name="filters" />
              <span>{{ 'Alert rules' | t }}</span>
            </a>
          </nav>
          <a
            [hidden]="!context.auth.canWrite(context.selectedSiteId())"
            class="button"
            routerLink="/alert-rules/new"
            ><app-icon name="plus" />{{ 'Add rule' | t }}</a
          >
        </div>
      </div>
      <form class="toolbar" (submit)="$event.preventDefault(); page.set(1); reload()">
        <div class="field search-field">
          <label for="rules-search">{{ 'Search' | t }}</label>
          <div class="search-input">
            <app-icon name="search" /><input
              id="rules-search"
              name="search"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
            />
          </div>
        </div>
        <button class="button secondary">{{ 'Search' | t }}</button>
      </form>
    </section>
    <section class="surface stack">
      @if (error()) {
        <app-state [error]="error()" (retry)="error.set(null); reload()" />
      }
      @if (result().loading || result().error) {
        <app-state [loading]="result().loading" [error]="result().error" (retry)="reload()" />
      } @else if (result().data; as data) {
        @if (!data.items.length) {
          <app-state icon="filters" title="No matching rules" />
        } @else {
          <app-table label="Alert rules"
            ><table>
              <thead>
                <tr>
                  <th>{{ 'Name' | t }}</th>
                  <th>{{ 'Kind' | t }}</th>
                  <th>{{ 'Threshold' | t }}</th>
                  <th>{{ 'Status' | t }}</th>
                  <th>{{ 'Actions' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of data.items; track r.id) {
                  <tr>
                    <th>
                      <a [routerLink]="['/alert-rules', r.id, 'edit']">{{ r.name }}</a>
                    </th>
                    <td>{{ r.kind }}</td>
                    <td>{{ r.threshold }}</td>
                    <td><app-status [value]="r.isActive ? 'Active' : 'Inactive'" /></td>
                    <td>
                      <button
                        class="button quiet"
                        [disabled]="saving() || !context.auth.canWrite(r.scope.siteId)"
                        (click)="status(r)"
                      >
                        {{ (r.isActive ? 'Deactivate' : 'Activate') | t }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table></app-table
          >
        }
        <app-pagination
          [page]="data.page"
          [pages]="data.totalPages"
          [total]="data.totalCount"
          (changed)="page.set($event)"
        />
      }
    </section>
  </div>`,
})
export class Rules {
  private readonly api = inject(SmartApi);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(AppContext);
  readonly page = signal(1);
  readonly search = signal('');
  readonly version = signal(0);
  readonly saving = signal(false);
  readonly error = signal<UiError | null>(null);
  readonly result = toSignal(
    toObservable(
      computed(() => ({
        site: this.context.selectedSiteId(),
        page: this.page(),
        search: this.search(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ site, page, search }) =>
        site
          ? this.api.rules(site, { page, pageSize: 20, search }).pipe(
              map((data) => ({ data, loading: false, error: null })),
              catchError((error) => of({ data: null, loading: false, error: apiError(error) })),
              startWith({ data: null, loading: true, error: null }),
            )
          : of({ data: null, loading: false, error: null }),
      ),
    ),
    { initialValue: { data: null, loading: true, error: null } },
  );
  reload(): void {
    this.version.update((v) => v + 1);
  }
  status(rule: AlertRule): void {
    if (this.saving() || !this.context.auth.canWrite(rule.scope.siteId)) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .ruleStatus(rule)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => this.reload(),
        error: (error) => {
          this.error.set(apiError(error));
          this.reload();
        },
      });
  }
}
