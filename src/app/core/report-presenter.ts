import { ReportPeriod, StaffPoint, ZonePeriod } from './models';
import { sourceTime, timestamp } from './format';
import { ChartPoint } from '../ui/chart';

export function zonePoints(
  series: ZonePeriod[],
  period: ReportPeriod,
  metric = 'occupancy',
): ChartPoint[] {
  return series.map((point) => ({
    label:
      period.timeBasis === 'sourceTime'
        ? sourceTime(point.period.startSourceTimeMs)
        : timestamp(point.period.startUtc, period.timeZoneId),
    value:
      point.dataQuality.kind === 'InsufficientData'
        ? null
        : metric === 'occupancy'
          ? point.averageOccupancy
          : metric === 'traffic'
            ? point.traffic.arrivals
            : metric === 'departures'
              ? point.traffic.departures
              : point.traffic.wrongWayIn,
    secondary:
      point.dataQuality.kind === 'InsufficientData'
        ? null
        : metric === 'occupancy'
          ? point.peakOccupancy
          : metric === 'traffic'
            ? point.traffic.entries
            : metric === 'departures'
              ? point.traffic.exits
              : point.traffic.wrongWayOut,
    quality: point.dataQuality,
  }));
}
export function staffPoints(series: StaffPoint[], period: ReportPeriod): ChartPoint[] {
  return series.map((point) => ({
    label:
      period.timeBasis === 'sourceTime'
        ? sourceTime(point.period.startSourceTimeMs)
        : timestamp(point.period.startUtc, period.timeZoneId),
    value: point.dataQuality.kind === 'InsufficientData' ? null : point.averageStaffCount,
    secondary: point.dataQuality.kind === 'InsufficientData' ? null : point.peakStaffCount,
    quality: point.dataQuality,
  }));
}
