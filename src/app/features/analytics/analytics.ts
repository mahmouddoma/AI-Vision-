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
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { gsap } from 'gsap';
import { Api, UiError, apiError } from '../../core/api';
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
import { Chart, ChartPoint } from '../../ui/chart';
import { StateView } from '../../ui/feedback';
import { Icon, IconName } from '../../ui/icon';
import { Quality } from '../../ui/quality';
import { Status } from '../../ui/status';
import { Table } from '../../ui/table';
import { I18nService, TranslatePipe } from '../../core/i18n';
import { ReportFilters } from './report-filters';

type Tab = 'rankings' | 'occupancy' | 'traffic' | 'dwell' | 'wrong-way' | 'staff';
interface AnalyticsData {
  rankings?: RankingReport;
  occupancy?: OccupancyReport;
  peaks?: PeakHoursReport;
  utilization?: UtilizationReport;
  traffic?: TrafficReport;
  trends?: TrafficReport;
  dwell?: DwellReport;
  wrongWay?: WrongWayReport;
  staff?: StaffReport;
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
  readonly data = signal<AnalyticsData | null>(null);
  readonly loading = signal(false);
  readonly error = signal<UiError | null>(null);
  private readonly version = signal(0);
  readonly period = computed(() => {
    const data = this.data();
    return (
      data?.rankings?.period ??
      data?.occupancy?.period ??
      data?.traffic?.period ??
      data?.dwell?.period ??
      data?.wrongWay?.period ??
      data?.staff?.period
    );
  });
  readonly rankingPoints = computed<ChartPoint[]>(() =>
    (this.data()?.rankings?.items ?? []).map((item) => ({
      label: item.zoneName,
      value: item.dataQuality.kind === 'InsufficientData' ? null : item.value,
      quality: item.dataQuality,
    })),
  );
  readonly dwellPoints = computed<ChartPoint[]>(() =>
    (this.data()?.dwell?.zones ?? []).map((zone) => ({
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
    const data = this.data();
    if (!data) return true;
    if (this.tab() === 'rankings') return !data.rankings?.items.length;
    if (this.tab() === 'occupancy') return !data.occupancy?.zones.length;
    if (this.tab() === 'traffic') return !data.traffic?.zones.length;
    if (this.tab() === 'dwell') return !data.dwell?.zones.length;
    if (this.tab() === 'wrong-way') return !data.wrongWay?.zones.length;
    return !data.staff?.cameras.length;
  });
  readonly selectedZone = signal<string | null>(null);
  readonly zoneData = signal<{ summary: ZoneResult; series: ReportResult } | null>(null);
  readonly zoneError = signal<UiError | null>(null);
  readonly zoneLoading = signal(false);
  readonly hasTrafficData = computed(
    () =>
      this.data()?.traffic?.zones.some((zone) => zone.dataQuality.kind !== 'InsufficientData') ??
      false,
  );
  readonly hasWrongWayData = computed(
    () =>
      this.data()?.wrongWay?.zones.some((zone) => zone.dataQuality.kind !== 'InsufficientData') ??
      false,
  );
  readonly num = inject(LocalizedFormat).number;
  readonly duration = inject(LocalizedFormat).duration;
  readonly sourceTime = inject(LocalizedFormat).sourceTime;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly points = inject(LocalizedFormat).zonePoints;
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
        switchMap(({ filter, tab, metric, dwellMetric }) => {
          if (!filter) return of(null);
          this.loading.set(true);
          this.error.set(null);
          let request: Observable<AnalyticsData>;
          if (tab === 'rankings')
            request = forkJoin({
              rankings: this.api.report<RankingReport>('zones/rankings', filter, { metric }),
            });
          else if (tab === 'occupancy')
            request = forkJoin({
              occupancy: this.api.report<OccupancyReport>('occupancy', filter),
              peaks: this.api.report<PeakHoursReport>('peak-hours', filter),
              utilization: this.api.report<UtilizationReport>('occupancy/utilization', filter),
            });
          else if (tab === 'traffic')
            request = forkJoin({
              traffic: this.api.report<TrafficReport>('traffic', filter),
              trends: this.api.report<TrafficReport>('traffic/trends', filter),
            });
          else if (tab === 'dwell')
            request = forkJoin({
              dwell: this.api.report<DwellReport>('dwell', filter),
              rankings: this.api.report<RankingReport>('dwell/rankings', filter, {
                metric: dwellMetric,
              }),
            });
          else if (tab === 'wrong-way')
            request = forkJoin({ wrongWay: this.api.report<WrongWayReport>('wrong-way', filter) });
          else request = forkJoin({ staff: this.api.report<StaffReport>('staff', filter) });
          return request.pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.data.set(result?.data ?? null);
        this.error.set(result?.error ?? null);
      });
    toObservable(computed(() => ({ zoneId: this.selectedZone(), filter: this.filter() })))
      .pipe(
        switchMap(({ zoneId, filter }) => {
          if (!zoneId || !filter) return of(null);
          this.zoneLoading.set(true);
          this.zoneError.set(null);
          return forkJoin({
            summary: this.api.report<ZoneResult>(`zones/${zoneId}/summary`, filter),
            series: this.api.report<ReportResult>(`zones/${zoneId}/timeseries`, filter),
          }).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.zoneLoading.set(false);
        this.zoneData.set(result?.data ?? null);
        this.zoneError.set(result?.error ?? null);
      });
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
  readonly staffPoints = inject(LocalizedFormat).staffPoints;
  utilization(id: string) {
    return this.data()?.utilization?.zones.find((zone) => zone.zoneId === id);
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
      if (host.querySelector('.page-heading')) {
        gsap.from('.page-heading', {
          opacity: 0,
          y: -10,
          duration: 0.4,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      }
      if (host.querySelector('app-report-filters')) {
        gsap.from('app-report-filters', {
          opacity: 0,
          y: 12,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.06,
          clearProps: 'opacity,transform',
        });
      }
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
}
