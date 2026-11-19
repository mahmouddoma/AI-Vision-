import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { AnalyticsAlert } from '../../core/smart-models';
import { Page } from '../../core/models';
import { SmartApi } from '../../core/smart-api';
import { UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Realtime } from '../../core/realtime';
import { LocalizedFormat } from '../../core/localized-format';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Table, Pagination } from '../../ui/table';
import { MetricQualityView } from '../../ui/metric-quality';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'app-alerts',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    StateView,
    Table,
    Pagination,
    MetricQualityView,
    Icon,
    Status,
  ],
  templateUrl: './alerts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alerts {
  private readonly api = inject(SmartApi);
  private readonly realtime = inject(Realtime);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(AppContext);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly id = computed(() => this.params().get('id'));
  readonly page = signal(1);
  readonly status = signal('');
  readonly search = signal('');
  readonly version = signal(0);
  private readonly notificationSite = signal('');
  readonly saving = signal(false);
  readonly actionError = signal<UiError | null>(null);
  readonly format = inject(LocalizedFormat);
  readonly result = toSignal(
    toObservable(
      computed(() => ({
        id: this.id(),
        siteId: this.context.selectedSiteId(),
        page: this.page(),
        status: this.status(),
        search: this.search(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ id, siteId, page, status, search }) => {
        const request: Observable<{
          alert: AnalyticsAlert | null;
          list: Page<AnalyticsAlert> | null;
        }> = id
          ? this.api.alert(id).pipe(map((alert) => ({ alert, list: null })))
          : siteId
            ? this.api
                .alerts(siteId, { page, pageSize: 20, status, search })
                .pipe(map((list) => ({ list, alert: null })))
            : of({ list: null, alert: null });
        return request.pipe(
          map((data) => {
            if (data.alert) this.notificationSite.set(data.alert.scope.siteId);
            return { ...data, loading: false, error: null };
          }),
          catchError((error) =>
            of({ alert: null, list: null, loading: false, error: apiError(error) }),
          ),
          startWith({ alert: null, list: null, loading: true, error: null }),
        );
      }),
    ),
    { initialValue: { alert: null, list: null, loading: true, error: null } },
  );
  readonly rule = toSignal(
    toObservable(computed(() => this.result().alert?.ruleId)).pipe(
      switchMap((id) => (id ? this.api.rule(id).pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null },
  );
  constructor() {
    toObservable(computed(() => this.notificationSite() || this.context.selectedSiteId()))
      .pipe(
        switchMap((id) => (id ? this.realtime.watchAlertChanges(id) : of(undefined))),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe(() => this.reload());
  }
  reload(): void {
    this.version.update((v) => v + 1);
  }
  action(action: 'acknowledge' | 'resolve'): void {
    if (!this.context.auth.canWrite(this.result().alert?.scope.siteId ?? '')) return;
    const id = this.id();
    if (!id || this.saving()) return;
    this.saving.set(true);
    this.actionError.set(null);
    this.api
      .alertAction(id, action)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => this.reload(),
        error: (error) => this.actionError.set(apiError(error)),
      });
  }
}
