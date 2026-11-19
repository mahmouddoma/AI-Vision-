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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { gsap } from 'gsap';
import { Api } from '../../core/api';
import { AppContext } from '../../core/context';
import {
  DwellReport,
  OccupancyReport,
  PeakHoursReport,
  RankingReport,
  ReportFilter,
  ReportResult,
  StaffReport,
  TrafficReport,
  UtilizationReport,
  WrongWayReport,
  ZonePeriod,
  ZoneResult,
} from '../../core/models';
import {
  ReportSlice,
  SafeReportOutcome,
  allSlicesFailed,
  hasPartialFailure,
  idleSlice,
  loadingSlice,
  resolveSlice,
  safeReport,
} from '../../core/report-request';
import { Chart, ChartPoint } from '../../ui/chart';
import { StateView } from '../../ui/feedback';
import { Icon, IconName } from '../../ui/icon';
import { Quality } from '../../ui/quality';
import { Status } from '../../ui/status';
import { Table } from '../../ui/table';
import { I18nService, TranslatePipe } from '../../core/i18n';
import { ReportFilters } from './report-filters';

type Tab = 'rankings' | 'occupancy' | 'traffic' | 'dwell' | 'wrong-way' | 'staff';
export type AnalyticsReportKey =
  | 'rankings'
  | 'occupancy'
  | 'peaks'
  | 'utilization'
  | 'traffic'
  | 'trends'
  | 'dwell'
  | 'wrongWay'
  | 'staff';

interface TabOutcomes {
  rankings?: SafeReportOutcome<RankingReport>;
  occupancy?: SafeReportOutcome<OccupancyReport>;
  peaks?: SafeReportOutcome<PeakHoursReport>;
  utilization?: SafeReportOutcome<UtilizationReport>;
  traffic?: SafeReportOutcome<TrafficReport>;
  trends?: SafeReportOutcome<TrafficReport>;
  dwell?: SafeReportOutcome<DwellReport>;
  wrongWay?: SafeReportOutcome<WrongWayReport>;
  staff?: SafeReportOutcome<StaffReport>;
}

@Component({
  selector: 'app-analytics',
  imports: [
    ReportFilters,
    Chart,
    StateView,
    Icon,
    Quality,
    Status,
    Table,
    TranslatePipe,
    RouterLink,
  ],
  templateUrl: './analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Analytics {
  private readonly i18n = inject(I18nService);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly elementRef = inject(ElementRef);
  readonly context = inject(AppContext);

  readonly tabs: { key: Tab; translationKey: string; icon: IconName }[] = [
    { key: 'rankings', translationKey: 'tab.zoneRankings', icon: 'zones' },
    { key: 'occupancy', translationKey: 'tab.occupancy', icon: 'users' },
    { key: 'traffic', translationKey: 'tab.traffic', icon: 'chart' },
    { key: 'dwell', translationKey: 'tab.dwellTime', icon: 'stopwatch' },
    { key: 'wrong-way', translationKey: 'tab.wrongWay', icon: 'warning' },
    { key: 'staff', translationKey: 'tab.staff', icon: 'user' },
  ];

  readonly tab = signal<Tab>('rankings');
  readonly filter = signal<ReportFilter | null>(null);
  readonly metric = signal('arrivals');
  readonly dwellMetric = signal('estimatedAverageDwell');
  readonly metricOptions = [
    ['arrivals', 'Zone arrivals'],
    ['entries', 'Gate entries'],
    ['departures', 'Zone departures'],
    ['exits', 'Gate exits'],
    ['averageOccupancy', 'Average occupancy'],
    ['peakOccupancy', 'Peak occupancy'],
    ['utilization', 'Capacity utilization'],
    ['reportedAverageDwell', 'Reported average dwell'],
    ['estimatedAverageDwell', 'Estimated historical dwell'],
    ['longestActiveDwell', 'Longest active dwell'],
    ['wrongWayEvents', 'Wrong-way events'],
  ];

  // Independent report slices
  readonly rankingsSlice = signal<ReportSlice<RankingReport>>(idleSlice());
  readonly occupancySlice = signal<ReportSlice<OccupancyReport>>(idleSlice());
  readonly peaksSlice = signal<ReportSlice<PeakHoursReport>>(idleSlice());
  readonly utilizationSlice = signal<ReportSlice<UtilizationReport>>(idleSlice());
  readonly trafficSlice = signal<ReportSlice<TrafficReport>>(idleSlice());
  readonly trendsSlice = signal<ReportSlice<TrafficReport>>(idleSlice());
  readonly dwellSlice = signal<ReportSlice<DwellReport>>(idleSlice());
  readonly wrongWaySlice = signal<ReportSlice<WrongWayReport>>(idleSlice());
  readonly staffSlice = signal<ReportSlice<StaffReport>>(idleSlice());

  // Independent zone detail slices
  readonly selectedZone = signal<string | null>(null);
  readonly zoneSummarySlice = signal<ReportSlice<ZoneResult>>(idleSlice());
  readonly zoneSeriesSlice = signal<ReportSlice<ReportResult>>(idleSlice());

  private readonly version = signal(0);
  private readonly cancelRetries$ = new Subject<void>();
  private readonly cancelZoneRetries$ = new Subject<void>();
  private activeScopeVersion = 0;
  private activeZoneScopeVersion = 0;

  readonly activeTabSlices = computed<ReportSlice<unknown>[]>(() => {
    switch (this.tab()) {
      case 'rankings':
        return [this.rankingsSlice()];
      case 'occupancy':
        return [this.occupancySlice(), this.peaksSlice(), this.utilizationSlice()];
      case 'traffic':
        return [this.trafficSlice(), this.trendsSlice()];
      case 'dwell':
        return [this.dwellSlice(), this.rankingsSlice()];
      case 'wrong-way':
        return [this.wrongWaySlice()];
      case 'staff':
        return [this.staffSlice()];
    }
  });

  readonly loading = computed(() =>
    this.activeTabSlices().every((slice) => slice.status === 'loading'),
  );
  readonly anyLoading = computed(() =>
    this.activeTabSlices().some((slice) => slice.status === 'loading'),
  );
  readonly allFailed = computed(() => allSlicesFailed(this.activeTabSlices()));
  readonly partialFailure = computed(() => hasPartialFailure(this.activeTabSlices()));
  readonly primaryError = computed(
    () => this.activeTabSlices().find((slice) => slice.error)?.error ?? null,
  );

  readonly zoneLoading = computed(
    () =>
      this.zoneSummarySlice().status === 'loading' && this.zoneSeriesSlice().status === 'loading',
  );
  readonly zoneAllFailed = computed(() =>
    allSlicesFailed([this.zoneSummarySlice(), this.zoneSeriesSlice()]),
  );

  readonly period = computed(() => {
    switch (this.tab()) {
      case 'rankings':
        return this.rankingsSlice().data?.period;
      case 'occupancy':
        return (
          this.occupancySlice().data?.period ??
          this.peaksSlice().data?.period ??
          this.utilizationSlice().data?.period
        );
      case 'traffic':
        return this.trafficSlice().data?.period ?? this.trendsSlice().data?.period;
      case 'dwell':
        return this.dwellSlice().data?.period ?? this.rankingsSlice().data?.period;
      case 'wrong-way':
        return this.wrongWaySlice().data?.period;
      case 'staff':
        return this.staffSlice().data?.period;
    }
  });

  readonly rankingPoints = computed<ChartPoint[]>(() =>
    (this.rankingsSlice().data?.items ?? []).map((item) => ({
      label: item.zoneName,
      value: item.dataQuality.kind === 'InsufficientData' ? null : item.value,
      quality: item.dataQuality,
    })),
  );

  readonly dwellPoints = computed<ChartPoint[]>(() =>
    (this.dwellSlice().data?.zones ?? []).map((zone) => ({
      label: zone.zoneName,
      value:
        zone.dataQuality.kind === 'InsufficientData' ? null : zone.reportedAverageDwellSeconds,
      secondary:
        zone.dataQuality.kind === 'InsufficientData'
          ? null
          : zone.estimatedHistoricalAverageDwellSeconds,
      quality: zone.dataQuality,
    })),
  );

  readonly empty = computed(() => {
    const slices = this.activeTabSlices();
    if (slices.some((s) => s.status === 'loading' || s.status === 'error')) return false;
    switch (this.tab()) {
      case 'rankings':
        return !this.rankingsSlice().data?.items.length;
      case 'occupancy':
        return (
          !this.occupancySlice().data?.zones.length &&
          !this.peaksSlice().data?.zones.length &&
          !this.utilizationSlice().data?.zones.length
        );
      case 'traffic':
        return !this.trafficSlice().data?.zones.length && !this.trendsSlice().data?.zones.length;
      case 'dwell':
        return !this.dwellSlice().data?.zones.length && !this.rankingsSlice().data?.items.length;
      case 'wrong-way':
        return !this.wrongWaySlice().data?.zones.length;
      case 'staff':
        return !this.staffSlice().data?.cameras.length;
    }
  });

  readonly hasTrafficData = computed(
    () =>
      this.trafficSlice().data?.zones.some(
        (zone) => zone.dataQuality.kind !== 'InsufficientData',
      ) ?? false,
  );
  readonly hasWrongWayData = computed(
    () =>
      this.wrongWaySlice().data?.zones.some(
        (zone) => zone.dataQuality.kind !== 'InsufficientData',
      ) ?? false,
  );

  readonly num = inject(LocalizedFormat).number;
  readonly duration = inject(LocalizedFormat).duration;
  readonly sourceTime = inject(LocalizedFormat).sourceTime;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly points = inject(LocalizedFormat).zonePoints;
  readonly staffPoints = inject(LocalizedFormat).staffPoints;

  private readonly request = computed(() => {
    this.version();
    return {
      filter: this.filter(),
      tab: this.tab(),
      metric: this.metric(),
      dwellMetric: this.dwellMetric(),
    };
  });

  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });
    const tab = this.route.snapshot.data['tab'] ?? this.route.snapshot.queryParamMap.get('tab');
    if (this.tabs.some((item) => item.key === tab)) this.tab.set(tab as Tab);

    toObservable(this.request)
      .pipe(
        switchMap(({ filter, tab, metric, dwellMetric }): Observable<TabOutcomes | null> => {
          this.activeScopeVersion += 1;
          this.cancelRetries$.next();
          this.resetSlicesForTab(tab, Boolean(filter));

          if (!filter) return of(null);

          if (tab === 'rankings') {
            return forkJoin({
              rankings: safeReport(
                this.api.report<RankingReport>('zones/rankings', filter, { metric }),
              ),
            });
          }
          if (tab === 'occupancy') {
            return forkJoin({
              occupancy: safeReport(this.api.report<OccupancyReport>('occupancy', filter)),
              peaks: safeReport(this.api.report<PeakHoursReport>('peak-hours', filter)),
              utilization: safeReport(
                this.api.report<UtilizationReport>('occupancy/utilization', filter),
              ),
            });
          }
          if (tab === 'traffic') {
            return forkJoin({
              traffic: safeReport(this.api.report<TrafficReport>('traffic', filter)),
              trends: safeReport(this.api.report<TrafficReport>('traffic/trends', filter)),
            });
          }
          if (tab === 'dwell') {
            return forkJoin({
              dwell: safeReport(this.api.report<DwellReport>('dwell', filter)),
              rankings: safeReport(
                this.api.report<RankingReport>('dwell/rankings', filter, { metric: dwellMetric }),
              ),
            });
          }
          if (tab === 'wrong-way') {
            return forkJoin({
              wrongWay: safeReport(this.api.report<WrongWayReport>('wrong-way', filter)),
            });
          }
          return forkJoin({
            staff: safeReport(this.api.report<StaffReport>('staff', filter)),
          });
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((outcomes) => {
        if (!outcomes) return;
        if (outcomes.rankings) this.rankingsSlice.set(resolveSlice(outcomes.rankings));
        if (outcomes.occupancy) this.occupancySlice.set(resolveSlice(outcomes.occupancy));
        if (outcomes.peaks) this.peaksSlice.set(resolveSlice(outcomes.peaks));
        if (outcomes.utilization) this.utilizationSlice.set(resolveSlice(outcomes.utilization));
        if (outcomes.traffic) this.trafficSlice.set(resolveSlice(outcomes.traffic));
        if (outcomes.trends) this.trendsSlice.set(resolveSlice(outcomes.trends));
        if (outcomes.dwell) this.dwellSlice.set(resolveSlice(outcomes.dwell));
        if (outcomes.wrongWay) this.wrongWaySlice.set(resolveSlice(outcomes.wrongWay));
        if (outcomes.staff) this.staffSlice.set(resolveSlice(outcomes.staff));
      });

    toObservable(computed(() => ({ zoneId: this.selectedZone(), filter: this.filter() })))
      .pipe(
        switchMap(({ zoneId, filter }) => {
          this.activeZoneScopeVersion += 1;
          this.cancelZoneRetries$.next();
          if (!zoneId || !filter) {
            this.zoneSummarySlice.set(idleSlice());
            this.zoneSeriesSlice.set(idleSlice());
            return of(null);
          }
          this.zoneSummarySlice.set(loadingSlice());
          this.zoneSeriesSlice.set(loadingSlice());
          return forkJoin({
            summary: safeReport(this.api.report<ZoneResult>(`zones/${zoneId}/summary`, filter)),
            series: safeReport(this.api.report<ReportResult>(`zones/${zoneId}/timeseries`, filter)),
          });
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((outcomes) => {
        if (!outcomes) return;
        this.zoneSummarySlice.set(resolveSlice(outcomes.summary));
        this.zoneSeriesSlice.set(resolveSlice(outcomes.series));
      });
  }

  private resetSlicesForTab(tab: Tab, isLoading: boolean): void {
    const next = <T>() => (isLoading ? loadingSlice<T>() : idleSlice<T>());
    if (tab === 'rankings') this.rankingsSlice.set(next());
    else if (tab === 'occupancy') {
      this.occupancySlice.set(next());
      this.peaksSlice.set(next());
      this.utilizationSlice.set(next());
    } else if (tab === 'traffic') {
      this.trafficSlice.set(next());
      this.trendsSlice.set(next());
    } else if (tab === 'dwell') {
      this.dwellSlice.set(next());
      this.rankingsSlice.set(next());
    } else if (tab === 'wrong-way') this.wrongWaySlice.set(next());
    else this.staffSlice.set(next());
  }

  retryReport(key: AnalyticsReportKey): void {
    const filter = this.filter();
    if (!filter) return;
    const scope = this.activeScopeVersion;

    const run = <T>(
      target: ReturnType<typeof signal<ReportSlice<T>>>,
      req$: Observable<T>,
    ): void => {
      if (target().status === 'loading') return;
      target.set(loadingSlice());
      safeReport(req$)
        .pipe(takeUntil(this.cancelRetries$), takeUntilDestroyed(this.destroy))
        .subscribe((outcome) => {
          if (scope !== this.activeScopeVersion) return;
          target.set(resolveSlice(outcome));
        });
    };

    switch (key) {
      case 'rankings':
        run(
          this.rankingsSlice,
          this.tab() === 'dwell'
            ? this.api.report<RankingReport>('dwell/rankings', filter, {
                metric: this.dwellMetric(),
              })
            : this.api.report<RankingReport>('zones/rankings', filter, { metric: this.metric() }),
        );
        break;
      case 'occupancy':
        run(this.occupancySlice, this.api.report<OccupancyReport>('occupancy', filter));
        break;
      case 'peaks':
        run(this.peaksSlice, this.api.report<PeakHoursReport>('peak-hours', filter));
        break;
      case 'utilization':
        run(
          this.utilizationSlice,
          this.api.report<UtilizationReport>('occupancy/utilization', filter),
        );
        break;
      case 'traffic':
        run(this.trafficSlice, this.api.report<TrafficReport>('traffic', filter));
        break;
      case 'trends':
        run(this.trendsSlice, this.api.report<TrafficReport>('traffic/trends', filter));
        break;
      case 'dwell':
        run(this.dwellSlice, this.api.report<DwellReport>('dwell', filter));
        break;
      case 'wrongWay':
        run(this.wrongWaySlice, this.api.report<WrongWayReport>('wrong-way', filter));
        break;
      case 'staff':
        run(this.staffSlice, this.api.report<StaffReport>('staff', filter));
        break;
    }
  }

  retryZoneReport(part: 'summary' | 'series'): void {
    const zoneId = this.selectedZone();
    const filter = this.filter();
    if (!zoneId || !filter) return;
    const scope = this.activeZoneScopeVersion;

    if (part === 'summary') {
      if (this.zoneSummarySlice().status === 'loading') return;
      this.zoneSummarySlice.set(loadingSlice());
      safeReport(this.api.report<ZoneResult>(`zones/${zoneId}/summary`, filter))
        .pipe(takeUntil(this.cancelZoneRetries$), takeUntilDestroyed(this.destroy))
        .subscribe((outcome) => {
          if (scope !== this.activeZoneScopeVersion) return;
          this.zoneSummarySlice.set(resolveSlice(outcome));
        });
    } else {
      if (this.zoneSeriesSlice().status === 'loading') return;
      this.zoneSeriesSlice.set(loadingSlice());
      safeReport(this.api.report<ReportResult>(`zones/${zoneId}/timeseries`, filter))
        .pipe(takeUntil(this.cancelZoneRetries$), takeUntilDestroyed(this.destroy))
        .subscribe((outcome) => {
          if (scope !== this.activeZoneScopeVersion) return;
          this.zoneSeriesSlice.set(resolveSlice(outcome));
        });
    }
  }

  reload(): void {
    this.version.update((value) => value + 1);
  }

  peakTime(utc: string | null, ms: number | null): string {
    const period = this.period();
    return period?.timeBasis === 'sourceTime'
      ? this.sourceTime(ms)
      : utc
        ? this.date(utc, period?.timeZoneId)
        : 'N/A';
  }

  bucket(point: ZonePeriod | null): string {
    return !point
      ? 'N/A'
      : this.period()?.timeBasis === 'sourceTime'
        ? this.sourceTime(point.period.startSourceTimeMs)
        : this.date(point.period.startUtc, this.period()?.timeZoneId);
  }

  utilization(id: string) {
    return this.utilizationSlice().data?.zones.find((zone) => zone.zoneId === id);
  }

  onTabsKey(event: KeyboardEvent): void {
    const element = event.target as HTMLButtonElement;
    const buttons = Array.from(
      element.parentElement!.querySelectorAll<HTMLButtonElement>('button'),
    );
    const index = buttons.indexOf(element);
    const forward = this.i18n.dir() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.i18n.dir() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const next =
      event.key === forward
        ? (index + 1) % buttons.length
        : event.key === backward
          ? (index - 1 + buttons.length) % buttons.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : -1;
    if (next >= 0) {
      event.preventDefault();
      buttons[next].focus();
      buttons[next].click();
    }
  }

  private animateEntrance(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.elementRef.nativeElement as HTMLElement;
    const ctx = gsap.context(() => {
      if (host.querySelector('.analytics-command-bar')) {
        gsap.from('.analytics-command-bar', {
          opacity: 0,
          y: -8,
          duration: 0.35,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      }
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
}
