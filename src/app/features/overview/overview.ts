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
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { auditTime, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { gsap } from 'gsap';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { FeedState, Realtime } from '../../core/realtime';
import { OccupancyReport, OverviewReport, ReportFilter } from '../../core/models';
import { ReportFilters } from '../analytics/report-filters';
import { Icon, IconName } from '../../ui/icon';
import { StateView } from '../../ui/feedback';
import { Chart } from '../../ui/chart';
import { Quality } from '../../ui/quality';
import { Status } from '../../ui/status';
import { Table } from '../../ui/table';
import { TranslatePipe } from '../../core/i18n';
@Component({
  selector: 'app-overview',
  imports: [
    RouterLink,
    ReportFilters,
    Icon,
    StateView,
    Chart,
    Quality,
    Status,
    Table,
    TranslatePipe,
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  readonly context = inject(AppContext);
  readonly realtime = inject(Realtime);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
  private readonly feedVersion = signal(0);
  private readonly reportVersion = signal(0);
  readonly filter = signal<ReportFilter | null>(null);
  readonly report = signal<OverviewReport | null>(null);
  readonly occupancyReport = signal<OccupancyReport | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError = signal<UiError | null>(null);
  private readonly target = computed(() => {
    this.feedVersion();
    return this.context.selectedSiteId();
  });
  readonly feed = toSignal(
    toObservable(this.target).pipe(
      switchMap((id) =>
        id
          ? this.realtime.watch('site', id)
          : of<FeedState>({ cameras: [], loading: false, error: null, refreshedAt: null }),
      ),
    ),
    { initialValue: { cameras: [], loading: true, error: null, refreshedAt: null } as FeedState },
  );
  readonly knownOccupancy = computed(() => {
    const zones = this.feed()
      .cameras.flatMap((camera) => camera.zones)
      .filter((zone) => zone.isActive && zone.occupancy != null);
    return zones.length ? zones.reduce((sum, zone) => sum + zone.occupancy!, 0) : null;
  });
  readonly freshCount = computed(
    () => this.feed().cameras.filter((camera) => camera.dataFreshness === 'Fresh').length,
  );
  readonly highlights = computed(() => {
    const report = this.report();
    return [
      {
        label: 'Most visited zone',
        row: report?.mostVisitedZone,
        unit: 'zone arrivals',
        icon: 'zones' as IconName,
        tone: 'accent',
      },
      {
        label: 'Top entry zone',
        row: report?.topEntryZone,
        unit: 'gate entries',
        icon: 'door' as IconName,
        tone: 'success',
      },
      {
        label: 'Most crowded zone',
        row: report?.mostCrowdedZone,
        unit: 'average occupancy',
        icon: 'users' as IconName,
        tone: 'warning',
      },
      {
        label: 'Peak occupancy',
        row: report?.peakOccupancy,
        unit: 'people in one zone',
        icon: 'chartLine' as IconName,
        tone: 'danger',
      },
      {
        label: 'Longest active stay',
        row: report?.longestActiveStay,
        unit: 'duration',
        icon: 'stopwatch' as IconName,
        tone: 'purple',
      },
      {
        label: 'Estimated historical dwell',
        row: report?.estimatedHistoricalDwell,
        unit: 'estimated duration',
        icon: 'clock' as IconName,
        tone: 'info',
      },
    ];
  });
  readonly num = inject(LocalizedFormat).number;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly duration = inject(LocalizedFormat).duration;
  readonly points = inject(LocalizedFormat).zonePoints;
  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });

    toObservable(
      computed(() => {
        this.reportVersion();
        return { filter: this.filter(), site: this.context.selectedSiteId() };
      }),
    )
      .pipe(
        switchMap(({ filter, site }) => {
          if (!filter || !site) return of(null);
          this.reportLoading.set(true);
          this.reportError.set(null);
          return forkJoin({
            overview: this.api.report<OverviewReport>('overview', filter),
            occupancy: this.api.report<OccupancyReport>('occupancy', filter),
          }).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.reportLoading.set(false);
        this.report.set(result?.data?.overview ?? null);
        this.occupancyReport.set(result?.data?.occupancy ?? null);
        this.reportError.set(result?.error ?? null);
        if (result?.data?.overview) {
          this.animateInsights();
        }
      });
    this.realtime.summaries
      .pipe(auditTime(3000), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.reportVersion.update((value) => value + 1));
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
      gsap.from('.kpi-col', {
        opacity: 0,
        y: 16,
        duration: 0.45,
        stagger: 0.06,
        ease: 'power2.out',
        delay: 0.1,
      });
      gsap.from('.health-strip-card', {
        opacity: 0,
        y: 10,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.22,
      });
      gsap.from('app-report-filters', {
        opacity: 0,
        y: 10,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.3,
      });
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
  private animateInsights(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.elementRef.nativeElement as HTMLElement;
    setTimeout(() => {
      const cards = host.querySelectorAll('.insight-cell');
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0,
          scale: 0.96,
          y: 10,
          duration: 0.38,
          stagger: 0.05,
          ease: 'power2.out',
        });
      }
    }, 40);
  }
  zoneCamera(id: string): string | undefined {
    return this.feed().cameras.find((camera) => camera.zones.some((zone) => zone.zoneId === id))
      ?.cameraId;
  }
  refresh(): void {
    this.context.refresh();
    this.feedVersion.update((value) => value + 1);
    this.reportVersion.update((value) => value + 1);
  }
}
