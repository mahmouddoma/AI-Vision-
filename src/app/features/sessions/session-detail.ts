import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { ReportFilter, Session, SessionReport } from '../../core/models';
import { duration, number, sourceTime, timestamp } from '../../core/format';
import { zonePoints, staffPoints } from '../../core/report-presenter';
import { ReportFilters } from '../analytics/report-filters';
import { Chart } from '../../ui/chart';
import { StateView, Metric } from '../../ui/feedback';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { Quality } from '../../ui/quality';
@Component({
  selector: 'app-session-detail',
  imports: [RouterLink, ReportFilters, Chart, StateView, Metric, Icon, Status, Quality],
  templateUrl: './session-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(AppContext);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly version = signal(0);
  readonly session = signal<Session | null>(null);
  readonly loading = signal(true);
  readonly error = signal<UiError | null>(null);
  readonly report = signal<SessionReport | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError = signal<UiError | null>(null);
  readonly filter = signal<ReportFilter | null>(null);
  readonly num = number;
  readonly date = timestamp;
  readonly sourceTime = sourceTime;
  readonly duration = duration;
  readonly points = zonePoints;
  readonly staffPoints = staffPoints;
  private readonly id = computed(() => {
    this.version();
    return this.params().get('id') ?? '';
  });
  constructor() {
    toObservable(this.id)
      .pipe(
        switchMap((id) => {
          this.loading.set(true);
          this.error.set(null);
          this.session.set(null);
          this.filter.set(null);
          this.report.set(null);
          return this.api.get<Session>(`analytics/sessions/${id}`).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.error.set(result.error);
        this.session.set(result.data);
      });
    toObservable(computed(() => ({ filter: this.filter(), id: this.id() })))
      .pipe(
        switchMap(({ filter, id }) => {
          if (!filter) return of(null);
          this.reportLoading.set(true);
          this.reportError.set(null);
          return this.api.report<SessionReport>(`sessions/${id}/report`, filter).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.reportLoading.set(false);
        this.report.set(result?.data ?? null);
        this.reportError.set(result?.error ?? null);
      });
  }
  reload(): void {
    this.version.update((value) => value + 1);
  }
  reloadReport(): void {
    this.filter.update((value) => (value ? { ...value } : null));
  }
}
