import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { auditTime, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { FeedState, Realtime } from '../../core/realtime';
import { OccupancyReport, OverviewReport, ReportFilter } from '../../core/models';
import { duration, number, timestamp } from '../../core/format';
import { zonePoints } from '../../core/report-presenter';
import { ReportFilters } from '../analytics/report-filters';
import { Icon } from '../../ui/icon';
import { StateView, Metric } from '../../ui/feedback';
import { Chart } from '../../ui/chart';
import { Quality } from '../../ui/quality';
import { Status } from '../../ui/status';
import { Table } from '../../ui/table';
@Component({
  selector: 'app-overview',
  imports: [RouterLink, ReportFilters, Icon, StateView, Metric, Chart, Quality, Status, Table],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  readonly context = inject(AppContext);
  readonly realtime = inject(Realtime);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
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
      { label: 'Most visited zone', row: report?.mostVisitedZone, unit: 'zone arrivals' },
      { label: 'Top entry zone', row: report?.topEntryZone, unit: 'gate entries' },
      { label: 'Most crowded zone', row: report?.mostCrowdedZone, unit: 'average occupancy' },
      { label: 'Peak occupancy', row: report?.peakOccupancy, unit: 'people in one zone' },
      { label: 'Longest active stay', row: report?.longestActiveStay, unit: 'duration' },
      {
        label: 'Estimated historical dwell',
        row: report?.estimatedHistoricalDwell,
        unit: 'estimated duration',
      },
    ];
  });
  readonly num = number;
  readonly date = timestamp;
  readonly duration = duration;
  readonly points = zonePoints;
  constructor() {
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
      });
    this.realtime.summaries
      .pipe(auditTime(3000), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.reportVersion.update((value) => value + 1));
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
