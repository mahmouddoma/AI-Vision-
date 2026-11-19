import { LiveCamera, LiveZone } from './models';

export type LiveOccupancyStatus = 'complete' | 'partial' | 'unavailable';

export interface LiveOccupancyOptions {
  disconnected?: boolean;
}

export interface LiveOccupancySummary {
  observedOccupancy: number | null;
  status: LiveOccupancyStatus;
  includedZones: number;
  excludedZones: number;
  totalCameras: number;
  monitoredCameras: number;
  freshCameras: number;
  staleCameras: number;
  noRecentDataCameras: number;
  otherExcludedCameras: number;
  hasIncompleteCoverage: boolean;
  isDisconnected: boolean;
}

export interface LiveOccupancyPresentation {
  statusBadge: 'PartialData' | 'Disconnected' | 'Unavailable' | null;
  descriptionKey: string;
  descriptionParams: Record<string, number>;
}

const ENDED_ANALYTICS_STATUSES = new Set(['ended', 'stopped', 'completed', 'closed']);

export function isEndedAnalyticsStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ENDED_ANALYTICS_STATUSES.has(status.trim().toLowerCase());
}

function hasValidSession(sessionId: string | null | undefined): sessionId is string {
  return typeof sessionId === 'string' && sessionId.trim().length > 0;
}

export function isEligibleLiveCamera(camera: LiveCamera): boolean {
  return (
    camera.isActive === true &&
    camera.dataFreshness === 'Fresh' &&
    camera.sourceType === 'live' &&
    !isEndedAnalyticsStatus(camera.analyticsStatus) &&
    hasValidSession(camera.sessionId)
  );
}

export function isEligibleLiveZone(zone: LiveZone, camera: LiveCamera): boolean {
  return (
    zone.isActive === true &&
    zone.dataFreshness === 'Fresh' &&
    zone.previousSession === false &&
    hasValidSession(camera.sessionId) &&
    zone.sessionId === camera.sessionId &&
    zone.occupancy !== null &&
    typeof zone.occupancy === 'number' &&
    Number.isInteger(zone.occupancy) &&
    zone.occupancy >= 0
  );
}

/**
 * Calculates current live site/camera occupancy from eligible fresh observations only.
 *
 * Camera category counts (`freshCameras`, `staleCameras`, `noRecentDataCameras`,
 * `otherExcludedCameras`) are mutually exclusive and partition `totalCameras`.
 * Inactive cameras/zones are excluded from `monitoredCameras` and coverage calculations
 * so intentionally disabled catalog records do not permanently mark live coverage partial.
 */
export function calculateLiveOccupancy(
  cameras: readonly LiveCamera[],
  options: LiveOccupancyOptions = {},
): LiveOccupancySummary {
  const isDisconnected = options.disconnected === true;
  const totalCameras = cameras.length;

  let monitoredCameras = 0;
  let freshCameras = 0;
  let staleCameras = 0;
  let noRecentDataCameras = 0;
  let otherExcludedCameras = 0;
  let includedZones = 0;
  let excludedZones = 0;
  let sum = 0;

  for (const camera of cameras) {
    const activeZones = camera.zones.filter((zone) => zone.isActive === true);

    if (camera.isActive !== true) {
      otherExcludedCameras += 1;
      continue;
    }

    monitoredCameras += 1;

    if (isDisconnected) {
      otherExcludedCameras += 1;
      excludedZones += activeZones.length;
      continue;
    }

    if (isEligibleLiveCamera(camera)) {
      freshCameras += 1;
      for (const zone of activeZones) {
        if (isEligibleLiveZone(zone, camera)) {
          includedZones += 1;
          sum += zone.occupancy!;
        } else {
          excludedZones += 1;
        }
      }
      continue;
    }

    excludedZones += activeZones.length;

    if (camera.sourceType === 'video_file' || isEndedAnalyticsStatus(camera.analyticsStatus)) {
      otherExcludedCameras += 1;
    } else if (camera.dataFreshness === 'Stale') {
      staleCameras += 1;
    } else if (camera.dataFreshness === 'NoRecentData') {
      noRecentDataCameras += 1;
    } else {
      otherExcludedCameras += 1;
    }
  }

  if (isDisconnected || includedZones === 0) {
    return {
      observedOccupancy: null,
      status: 'unavailable',
      includedZones: 0,
      excludedZones,
      totalCameras,
      monitoredCameras,
      freshCameras: isDisconnected ? 0 : freshCameras,
      staleCameras: isDisconnected ? 0 : staleCameras,
      noRecentDataCameras: isDisconnected ? 0 : noRecentDataCameras,
      otherExcludedCameras,
      hasIncompleteCoverage: monitoredCameras > 0 || excludedZones > 0,
      isDisconnected,
    };
  }

  const hasIncompleteCoverage = excludedZones > 0 || freshCameras < monitoredCameras;

  return {
    observedOccupancy: sum,
    status: hasIncompleteCoverage ? 'partial' : 'complete',
    includedZones,
    excludedZones,
    totalCameras,
    monitoredCameras,
    freshCameras,
    staleCameras,
    noRecentDataCameras,
    otherExcludedCameras,
    hasIncompleteCoverage,
    isDisconnected: false,
  };
}

export function describeLiveOccupancy(
  summary: LiveOccupancySummary,
  loading: boolean,
): LiveOccupancyPresentation {
  if (loading) {
    return {
      statusBadge: null,
      descriptionKey: 'live.occupancyLoading',
      descriptionParams: {},
    };
  }
  if (summary.isDisconnected) {
    return {
      statusBadge: 'Disconnected',
      descriptionKey: 'live.occupancyDisconnected',
      descriptionParams: {},
    };
  }
  if (summary.status === 'complete') {
    return {
      statusBadge: null,
      descriptionKey: 'live.occupancyComplete',
      descriptionParams: {
        zones: summary.includedZones,
        fresh: summary.freshCameras,
        total: summary.monitoredCameras,
      },
    };
  }
  if (summary.status === 'partial') {
    return {
      statusBadge: 'PartialData',
      descriptionKey: 'live.occupancyPartial',
      descriptionParams: {
        fresh: summary.freshCameras,
        total: summary.monitoredCameras,
        stale: summary.staleCameras,
        noRecent: summary.noRecentDataCameras,
      },
    };
  }
  return {
    statusBadge: 'Unavailable',
    descriptionKey: 'live.occupancyUnavailable',
    descriptionParams: {},
  };
}
