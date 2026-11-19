import { Page, PeriodPoint, ReportPeriod, TrafficTotals } from './models';

// Wire contracts verified against backend PR #1, commit 528b8df.
export interface MetricScope {
  siteId: string;
  cameraId: string | null;
  zoneId: string | null;
}
export interface MetricQuality {
  provenance: string;
  sampleCount: number;
  coveredSeconds: number;
  coveragePercent: number;
  gapCount: number;
  resetCount: number;
  baselineCount: number;
  isPartial: boolean;
  isStale: boolean;
  warningCodes: string[];
}
export interface FlowBucket {
  period: PeriodPoint;
  observedCounts: TrafficTotals | null;
  eventsPerMinute: {
    arrivals: number;
    departures: number;
    entries: number;
    exits: number;
    wrongWayIn: number;
    wrongWayOut: number;
  } | null;
  trafficBalance: number | null;
  averageOccupancy: number | null;
  peakOccupancy: number | null;
  peakAtUtc: string | null;
  peakAtSourceTimeMs: number | null;
  quality: MetricQuality;
}
export interface FlowReport {
  period: ReportPeriod;
  zones: { scope: MetricScope; zoneName: string; total: FlowBucket; buckets: FlowBucket[] }[];
}
export interface CongestionReport {
  period: ReportPeriod;
  zones: {
    scope: MetricScope;
    zoneName: string;
    averageUtilizationPercent: number | null;
    peakUtilizationPercent: number | null;
    aboveWarningSeconds: number | null;
    aboveCriticalSeconds: number | null;
    quality: MetricQuality;
    episodes: {
      period: PeriodPoint;
      severity: string;
      aboveWarningSeconds: number;
      aboveCriticalSeconds: number;
      status: string;
      resolutionReason: string | null;
    }[];
  }[];
}
export interface CongestionHistory {
  period: ReportPeriod;
  episodes: Page<{
    id: string;
    scope: MetricScope;
    sessionId: string;
    videoLoop: number | null;
    period: PeriodPoint;
    severity: string;
    status: string;
    resolutionReason: string;
    ruleVersion: string;
    capacity: number;
    warningThresholdPercent: number;
    criticalThresholdPercent: number;
    minimumObservedSeconds: number;
    aboveWarningSeconds: number;
    aboveCriticalSeconds: number;
    quality: MetricQuality;
  }>;
}
export interface DwellDistributionReport {
  period: ReportPeriod;
  longStayThresholdSeconds: number;
  evaluatedAtUtc: string;
  zones: {
    scope: MetricScope;
    zoneName: string;
    activeCount: number | null;
    longStayActiveCount: number | null;
    longestActiveDwellSeconds: number | null;
    estimatedCompletedCount: number | null;
    estimatedCompletedTotalDwellSeconds: number | null;
    estimatedCompletedAverageDwellSeconds: number | null;
    uncertainCount: number | null;
    activeBins: DwellBin[] | null;
    estimatedCompletedBins: DwellBin[] | null;
    activeQuality: MetricQuality;
    completedQuality: MetricQuality;
    activeObservedAtUtc: string | null;
  }[];
}
export interface DwellBin {
  lowerSeconds: number;
  upperSeconds: number | null;
  count: number;
}
export interface QualityReport {
  period: ReportPeriod;
  cameras: {
    scope: MetricScope;
    cameraName: string;
    freshness: string;
    lastReceivedAtUtc: string | null;
    latestProcessingFps: number | null;
    buckets: {
      period: PeriodPoint;
      averageStaffCount: number | null;
      peakStaffCount: number | null;
      averageFps: number | null;
      minimumFps: number | null;
      maximumFps: number | null;
      missingSequences: number | null;
      averageSourceToReceiptMs: number | null;
      latencySampleCount: number;
      quality: MetricQuality;
    }[];
  }[];
  rejections: { reason: string; count: number }[] | null;
}
export interface InsightsReport {
  period: ReportPeriod;
  quality: MetricQuality;
  items: {
    insightKey: string;
    severity: string;
    title: string;
    description: string;
    metricKey: string;
    value: number;
    unit: string;
    scope: MetricScope;
    period: ReportPeriod;
    observationWindow: PeriodPoint;
    quality: MetricQuality;
    generatedAtUtc: string;
  }[];
}
export interface VisualizationPoint {
  period: PeriodPoint;
  value: number | null;
  quality: MetricQuality;
}
export interface VisualizationSeries {
  seriesId: string;
  label: string;
  scope: MetricScope;
  points: VisualizationPoint[];
}
export interface VisualizationBase {
  schemaVersion: number;
  metricKey: string;
  title: string;
  unit: string;
  period: ReportPeriod;
  sourceType: string;
  timeBasis: string;
  interval: string;
  refreshSeconds: number;
  quality: MetricQuality;
}
export interface SeriesVisualization extends VisualizationBase {
  visualizationType: 'line' | 'area' | 'groupedBar' | 'divergingBar';
  series: VisualizationSeries[];
}
export interface HistogramVisualization extends VisualizationBase {
  visualizationType: 'histogram';
  series: {
    seriesId: string;
    label: string;
    scope: MetricScope;
    bins: {
      label: string;
      lowerSeconds: number | null;
      upperSeconds: number | null;
      value: number | null;
      quality: MetricQuality;
    }[];
  }[];
}
export interface GaugeVisualization extends VisualizationBase {
  visualizationType: 'gauge';
  values: {
    scope: MetricScope;
    label: string;
    value: number | null;
    minimum: number;
    maximum: number;
    quality: MetricQuality;
    thresholds: { label: string; value: number }[];
  }[];
}
export interface TimelineVisualization extends VisualizationBase {
  visualizationType: 'timeline';
  items: {
    scope: MetricScope;
    label: string;
    period: PeriodPoint;
    severity: string;
    status: string;
    resolutionReason: string | null;
    observedSeconds: number;
    quality: MetricQuality;
  }[];
}
export interface Floor {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  rowVersion: string;
}
export interface FloorWrite {
  name: string;
  description: string | null;
  displayOrder: number;
  rowVersion?: string;
}
export interface Vertex {
  x: number;
  y: number;
}
export interface ZoneLayout {
  floorId: string;
  zoneId: string;
  cameraId: string;
  zoneName: string;
  cameraName: string;
  vertices: Vertex[];
  rowVersion: string;
}
export interface HeatmapVisualization extends VisualizationBase {
  visualizationType: 'heatmap';
  floor: Floor;
  zones: { layout: ZoneLayout; value: number | null; quality: MetricQuality }[];
}
export type Visualization =
  | SeriesVisualization
  | HistogramVisualization
  | GaugeVisualization
  | TimelineVisualization
  | HeatmapVisualization;
export type AlertKind =
  'Congestion' | 'LongStay' | 'WrongWaySpike' | 'CameraNoRecentData' | 'LowFps';
export interface AlertRuleWrite {
  siteId: string;
  cameraId: string;
  zoneId: string | null;
  name: string;
  kind: AlertKind;
  severity: 'Warning' | 'Critical';
  threshold: number;
  minimumObservedSeconds: number;
  recoverySeconds: number;
  windowSeconds: number;
  cooldownSeconds: number | null;
  minimumCoveragePercent: number | null;
  allowVideo: boolean;
  rowVersion?: string;
}
export interface AlertRule extends Omit<
  AlertRuleWrite,
  'siteId' | 'cameraId' | 'zoneId' | 'rowVersion'
> {
  id: string;
  scope: MetricScope;
  isActive: boolean;
  rowVersion: string;
}
export interface AnalyticsAlert {
  id: string;
  ruleId: string;
  scope: MetricScope;
  sessionId: string | null;
  videoLoop: number | null;
  kind: AlertKind;
  severity: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  openedAtUtc: string;
  lastObservedAtUtc: string;
  acknowledgedAtUtc: string | null;
  acknowledgedBy: string | null;
  resolvedAtUtc: string | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
  stateVersion: number;
  evidence: {
    period: ReportPeriod;
    conditionWindow: PeriodPoint;
    value: number;
    threshold: number;
    unit: string;
    observedSeconds: number;
    quality: MetricQuality;
    activeVisitCount: number | null;
  };
}
export interface AlertChanged {
  alertId: string;
  siteId: string;
  cameraId: string;
  stateVersion: number;
  status: string;
}
