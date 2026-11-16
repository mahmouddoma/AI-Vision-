import { validateFilter } from '../features/analytics/report-filters';
import { duration, number, sourceTime, timestamp } from './format';
import { zonePoints } from './report-presenter';
import { DataQuality, ReportPeriod, ZonePeriod } from './models';
export const quality: DataQuality = {
  kind: 'Derived',
  sampleCount: 5,
  coveragePercent: 40,
  observationDurationSeconds: 60,
  counterResetCount: 1,
  baselineCount: 1,
  gapCount: 2,
};
export const period: ReportPeriod = {
  sourceType: 'video_file',
  timeBasis: 'sourceTime',
  interval: 'minute',
  timeZoneId: 'UTC',
  from: null,
  to: null,
  fromSourceTimeMs: 0,
  toSourceTimeMs: 60000,
};
describe('report semantics', () => {
  it('keeps zero distinct from unknown and formats source offsets', () => {
    expect(number(null)).toBe('N/A');
    expect(number(0)).toBe('0');
    expect(sourceTime(61000)).toBe('1:01');
    expect(duration(3661)).toBe('1:01:01');
    expect(timestamp(null)).toBe('Never received');
  });
  it('validates required video session, positions and live interval range', () => {
    expect(validateFilter({ sourceType: 'video_file' })).toContain('session');
    expect(
      validateFilter({
        sourceType: 'video_file',
        sessionId: 'id',
        fromSourceTimeMs: 50,
        toSourceTimeMs: 20,
      }),
    ).toContain('after');
    expect(
      validateFilter({
        sourceType: 'live',
        interval: 'minute',
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-10T00:00:00Z',
      }),
    ).toContain('7 days');
    expect(
      validateFilter({
        sourceType: 'video_file',
        sessionId: 'id',
        fromSourceTimeMs: 0,
        toSourceTimeMs: 100,
      }),
    ).toBeNull();
  });
  it('plots insufficient buckets as gaps and keeps source-relative labels', () => {
    const point = {
      period: { startSourceTimeMs: 60000 },
      averageOccupancy: 8,
      peakOccupancy: 10,
      dataQuality: { ...quality, kind: 'InsufficientData' },
    } as ZonePeriod;
    const result = zonePoints([point], period)[0];
    expect(result.value).toBeNull();
    expect(result.label).toBe('1:00');
  });
});
