import { LocalizedFormat } from '../core/localized-format';
import { TranslatePipe } from '../core/i18n';
import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { DataQuality } from '../core/models';
import { Status } from './status';
@Component({
  selector: 'app-quality',
  imports: [TranslatePipe, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (value(); as quality) {
      <details class="quality">
        <summary>
          <app-status [value]="quality.kind" /><span
            >{{ num(quality.coveragePercent, 1) }}{{ '% coverage' | t }}</span
          >
        </summary>
        <div class="quality-details">
          <span
            >{{ num(quality.sampleCount) }} {{ 'samples ·' | t }}
            {{ num(quality.observationDurationSeconds, 1) }}{{ 's observed' | t }}</span
          >
          <span
            >{{ quality.counterResetCount }} {{ 'counter resets ·' | t }}
            {{ quality.baselineCount }} {{ 'baselines ·' | t }} {{ quality.gapCount }}
            {{ 'gaps' | t }}</span
          >
          @if (quality.coveragePercent < 100) {
            <p>
              {{
                'Partially observed period. Missing observations are unknown, not zero; comparisons may be incomplete.'
                  | t
              }}
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
  readonly num = inject(LocalizedFormat).number;
}
