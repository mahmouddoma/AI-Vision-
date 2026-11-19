import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { UiError, apiError } from '../../core/api';
import { SmartApi } from '../../core/smart-api';
import { AlertRule } from '../../core/smart-models';
import { AppContext } from '../../core/context';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Table, Pagination } from '../../ui/table';

@Component({
  selector: 'app-alert-rules',
  imports: [FormsModule, RouterLink, TranslatePipe, StateView, Table, Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-heading">
      <div>
        <h1>{{ 'Alert rules' | t }}</h1>
        <a routerLink="/alerts">{{ 'Alerts' | t }}</a>
      </div>
      <a
        [hidden]="!context.auth.canWrite(context.selectedSiteId())"
        class="button"
        routerLink="/alert-rules/new"
        >{{ 'Add rule' | t }}</a
      >
    </header>
    <section class="surface stack">
      <form class="toolbar" (submit)="$event.preventDefault(); page.set(1); reload()">
        <label
          >{{ 'Search' | t
          }}<input name="search" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label
        ><button class="button secondary">{{ 'Search' | t }}</button>
      </form>
      @if (error()) {
        <app-state [error]="error()" (retry)="error.set(null); reload()" />
      }
      @if (result().loading || result().error) {
        <app-state [loading]="result().loading" [error]="result().error" (retry)="reload()" />
      } @else if (result().data; as data) {
        @if (!data.items.length) {
          <app-state title="No matching rules" />
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
                    <td>{{ (r.isActive ? 'Active' : 'Inactive') | t }}</td>
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
    </section>`,
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
