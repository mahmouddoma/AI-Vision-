import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MetricQuality } from '../core/smart-models';
import { TranslatePipe } from '../core/i18n';
import { LocalizedFormat } from '../core/localized-format';

@Component({
  selector: 'app-metric-quality',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (value(); as q) {
    <details class="quality">
      <summary>
        {{ q.provenance | t }} · {{ num(q.coveragePercent, 1) }}%
        @if (q.isStale) {
          · {{ 'Stale' | t }}
        }
        @if (q.isPartial) {
          · {{ 'Partial data' | t }}
        }
      </summary>
      <dl class="quality-details">
        <div>
          <dt>{{ 'Samples' | t }}</dt>
          <dd>{{ num(q.sampleCount) }}</dd>
        </div>
        <div>
          <dt>{{ 'Observed seconds' | t }}</dt>
          <dd>{{ num(q.coveredSeconds, 1) }}</dd>
        </div>
        <div>
          <dt>{{ 'Gaps / resets / baselines' | t }}</dt>
          <dd>{{ q.gapCount }} / {{ q.resetCount }} / {{ q.baselineCount }}</dd>
        </div>
      </dl>
      @for (warning of q.warningCodes; track warning) {
        <p>{{ warning }}</p>
      }
    </details>
  }`,
})
export class MetricQualityView {
  readonly value = input<MetricQuality | null>(null);
  readonly num = inject(LocalizedFormat).number;
}
