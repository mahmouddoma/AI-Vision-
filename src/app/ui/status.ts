import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, IconName } from './icon';
const states: Record<string, [string, string, IconName]> = {
  Healthy: ['Healthy', 'success', 'success'],
  Ready: ['Ready', 'success', 'success'],
  Degraded: ['Degraded', 'warning', 'warning'],
  Unhealthy: ['Unhealthy', 'danger', 'warning'],
  Fresh: ['Fresh', 'success', 'success'],
  Stale: ['Stale', 'warning', 'clock'],
  NoRecentData: ['No recent data', 'warning', 'clock'],
  NeverReceived: ['Never received', 'neutral', 'dot'],
  Ended: ['Ended', 'neutral', 'clock'],
  ended: ['Ended', 'neutral', 'clock'],
  running: ['Running', 'success', 'pulse'],
  Warning: ['Warning', 'warning', 'warning'],
  Critical: ['Critical', 'danger', 'warning'],
  WithinCapacity: ['Within capacity', 'success', 'check'],
  Estimated: ['Estimated', 'accent', 'info'],
  Derived: ['Derived', 'accent', 'chart'],
  Reported: ['Reported', 'neutral', 'check'],
  InsufficientData: ['Insufficient data', 'warning', 'info'],
  Active: ['Active', 'success', 'check'],
  Inactive: ['Inactive', 'neutral', 'dot'],
};
@Component({
  selector: 'app-status',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status" [attr.data-tone]="state()[1]"
    ><app-icon [name]="state()[2]" />{{ state()[0] }}</span
  >`,
})
export class Status {
  readonly value = input<string | null | undefined>();
  readonly state = computed(
    () =>
      states[this.value() ?? ''] ??
      ([this.value() ?? 'Unknown', 'neutral', 'info'] as [string, string, IconName]),
  );
}
