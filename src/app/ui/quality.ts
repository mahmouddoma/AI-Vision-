import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DataQuality } from '../core/models';
import { number } from '../core/format';
import { Status } from './status';
@Component({
  selector: 'app-quality',
  imports: [Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (value(); as quality) {
      <details class="quality">
        <summary>
          <app-status [value]="quality.kind" /><span
            >{{ num(quality.coveragePercent, 1) }}% coverage</span
          >
        </summary>
        <div class="quality-details">
          <span
            >{{ num(quality.sampleCount) }} samples ·
            {{ num(quality.observationDurationSeconds, 1) }}s observed</span
          >
          <span
            >{{ quality.counterResetCount }} counter resets · {{ quality.baselineCount }} baselines
            · {{ quality.gapCount }} gaps</span
          >
          @if (quality.coveragePercent < 100) {
            <p>
              Partially observed period. Missing observations are unknown, not zero; comparisons may
              be incomplete.
            </p>
          }
        </div>
      </details>
    } @else {
      <app-status value="InsufficientData" />
    }`,
})
export class Quality {
  readonly value = input<DataQuality | null | undefined>();
  readonly num = number;
}
