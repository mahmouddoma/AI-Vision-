import { LocalizedFormat } from '../../core/localized-format';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { gsap } from 'gsap';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { ReportFilter, Session, SessionReport } from '../../core/models';
import { ReportFilters } from '../analytics/report-filters';
import { Chart } from '../../ui/chart';
import { StateView, Metric } from '../../ui/feedback';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { Quality } from '../../ui/quality';
import { TranslatePipe } from '../../core/i18n';
@Component({
  selector: 'app-session-detail',
  imports: [
    RouterLink,
    ReportFilters,
    Chart,
    StateView,
    Metric,
    Icon,
    Status,
    Quality,
    TranslatePipe,
  ],
  templateUrl: './session-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
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
  readonly num = inject(LocalizedFormat).number;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly sourceTime = inject(LocalizedFormat).sourceTime;
  readonly duration = inject(LocalizedFormat).duration;
  readonly points = inject(LocalizedFormat).zonePoints;
  readonly staffPoints = inject(LocalizedFormat).staffPoints;
  private readonly id = computed(() => {
    this.version();
    return this.params().get('id') ?? '';
  });
  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });
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

  private animateEntrance(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.elementRef.nativeElement as HTMLElement;
    const ctx = gsap.context(() => {
      gsap.from('.page-heading', {
        opacity: 0,
        y: -10,
        duration: 0.45,
        ease: 'power2.out',
      });
      gsap.from('.breadcrumbs', {
        opacity: 0,
        x: -8,
        duration: 0.35,
        ease: 'power2.out',
      });
      gsap.from('.surface', {
        opacity: 0,
        y: 12,
        duration: 0.45,
        ease: 'power2.out',
        delay: 0.1,
      });
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
}
