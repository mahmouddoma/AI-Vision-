export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface CatalogEntity {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: string;
}
export interface Site extends CatalogEntity {
  code: string;
  timeZoneId: string;
}
export interface Camera extends CatalogEntity {
  siteId: string;
  siteName: string;
  externalCameraId: string;
  zonesCount: number;
  mqttTopic: string;
  lastReceivedAtUtc: string | null;
}
export interface Zone extends CatalogEntity {
  cameraId: string;
  externalZoneId: string;
  capacity: number | null;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
}
export interface SiteWrite {
  name: string;
  code: string;
  description: string | null;
  timeZoneId: string;
  rowVersion?: string;
}
export interface CameraWrite {
  name: string;
  siteId: string;
  externalCameraId: string;
  description: string | null;
  rowVersion?: string;
}
export interface ZoneWrite {
  name: string;
  externalZoneId: string;
  description: string | null;
  capacity: number | null;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  rowVersion?: string;
}
export interface MonitoringStatus {
  registeredCameras: number;
  activeCameras: number;
  fresh: number;
  stale: number;
  noRecentData: number;
  neverReceived: number;
  ended: number;
  mqttEnabled: boolean;
  mqttSubscribed: boolean;
  checkedAtUtc: string;
}
export interface LiveZone {
  zoneId: string;
  cameraId: string;
  externalZoneId: string;
  zoneName: string;
  isActive: boolean;
  sessionId: string | null;
  sequence: number | null;
  stateVersion: number | null;
  previousSession: boolean;
  dataFreshness: string;
  occupancy: number | null;
  zoneArrivals: number | null;
  zoneDepartures: number | null;
  entry: number | null;
  exit: number | null;
  wrongWayIn: number | null;
  wrongWayOut: number | null;
  reportedAverageDwellSeconds: number | null;
  longestActiveDwellSeconds: number | null;
  activeVisitorsCount: number | null;
  capacity: number | null;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  utilizationPercent: number | null;
  capacityStatus: string | null;
  lastUpdatedAtUtc: string | null;
}
export interface LiveCamera {
  cameraId: string;
  siteId: string;
  externalCameraId: string;
  cameraName: string;
  isActive: boolean;
  sessionId: string | null;
  lastSequence: number | null;
  sourceType: string | null;
  analyticsStatus: string | null;
  dataFreshness: string;
  processingFps: number | null;
  staffCount: number | null;
  lastReceivedAtUtc: string | null;
  stateVersion: number | null;
  zones: LiveZone[];
}
export interface LiveSite {
  siteId: string;
  siteName: string;
  isActive: boolean;
  cameras: LiveCamera[];
}
export interface DataQuality {
  kind: string;
  sampleCount: number;
  coveragePercent: number;
  observationDurationSeconds: number;
  counterResetCount: number;
  baselineCount: number;
  gapCount: number;
}
export type SourceType = 'live' | 'video_file';
export type Interval = 'minute' | 'hour' | 'day';
export interface ReportFilter {
  siteId?: string;
  cameraId?: string;
  zoneId?: string;
  from?: string;
  to?: string;
  interval?: Interval;
  sourceType?: SourceType;
  sessionId?: string;
  fromSourceTimeMs?: number;
  toSourceTimeMs?: number;
  videoLoop?: number | 'unmarked';
}
export interface ReportPeriod {
  videoLoop?: number | null;
  sessionId?: string;
  sourceType: SourceType;
  timeBasis: string;
  interval: Interval;
  timeZoneId: string;
  from: string | null;
  to: string | null;
  fromSourceTimeMs: number | null;
  toSourceTimeMs: number | null;
}
export interface PeriodPoint {
  startUtc: string | null;
  endUtc: string | null;
  localStart: string | null;
  startSourceTimeMs: number | null;
  endSourceTimeMs: number | null;
}
export interface TrafficTotals {
  arrivals: number;
  departures: number;
  entries: number;
  exits: number;
  wrongWayIn: number;
  wrongWayOut: number;
  wrongWayEvents: number;
}
export interface ZonePeriod {
  period: PeriodPoint;
  averageOccupancy: number | null;
  peakOccupancy: number | null;
  peakAtUtc: string | null;
  peakAtSourceTimeMs: number | null;
  traffic: TrafficTotals;
  dataQuality: DataQuality;
}
export interface OccupancyZone {
  zoneId: string;
  zoneName: string;
  averageOccupancy: number | null;
  peakOccupancy: number | null;
  peakAtUtc: string | null;
  peakAtSourceTimeMs: number | null;
  peakHour: ZonePeriod | null;
  capacity: number | null;
  peakUtilizationPercent: number | null;
  coveragePercent: number;
  observationDurationSeconds: number;
  dataQuality: DataQuality;
  series: ZonePeriod[];
}
export interface ZoneResult extends Omit<
  OccupancyZone,
  'peakHour' | 'coveragePercent' | 'observationDurationSeconds'
> {
  cameraId: string;
  averageUtilizationPercent: number | null;
  reportedAverageDwellSeconds: number | null;
  longestActiveDwellSeconds: number | null;
  estimatedCompletedVisits: number;
  estimatedTotalDwellSeconds: number | null;
  estimatedHistoricalAverageDwellSeconds: number | null;
  uncertainVisits: number;
  traffic: TrafficTotals;
}
export interface ReportResult {
  period: ReportPeriod;
  zones: ZoneResult[];
}
export interface RankingRow {
  rank: number;
  zoneId: string;
  zoneName: string;
  value: number;
  dataQuality: DataQuality;
}
export interface RankingReport {
  period: ReportPeriod;
  metric: string;
  unit: string;
  items: RankingRow[];
}
export interface OverviewReport {
  period: ReportPeriod;
  mostVisitedZone: RankingRow | null;
  topEntryZone: RankingRow | null;
  mostDepartedZone: RankingRow | null;
  topExitZone: RankingRow | null;
  mostCrowdedZone: RankingRow | null;
  peakOccupancy: RankingRow | null;
  longestActiveStay: RankingRow | null;
  estimatedHistoricalDwell: RankingRow | null;
  highestWrongWayZone: RankingRow | null;
  observedZoneAverageOccupancy: number | null;
  traffic: TrafficTotals;
  dataQuality: DataQuality;
}
export interface OccupancyReport {
  period: ReportPeriod;
  zones: OccupancyZone[];
}
export interface UtilizationReport {
  period: ReportPeriod;
  zones: {
    zoneId: string;
    zoneName: string;
    capacity: number | null;
    averageUtilizationPercent: number | null;
    peakUtilizationPercent: number | null;
    dataQuality: DataQuality;
  }[];
}
export interface PeakHoursReport {
  period: ReportPeriod;
  zones: {
    zoneId: string;
    zoneName: string;
    occupancy: ZonePeriod | null;
    arrivals: ZonePeriod | null;
    entries: ZonePeriod | null;
    departures: ZonePeriod | null;
    wrongWayEvents: ZonePeriod | null;
  }[];
}
export interface TrafficZone {
  zoneId: string;
  zoneName: string;
  traffic: TrafficTotals;
  dataQuality: DataQuality;
  series: ZonePeriod[];
}
export interface TrafficReport {
  period: ReportPeriod;
  totals: TrafficTotals;
  zones: TrafficZone[];
}
export interface DwellReport {
  period: ReportPeriod;
  zones: Pick<
    ZoneResult,
    | 'zoneId'
    | 'zoneName'
    | 'reportedAverageDwellSeconds'
    | 'longestActiveDwellSeconds'
    | 'estimatedCompletedVisits'
    | 'estimatedTotalDwellSeconds'
    | 'estimatedHistoricalAverageDwellSeconds'
    | 'uncertainVisits'
    | 'dataQuality'
  >[];
}
export interface WrongWayReport {
  period: ReportPeriod;
  wrongWayIn: number;
  wrongWayOut: number;
  wrongWayEvents: number;
  highestWrongWayZone: RankingRow | null;
  zones: TrafficZone[];
}
export interface StaffPoint {
  period: PeriodPoint;
  averageStaffCount: number | null;
  peakStaffCount: number | null;
  dataQuality: DataQuality;
}
export interface StaffCamera {
  cameraId: string;
  cameraName: string;
  latestStaffCount: number | null;
  lastReceivedAtUtc: string | null;
  averageStaffCount: number | null;
  peakStaffCount: number | null;
  dataQuality: DataQuality;
  series: StaffPoint[];
}
export interface StaffReport {
  period: ReportPeriod;
  cameras: StaffCamera[];
}
export interface Session {
  lastVideoLoop?: number | null;
  id: string;
  cameraId: string;
  cameraName: string;
  externalSessionId: string;
  sourceType: SourceType;
  sourceName: string;
  status: string;
  firstSequence: number;
  lastSequence: number;
  firstSourceTimeMs: number | null;
  lastSourceTimeMs: number | null;
  firstSourceTimestampUtc: string;
  lastSourceTimestampUtc: string;
  startedAtUtc: string;
  lastReceivedAtUtc: string;
  endedAtUtc: string | null;
  createdAtUtc: string;
}
export interface SessionReport {
  availableVideoLoops?: (number | null)[];
  session: Session;
  analytics: ReportResult;
  staff: StaffReport;
  untimedVideoObservations: number;
}
export interface ApiProblem {
  status?: number;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}
export type Query = Record<string, string | number | boolean | null | undefined>;
