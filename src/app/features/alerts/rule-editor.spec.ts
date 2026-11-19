import { ruleError } from './rule-editor';
import { AlertRuleWrite } from '../../core/smart-models';
const valid: AlertRuleWrite = {
  siteId: 'site',
  cameraId: 'camera',
  zoneId: 'zone',
  name: 'Capacity',
  kind: 'Congestion',
  severity: 'Warning',
  threshold: 80,
  minimumObservedSeconds: 30,
  recoverySeconds: 15,
  windowSeconds: 60,
  cooldownSeconds: null,
  minimumCoveragePercent: null,
  allowVideo: false,
};
describe('alert rule validation', () => {
  it('allows backend defaults and camera-only rules', () => {
    expect(ruleError(valid)).toBeNull();
    expect(ruleError({ ...valid, kind: 'LowFps', zoneId: null })).toBeNull();
  });
  it('rejects wrong scope, duration mismatch and video freshness rules', () => {
    expect(ruleError({ ...valid, zoneId: null })).toBeTruthy();
    expect(ruleError({ ...valid, minimumObservedSeconds: 61 })).toBeTruthy();
    expect(ruleError({ ...valid, recoverySeconds: 0 })).toBeTruthy();
    expect(ruleError({ ...valid, minimumCoveragePercent: 0 })).toBeTruthy();
    expect(
      ruleError({ ...valid, kind: 'CameraNoRecentData', zoneId: null, allowVideo: true }),
    ).toBeTruthy();
  });
});
