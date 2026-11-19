import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { UiError, apiError } from '../../core/api';
import { SmartApi } from '../../core/smart-api';
import { PeriodPoint, ReportFilter, ReportPeriod } from '../../core/models';
import {
  CongestionHistory,
  CongestionReport,
  DwellDistributionReport,
  FlowReport,
  InsightsReport,
  QualityReport,
} from '../../core/smart-models';
import { LocalizedFormat } from '../../core/localized-format';
import { I18nService, TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Table, Pagination } from '../../ui/table';
import { MetricQualityView } from '../../ui/metric-quality';
import { VisualizationView } from '../../ui/visualization';
import { ReportFilters } from './report-filters';
import { Icon, IconName } from '../../ui/icon';
import { Chart, ChartPoint } from '../../ui/chart';
import { Drawer } from '../../ui/drawer';

interface SmartResult {
  loading: boolean;
  error?: UiError;
  flow?: FlowReport;
  congestion?: CongestionReport;
  history?: CongestionHistory;
  dwell?: DwellDistributionReport;
  quality?: QualityReport;
  insights?: InsightsReport;
}

@Component({
  selector: 'app-smart-analytics',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    StateView,
    Table,
    Pagination,
    MetricQualityView,
    VisualizationView,
    ReportFilters,
    Icon,
    Chart,
    Drawer,
  ],
  templateUrl: './smart-analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmartAnalytics {
  private readonly api = inject(SmartApi);
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  readonly format = inject(LocalizedFormat);
  readonly num = this.format.number;

  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  readonly section = computed(
    () =>
      this.routeData()['section'] as
        'flow' | 'congestion' | 'distribution' | 'quality' | 'insights',
  );

  readonly sectionIcon = computed<IconName>(() => {
    switch (this.section()) {
      case 'flow':
        return 'chart';
      case 'congestion':
        return 'warning';
      case 'distribution':
        return 'pulse';
      case 'quality':
        return 'signal';
      case 'insights':
        return 'overview';
      default:
        return 'chart';
    }
  });

  readonly filter = signal<ReportFilter | null>(null);
  readonly version = signal(0);
  readonly page = signal(1);
  readonly metric = signal('arrivalsPerMinute');
  readonly chartType = signal('');
  readonly longStay = signal(false);

  // Interactive workspace state
  readonly selectedZoneId = signal<string | null>(null);
  readonly selectedCameraId = signal<string | null>(null);
  readonly selectedEpisodeId = signal<string | null>(null);
  readonly selectedInsightKey = signal<string | null>(null);
  readonly dwellBinMode = signal<'completed' | 'active'>('completed');
  readonly zoneSearch = signal('');
  readonly cameraSearch = signal('');
  readonly insightsFilter = signal<'all' | 'critical' | 'warning' | 'info'>('all');
  readonly cameraBucketPage = signal(1);
  readonly drawerOpen = signal(false);
  readonly drawerType = signal<'zone' | 'camera' | 'episode' | 'insight' | null>(null);
  readonly showExplorer = signal(false);

  constructor() {
    effect(() => {
      const sec = this.section();
      untracked(() => {
        if (
          sec === 'flow' &&
          !['arrivalsPerMinute', 'departuresPerMinute', 'trafficBalance', 'entryExit'].includes(
            this.metric(),
          )
        ) {
          this.metric.set('arrivalsPerMinute');
          this.chartType.set('');
        } else if (
          sec === 'congestion' &&
          !['averageOccupancy', 'peakOccupancy', 'utilization', 'congestion'].includes(this.metric())
        ) {
          this.metric.set('averageOccupancy');
          this.chartType.set('');
        } else if (
          sec === 'distribution' &&
          !['completedDwell', 'activeDwell'].includes(this.metric())
        ) {
          this.metric.set('completedDwell');
          this.chartType.set('');
        } else if (
          sec === 'quality' &&
          !['fps', 'missingSequences', 'dataQualityTimeline'].includes(this.metric())
        ) {
          this.metric.set('fps');
          this.chartType.set('');
        }
      });
    });
  }

  readonly chartTypes = computed(() => {
    const metric = this.metric();
    if (['arrivalsPerMinute', 'departuresPerMinute', 'staff'].includes(metric))
      return ['line', 'area'];
    if (metric === 'arrivals') return ['line', 'area', 'groupedBar'];
    if (metric === 'averageOccupancy') return ['area', 'line'];
    if (metric === 'wrongWay') return ['line', 'groupedBar'];
    if (['entryExit', 'missingSequences'].includes(metric)) return ['groupedBar'];
    if (metric === 'trafficBalance') return ['divergingBar'];
    if (['activeDwell', 'completedDwell'].includes(metric)) return ['histogram'];
    if (metric === 'utilization') return ['gauge'];
    return ['congestion', 'dataQualityTimeline'].includes(metric) ? ['timeline'] : ['line'];
  });

  readonly metrics = [
    'arrivalsPerMinute',
    'departuresPerMinute',
    'arrivals',
    'entryExit',
    'trafficBalance',
    'averageOccupancy',
    'peakOccupancy',
    'wrongWay',
    'staff',
    'fps',
    'missingSequences',
    'activeDwell',
    'completedDwell',
    'utilization',
    'congestion',
    'dataQualityTimeline',
  ];

  readonly result = toSignal(
    toObservable(
      computed(() => ({
        filter: this.filter(),
        section: this.section(),
        page: this.page(),
        longStay: this.longStay(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ filter, section, page, longStay }) => {
        if (!filter) return of<SmartResult>({ loading: false });
        const request: Observable<Omit<SmartResult, 'loading'>> =
          section === 'flow'
            ? this.api.flow(filter).pipe(map((flow) => ({ flow })))
            : section === 'congestion'
              ? forkJoin({
                  congestion: this.api.congestion(filter),
                  history: this.api.congestionHistory(filter, page),
                })
              : section === 'distribution'
                ? this.api.dwell(filter, longStay).pipe(map((dwell) => ({ dwell })))
                : section === 'quality'
                  ? this.api.quality(filter).pipe(map((quality) => ({ quality })))
                  : this.api.insights(filter).pipe(map((insights) => ({ insights })));
        return request.pipe(
          map((data) => ({ ...data, loading: false })),
          catchError((error) => of<SmartResult>({ loading: false, error: apiError(error) })),
          startWith<SmartResult>({ loading: true }),
        );
      }),
    ),
    { initialValue: { loading: false } as SmartResult },
  );

  readonly chart = toSignal(
    toObservable(
      computed(() => ({
        filter: this.filter(),
        metric: this.metric(),
        type: this.chartType(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ filter, metric, type }) =>
        filter
          ? this.api.visualization(metric, filter, type || undefined).pipe(
              map((value) => ({ value, loading: false, error: null })),
              catchError((error) => of({ value: null, loading: false, error: apiError(error) })),
              startWith({ value: null, loading: true, error: null }),
            )
          : of({ value: null, loading: false, error: null }),
      ),
    ),
    { initialValue: { value: null, loading: false, error: null } },
  );

  // VIEWMODELS FOR EACH PAGE

  // Flow ViewModel
  readonly flowVm = computed(() => {
    const report = this.result().flow;
    if (!report) return null;
    const zones = report.zones;
    const search = this.zoneSearch().toLowerCase().trim();

    let totalArrivals = 0;
    let totalDepartures = 0;
    let validArrivalsCount = 0;
    let validDeparturesCount = 0;
    let netBalance = 0;
    let peakZoneName = 'N/A';
    let maxFlow = -1;

    const enrichedZones = zones.map((z) => {
      const bucketArr = z.buckets
        .map((b) => b.eventsPerMinute?.arrivals)
        .filter((v): v is number => v != null);
      const bucketDep = z.buckets
        .map((b) => b.eventsPerMinute?.departures)
        .filter((v): v is number => v != null);

      const arr =
        z.total.eventsPerMinute?.arrivals ??
        (bucketArr.length > 0 ? bucketArr.reduce((a, b) => a + b, 0) / bucketArr.length : null);
      const dep =
        z.total.eventsPerMinute?.departures ??
        (bucketDep.length > 0 ? bucketDep.reduce((a, b) => a + b, 0) / bucketDep.length : null);
      const bal = z.total.trafficBalance;

      if (arr != null) {
        totalArrivals += arr;
        validArrivalsCount++;
      }
      if (dep != null) {
        totalDepartures += dep;
        validDeparturesCount++;
      }
      if (bal != null) {
        netBalance += bal;
      }
      const activityScore =
        arr != null || dep != null
          ? (arr ?? 0) + (dep ?? 0)
          : (z.total.observedCounts?.arrivals ?? 0) + (z.total.observedCounts?.departures ?? 0);
      if (activityScore > maxFlow && activityScore > 0) {
        maxFlow = activityScore;
        peakZoneName = z.zoneName;
      }
      return { ...z, effectiveArrivalsRate: arr, effectiveDeparturesRate: dep };
    });

    const filteredZones = search
      ? enrichedZones.filter((z) => z.zoneName.toLowerCase().includes(search))
      : enrichedZones;

    const avgArrivals = validArrivalsCount > 0 ? totalArrivals / validArrivalsCount : null;
    const avgDepartures = validDeparturesCount > 0 ? totalDepartures / validDeparturesCount : null;

    const selId = this.selectedZoneId();
    const activeZone =
      (selId ? enrichedZones.find((z) => z.scope.zoneId === selId) : null) ??
      enrichedZones[0] ??
      null;

    const chartPoints: ChartPoint[] = (activeZone?.buckets ?? []).map((b) => ({
      label: this.formatPeriod(b.period, report.period),
      value: b.eventsPerMinute?.arrivals ?? null,
      secondary: b.eventsPerMinute?.departures ?? null,
      metricQuality: b.quality,
    }));

    return {
      report,
      zones: enrichedZones,
      filteredZones,
      avgArrivals,
      avgDepartures,
      netBalance,
      peakZoneName,
      activeZone,
      activeZoneId: activeZone?.scope.zoneId ?? null,
      chartPoints,
      hasBuckets: chartPoints.some((p) => p.value !== null || p.secondary !== null),
    };
  });

  // Congestion ViewModel
  readonly congestionVm = computed(() => {
    const report = this.result().congestion;
    const history = this.result().history;
    if (!report) return null;
    const zones = report.zones;

    let maxPeakUtil: number | null = null;
    let totalWarnSec = 0;
    let totalCritSec = 0;
    let activeEpisodesCount = 0;

    for (const z of zones) {
      if (z.peakUtilizationPercent != null) {
        if (maxPeakUtil == null || z.peakUtilizationPercent > maxPeakUtil) {
          maxPeakUtil = z.peakUtilizationPercent;
        }
      }
      if (z.aboveWarningSeconds != null) totalWarnSec += z.aboveWarningSeconds;
      if (z.aboveCriticalSeconds != null) totalCritSec += z.aboveCriticalSeconds;
      for (const ep of z.episodes ?? []) {
        if (ep.status?.toLowerCase() === 'active') activeEpisodesCount++;
      }
    }

    const historyItems = history?.episodes?.items ?? [];
    const historyActive = historyItems.filter((e) => e.status?.toLowerCase() === 'active').length;
    const effectiveActive = Math.max(activeEpisodesCount, historyActive);

    const selId = this.selectedZoneId();
    const activeZone =
      (selId ? zones.find((z) => z.scope.zoneId === selId) : null) ?? zones[0] ?? null;

    const selEpId = this.selectedEpisodeId();
    const selectedEpisode = historyItems.find((e) => e.id === selEpId) ?? null;

    return {
      report,
      zones,
      activeZone,
      activeZoneId: activeZone?.scope.zoneId ?? null,
      maxPeakUtil,
      totalWarnSec,
      totalCritSec,
      effectiveActive,
      history,
      historyItems,
      selectedEpisode,
    };
  });

  // Dwell ViewModel
  readonly dwellVm = computed(() => {
    const report = this.result().dwell;
    if (!report) return null;
    const zones = report.zones;

    let totalAvgDwell = 0;
    let validAvgCount = 0;
    let longestActive: number | null = null;
    let totalLongStay = 0;
    let highestDwellZone = 'N/A';
    let maxDwellVal = -1;

    for (const z of zones) {
      const avg = z.estimatedCompletedAverageDwellSeconds;
      if (avg != null) {
        totalAvgDwell += avg;
        validAvgCount++;
        if (avg > maxDwellVal) {
          maxDwellVal = avg;
          highestDwellZone = z.zoneName;
        }
      }
      if (z.longestActiveDwellSeconds != null) {
        if (longestActive == null || z.longestActiveDwellSeconds > longestActive) {
          longestActive = z.longestActiveDwellSeconds;
        }
      }
      if (z.longStayActiveCount != null) {
        totalLongStay += z.longStayActiveCount;
      }
    }

    const overallAvgDwell = validAvgCount > 0 ? totalAvgDwell / validAvgCount : null;

    const selId = this.selectedZoneId();
    const activeZone =
      (selId ? zones.find((z) => z.scope.zoneId === selId) : null) ?? zones[0] ?? null;

    const mode = this.dwellBinMode();
    const bins =
      mode === 'completed'
        ? (activeZone?.estimatedCompletedBins ?? [])
        : (activeZone?.activeBins ?? []);

    const histogramPoints: ChartPoint[] = bins.map((b) => ({
      label:
        b.upperSeconds != null ? `${b.lowerSeconds}–${b.upperSeconds}s` : `>${b.lowerSeconds}s`,
      value: b.count,
      metricQuality:
        mode === 'completed' ? activeZone?.completedQuality : activeZone?.activeQuality,
    }));

    return {
      report,
      zones,
      threshold: report.longStayThresholdSeconds,
      overallAvgDwell,
      longestActive,
      totalLongStay,
      highestDwellZone,
      activeZone,
      activeZoneId: activeZone?.scope.zoneId ?? null,
      histogramPoints,
      hasBins: histogramPoints.some((p) => (p.value ?? 0) > 0),
    };
  });

  // Quality ViewModel
  readonly qualityVm = computed(() => {
    const report = this.result().quality;
    if (!report) return null;
    const cameras = report.cameras;
    const search = this.cameraSearch().toLowerCase().trim();

    let freshCount = 0;
    let totalFps = 0;
    let validFpsCount = 0;
    let totalMissing = 0;
    let totalLatency = 0;
    let validLatencyCount = 0;

    const cameraRows = cameras.map((c) => {
      if (c.freshness?.toLowerCase() === 'fresh') freshCount++;
      const bucketMissing = c.buckets.reduce((acc, b) => acc + (b.missingSequences ?? 0), 0);
      totalMissing += bucketMissing;

      let cLatencySum = 0;
      let cLatencyCount = 0;
      let cFpsSum = 0;
      let cFpsCount = 0;
      for (const b of c.buckets) {
        if (b.averageSourceToReceiptMs != null) {
          cLatencySum += b.averageSourceToReceiptMs;
          cLatencyCount++;
          totalLatency += b.averageSourceToReceiptMs;
          validLatencyCount++;
        }
        if (b.averageFps != null) {
          cFpsSum += b.averageFps;
          cFpsCount++;
        }
      }

      const rowAvgFps = cFpsCount > 0 ? cFpsSum / cFpsCount : null;
      const effectiveFps = c.latestProcessingFps ?? rowAvgFps;
      if (effectiveFps != null) {
        totalFps += effectiveFps;
        validFpsCount++;
      }

      return {
        camera: c,
        name: c.cameraName,
        freshness: c.freshness,
        latestFps: c.latestProcessingFps,
        avgFps: rowAvgFps,
        totalMissing: bucketMissing,
        avgLatency: cLatencyCount > 0 ? cLatencySum / cLatencyCount : null,
        bucketCount: c.buckets.length,
        lastReceivedAtUtc: c.lastReceivedAtUtc,
      };
    });

    const filteredCameraRows = search
      ? cameraRows.filter((r) => r.name.toLowerCase().includes(search))
      : cameraRows;

    const avgFps = validFpsCount > 0 ? totalFps / validFpsCount : null;
    const avgLatency = validLatencyCount > 0 ? totalLatency / validLatencyCount : null;

    const selCamId = this.selectedCameraId();
    const selectedCamera =
      (selCamId ? cameras.find((c) => c.scope.cameraId === selCamId) : null) ?? cameras[0] ?? null;

    // Paginated buckets for drawer
    const bucketPage = this.cameraBucketPage();
    const pageSize = 10;
    const allBuckets = selectedCamera?.buckets ?? [];
    const totalBucketPages = Math.max(1, Math.ceil(allBuckets.length / pageSize));
    const paginatedBuckets = allBuckets.slice((bucketPage - 1) * pageSize, bucketPage * pageSize);

    return {
      report,
      cameras,
      cameraRows,
      filteredCameraRows,
      freshCount,
      totalCount: cameras.length,
      avgFps,
      totalMissing,
      avgLatency,
      rejections: report.rejections ?? [],
      selectedCamera,
      paginatedBuckets,
      bucketPage,
      totalBucketPages,
      totalBuckets: allBuckets.length,
    };
  });

  // Insights ViewModel
  readonly insightsVm = computed(() => {
    const report = this.result().insights;
    if (!report) return null;
    const items = report.items ?? [];
    const filter = this.insightsFilter();

    const filteredItems =
      filter === 'all' ? items : items.filter((item) => item.severity?.toLowerCase() === filter);

    const criticalCount = items.filter((i) => i.severity?.toLowerCase() === 'critical').length;
    const warningCount = items.filter((i) => i.severity?.toLowerCase() === 'warning').length;
    const infoCount = items.filter((i) => i.severity?.toLowerCase() === 'info').length;

    const selKey = this.selectedInsightKey();
    const selectedInsight =
      (selKey ? items.find((i) => i.insightKey === selKey) : null) ?? items[0] ?? null;

    return {
      report,
      items,
      filteredItems,
      totalCount: items.length,
      criticalCount,
      warningCount,
      infoCount,
      coveragePercent: report.quality?.coveragePercent ?? null,
      quality: report.quality,
      selectedInsight,
      hasItems: items.length > 0,
    };
  });

  // Selected Zone for Drawer
  readonly selectedZoneForDrawer = computed(() => {
    const selId = this.selectedZoneId();
    if (!selId) return null;
    if (this.section() === 'flow') {
      return this.flowVm()?.zones.find((z) => z.scope.zoneId === selId) ?? null;
    }
    if (this.section() === 'congestion') {
      return this.congestionVm()?.zones.find((z) => z.scope.zoneId === selId) ?? null;
    }
    if (this.section() === 'distribution') {
      return this.dwellVm()?.zones.find((z) => z.scope.zoneId === selId) ?? null;
    }
    return null;
  });

  // ACTIONS

  openZoneDrawer(zoneId: string): void {
    this.selectedZoneId.set(zoneId);
    this.drawerType.set('zone');
    this.drawerOpen.set(true);
  }

  openCameraDrawer(cameraId: string): void {
    this.selectedCameraId.set(cameraId);
    this.cameraBucketPage.set(1);
    this.drawerType.set('camera');
    this.drawerOpen.set(true);
  }

  openEpisodeDrawer(episodeId: string): void {
    this.selectedEpisodeId.set(episodeId);
    this.drawerType.set('episode');
    this.drawerOpen.set(true);
  }

  openInsightDrawer(insightKey: string): void {
    this.selectedInsightKey.set(insightKey);
    this.drawerType.set('insight');
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.drawerType.set(null);
  }

  formatPeriod(point: PeriodPoint, period: ReportPeriod): string {
    return period.timeBasis === 'sourceTime'
      ? this.format.sourceTime(point.startSourceTimeMs)
      : this.format.timestamp(point.startUtc, period.timeZoneId);
  }

  formatSeconds(sec: number | null | undefined): string {
    if (sec == null) return 'N/A';
    if (sec < 60) return `${this.num(sec)}s`;
    if (sec < 3600) {
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}m ${s}s`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }

  metricLabel(m: string): string {
    const key = `${m}.label`;
    const translated = this.i18n.t(key);
    return translated !== key ? translated : m;
  }

  chartTypeLabel(t: string): string {
    const key = `chartType.${t}`;
    const translated = this.i18n.t(key);
    return translated !== key ? translated : t;
  }

  apply(filter: ReportFilter): void {
    this.page.set(1);
    this.filter.set(filter);
  }

  reload(): void {
    this.version.update((v) => v + 1);
  }
}
