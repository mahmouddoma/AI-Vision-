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
import { calculateLiveOccupancy, describeLiveOccupancy } from '../../core/live-occupancy';
import { OccupancyReport, OverviewReport, ReportFilter } from '../../core/models';
import { ReportFilters } from '../analytics/report-filters';
import { Icon } from '../../ui/icon';
import { StateView } from '../../ui/feedback';
import { Chart, ChartPoint } from '../../ui/chart';
import { Quality } from '../../ui/quality';
import { Status } from '../../ui/status';
import { TranslatePipe } from '../../core/i18n';

interface DonutSlice {
  key: string;
  label: string;
  value: number;
  percent: number;
  color: string;
  dasharray: string;
  dashoffset: number;
}

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
  readonly selectedZoneId = signal<string | null>(null);

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

  readonly occupancySummary = computed(() =>
    calculateLiveOccupancy(this.feed().cameras, { disconnected: Boolean(this.feed().error) }),
  );
  readonly occupancy = computed(() => this.occupancySummary().observedOccupancy);
  readonly occupancyView = computed(() =>
    describeLiveOccupancy(this.occupancySummary(), this.feed().loading),
  );
  readonly freshCount = computed(() => this.occupancySummary().freshCameras);

  readonly activeZone = computed(() => {
    const zones = this.occupancyReport()?.zones ?? [];
    if (!zones.length) return null;
    const selected = this.selectedZoneId();
    return (
      (selected ? zones.find((z) => z.zoneId === selected) : null) ??
      zones.find((z) => z.dataQuality.sampleCount > 0) ??
      zones[0]
    );
  });

  readonly format = inject(LocalizedFormat);
  readonly num = this.format.number;
  readonly date = this.format.timestamp;
  readonly duration = this.format.duration;
  readonly points = this.format.zonePoints;

  readonly occupancyPoints = computed<ChartPoint[]>(() => {
    const zone = this.activeZone();
    const period = this.occupancyReport()?.period;
    if (!zone || !period) return [];
    return this.points(zone.series, period);
  });

  readonly flowBarPoints = computed<ChartPoint[]>(() => {
    const zone = this.activeZone();
    const period = this.occupancyReport()?.period;
    if (!zone || !period) return [];
    return zone.series.map((b) => ({
      label:
        period.timeBasis === 'sourceTime'
          ? this.format.sourceTime(b.period.startSourceTimeMs)
          : this.format.timestamp(b.period.startUtc, period.timeZoneId),
      value: b.dataQuality.kind === 'InsufficientData' ? null : (b.traffic?.arrivals ?? 0),
      secondary: b.dataQuality.kind === 'InsufficientData' ? null : (b.traffic?.departures ?? 0),
      quality: b.dataQuality,
    }));
  });

  readonly gateBarPoints = computed<ChartPoint[]>(() => {
    const zone = this.activeZone();
    const period = this.occupancyReport()?.period;
    if (!zone || !period) return [];
    return zone.series.map((b) => ({
      label:
        period.timeBasis === 'sourceTime'
          ? this.format.sourceTime(b.period.startSourceTimeMs)
          : this.format.timestamp(b.period.startUtc, period.timeZoneId),
      value: b.dataQuality.kind === 'InsufficientData' ? null : (b.traffic?.entries ?? 0),
      secondary: b.dataQuality.kind === 'InsufficientData' ? null : (b.traffic?.exits ?? 0),
      quality: b.dataQuality,
    }));
  });

  readonly trafficMix = computed(() => {
    const zone = this.activeZone();
    const series = zone?.series ?? [];
    let arrivals = 0;
    let entries = 0;
    let departures = 0;
    let exits = 0;
    let wrongWay = 0;

    for (const b of series) {
      if (b.dataQuality.kind === 'InsufficientData' || !b.traffic) continue;
      arrivals += b.traffic.arrivals ?? 0;
      entries += b.traffic.entries ?? 0;
      departures += b.traffic.departures ?? 0;
      exits += b.traffic.exits ?? 0;
      wrongWay += b.traffic.wrongWayEvents ?? 0;
    }

    const raw = [
      { key: 'arrivals', label: 'Zone arrivals', value: arrivals, color: '#0ea5e9' },
      { key: 'entries', label: 'Gate entries', value: entries, color: '#10b981' },
      { key: 'departures', label: 'Zone departures', value: departures, color: '#8b5cf6' },
      { key: 'exits', label: 'Gate exits', value: exits, color: '#f59e0b' },
      { key: 'wrongWay', label: 'Wrong-way events', value: wrongWay, color: '#f43f5e' },
    ];

    const total = raw.reduce((sum, item) => sum + item.value, 0);
    const circumference = 2 * Math.PI * 42;
    let offset = 0;

    const slices: DonutSlice[] = raw.map((item) => {
      const share = total > 0 ? item.value / total : 0;
      const len = share * circumference;
      const slice: DonutSlice = {
        ...item,
        percent: share * 100,
        dasharray: `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`,
        dashoffset: -offset,
      };
      offset += len;
      return slice;
    });

    return { total, slices, arrivals, entries };
  });

  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });

    let loadedScopeKey = '';

    toObservable(
      computed(() => {
        const version = this.reportVersion();
        return { filter: this.filter(), site: this.context.selectedSiteId(), version };
      }),
    )
      .pipe(
        switchMap(({ filter, site }) => {
          if (!filter || !site) {
            loadedScopeKey = '';
            return of({ data: null, error: null, silent: false });
          }
          const scopeKey = `${site}::${JSON.stringify(filter)}`;
          const silent = scopeKey === loadedScopeKey && this.occupancyReport() !== null;
          if (!silent) {
            this.reportLoading.set(true);
            this.reportError.set(null);
            if (!loadedScopeKey.startsWith(`${site}::`)) {
              this.report.set(null);
              this.occupancyReport.set(null);
            }
          }
          return forkJoin({
            overview: this.api.report<OverviewReport>('overview', filter),
            occupancy: this.api.report<OccupancyReport>('occupancy', filter),
          }).pipe(
            map((data) => {
              loadedScopeKey = scopeKey;
              return { data, error: null, silent };
            }),
            catchError((error) => of({ data: null, error: apiError(error), silent })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.reportLoading.set(false);
        if (result.data) {
          this.report.set(result.data.overview);
          this.occupancyReport.set(result.data.occupancy);
          this.reportError.set(null);
        } else if (!result.silent) {
          this.report.set(null);
          this.occupancyReport.set(null);
          this.reportError.set(result.error);
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
      if (host.querySelector('.ov-kpi-card')) {
        gsap.from('.ov-kpi-card', {
          opacity: 0,
          y: 12,
          duration: 0.35,
          stagger: 0.05,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      }
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }

  zoneCamera(id: string): string | undefined {
    return this.feed().cameras.find((camera) => camera.zones.some((zone) => zone.zoneId === id))
      ?.cameraId;
  }

  zoneCameraName(id: string): string | undefined {
    return this.feed().cameras.find((camera) => camera.zones.some((zone) => zone.zoneId === id))
      ?.cameraName;
  }

  refresh(): void {
    this.context.refresh();
    this.feedVersion.update((value) => value + 1);
    this.reportVersion.update((value) => value + 1);
  }
}
