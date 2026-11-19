import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Visualization, Vertex, VisualizationPoint } from '../core/smart-models';
import { PeriodPoint, ReportPeriod } from '../core/models';
import { LocalizedFormat } from '../core/localized-format';
import { TranslatePipe } from '../core/i18n';
import { Chart, ChartPoint } from './chart';
import { MetricQualityView } from './metric-quality';
import { Table } from './table';
import { Icon } from './icon';

@Component({
  selector: 'app-visualization',
  imports: [Chart, MetricQualityView, Table, RouterLink, TranslatePipe, Icon],
  styleUrl: './visualization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (value(); as v) {
    <section class="vis-wrapper stack">
      <header class="vis-header">
        <div class="vis-header-main">
          <div class="vis-icon-badge">
            <app-icon name="chart" />
          </div>
          <div class="vis-header-titles">
            <h3 class="vis-title">{{ v.title | t }}</h3>
            <div class="vis-meta-pills">
              <span class="vis-pill">
                <app-icon name="trendUp" />
                <span>{{ v.unit }}</span>
              </span>
              <span class="vis-pill">
                <app-icon name="clock" />
                <span>{{ v.period.timeBasis }}</span>
              </span>
              <span class="vis-pill">
                <app-icon name="location" />
                <span>{{ v.period.timeZoneId }}</span>
              </span>
              <span class="vis-pill vis-pill-date">
                <app-icon name="calendar" />
                @if (v.period.timeBasis === 'sourceTime') {
                  <span>{{ format.sourceTime(v.period.fromSourceTimeMs) }} &rarr; {{ format.sourceTime(v.period.toSourceTimeMs) }}</span>
                  @if (v.period.videoLoop !== undefined) {
                    <span class="loop-tag">· {{ 'Video loop' | t }}: {{ v.period.videoLoop ?? 'unmarked' }}</span>
                  }
                } @else {
                  <span>{{ format.timestamp(v.period.from, v.period.timeZoneId) }} &rarr; {{ format.timestamp(v.period.to, v.period.timeZoneId) }}</span>
                }
              </span>
            </div>
          </div>
        </div>
        <div class="vis-header-quality">
          <app-metric-quality [value]="v.quality" />
        </div>
      </header>

      @switch (v.visualizationType) {
        @case ('line') {
          @if (v.series.length > 1) {
            <div class="vis-zone-selector" role="tablist" [attr.aria-label]="'analytics.selectZone' | t">
              <span class="vis-selector-label"><app-icon name="zones" />{{ 'Zone' | t }}:</span>
              @for (s of v.series; track s.seriesId; let idx = $index) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeSeriesIndex() === idx"
                  class="vis-zone-tab"
                  [class.active]="activeSeriesIndex() === idx"
                  (click)="activeSeriesIndex.set(idx)"
                >
                  {{ s.label }}
                </button>
              }
            </div>
          }
          @if (v.series[activeSeriesIndex()] || v.series[0]; as s) {
            <app-chart
              [title]="s.label"
              [description]="v.unit"
              [primaryLabel]="v.unit"
              [points]="points(s.points, v.period)"
            />
          }
        }
        @case ('area') {
          @if (v.series.length > 1) {
            <div class="vis-zone-selector" role="tablist" [attr.aria-label]="'analytics.selectZone' | t">
              <span class="vis-selector-label"><app-icon name="zones" />{{ 'Zone' | t }}:</span>
              @for (s of v.series; track s.seriesId; let idx = $index) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeSeriesIndex() === idx"
                  class="vis-zone-tab"
                  [class.active]="activeSeriesIndex() === idx"
                  (click)="activeSeriesIndex.set(idx)"
                >
                  {{ s.label }}
                </button>
              }
            </div>
          }
          @if (v.series[activeSeriesIndex()] || v.series[0]; as s) {
            <app-chart
              kind="area"
              [title]="s.label"
              [description]="v.unit"
              [primaryLabel]="v.unit"
              [points]="points(s.points, v.period)"
            />
          }
        }
        @case ('groupedBar') {
          @if (grouped().length > 1) {
            <div class="vis-zone-selector" role="tablist" [attr.aria-label]="'analytics.selectZone' | t">
              <span class="vis-selector-label"><app-icon name="zones" />{{ 'Zone' | t }}:</span>
              @for (s of grouped(); track s.id; let idx = $index) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeSeriesIndex() === idx"
                  class="vis-zone-tab"
                  [class.active]="activeSeriesIndex() === idx"
                  (click)="activeSeriesIndex.set(idx)"
                >
                  {{ s.title }}
                </button>
              }
            </div>
          }
          @if (grouped()[activeSeriesIndex()] || grouped()[0]; as s) {
            <app-chart
              kind="groupedBar"
              [title]="s.title"
              [description]="v.unit"
              [primaryLabel]="s.primary"
              [secondaryLabel]="s.secondary"
              [points]="s.points"
            />
          }
        }
        @case ('divergingBar') {
          @if (v.series.length > 1) {
            <div class="vis-zone-selector" role="tablist" [attr.aria-label]="'analytics.selectZone' | t">
              <span class="vis-selector-label"><app-icon name="zones" />{{ 'Zone' | t }}:</span>
              @for (s of v.series; track s.seriesId; let idx = $index) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeSeriesIndex() === idx"
                  class="vis-zone-tab"
                  [class.active]="activeSeriesIndex() === idx"
                  (click)="activeSeriesIndex.set(idx)"
                >
                  {{ s.label }}
                </button>
              }
            </div>
          }
          @if (v.series[activeSeriesIndex()] || v.series[0]; as s) {
            <app-chart
              kind="divergingBar"
              [title]="s.label"
              [description]="v.unit"
              [primaryLabel]="v.unit"
              [points]="points(s.points, v.period)"
            />
          }
        }
        @case ('histogram') {
          @if (v.series.length > 1) {
            <div class="vis-zone-selector" role="tablist" [attr.aria-label]="'analytics.selectZone' | t">
              <span class="vis-selector-label"><app-icon name="zones" />{{ 'Zone' | t }}:</span>
              @for (s of v.series; track s.seriesId; let idx = $index) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeSeriesIndex() === idx"
                  class="vis-zone-tab"
                  [class.active]="activeSeriesIndex() === idx"
                  (click)="activeSeriesIndex.set(idx)"
                >
                  {{ s.label }}
                </button>
              }
            </div>
          }
          @if (v.series[activeSeriesIndex()] || v.series[0]; as s) {
            <app-chart
              kind="histogram"
              [title]="s.label"
              [description]="v.unit"
              [primaryLabel]="v.unit"
              [points]="bins(s.bins)"
            />
          }
        }
        @case ('gauge') {
          <div class="vis-gauge-grid">
            @for (g of v.values; track $index) {
              <article class="vis-gauge-card">
                <header class="vis-gauge-header">
                  <div class="vis-gauge-title-wrap">
                    <span class="vis-gauge-icon"><app-icon name="zones" /></span>
                    <h4 class="vis-gauge-title">{{ g.label }}</h4>
                  </div>
                  <app-metric-quality [value]="g.quality" />
                </header>

                <div class="vis-gauge-body">
                  <div class="vis-gauge-dial">
                    <svg
                      viewBox="0 0 120 72"
                      class="gauge-arc-svg"
                      role="img"
                      [attr.aria-label]="
                        g.label + ': ' + (g.value != null ? num(g.value, 1) + ' ' + v.unit : ('N/A' | t))
                      "
                    >
                      <path
                        d="M 16 64 A 44 44 0 0 1 104 64"
                        fill="none"
                        class="gauge-arc-bg"
                        stroke-width="10"
                        stroke-linecap="round"
                      />
                      @if (g.value != null) {
                        <path
                          d="M 16 64 A 44 44 0 0 1 104 64"
                          fill="none"
                          [attr.stroke]="gaugeColor(g.value, g.thresholds)"
                          stroke-width="10"
                          stroke-linecap="round"
                          stroke-dasharray="138.23"
                          [attr.stroke-dashoffset]="gaugeDashoffset(g.value, g.minimum, g.maximum)"
                          class="gauge-arc-val"
                        />
                      }
                      <text x="60" y="55" text-anchor="middle" class="gauge-dial-value">
                        {{ g.value != null ? num(g.value, 1) + ' ' + v.unit : ('N/A' | t) }}
                      </text>
                    </svg>
                  </div>

                  <div class="vis-gauge-range">
                    <span>{{ g.minimum }} {{ v.unit }}</span>
                    <span>{{ g.maximum }} {{ v.unit }}</span>
                  </div>

                  @if (g.thresholds.length) {
                    <div class="vis-gauge-thresholds">
                      @for (t of g.thresholds; track t.label) {
                        <span
                          class="vis-gauge-thresh-pill"
                          [class.is-warning]="t.label.toLowerCase() === 'warning'"
                          [class.is-critical]="t.label.toLowerCase() === 'critical'"
                        >
                          <span class="thresh-dot"></span>
                          <span>{{ t.label }}: {{ num(t.value, 0) }} {{ v.unit }}</span>
                        </span>
                      }
                    </div>
                  }
                </div>
              </article>
            } @empty {
              <div class="vis-empty-notice">
                <p>{{ 'analytics.noEligible' | t }}</p>
              </div>
            }
          </div>
        }
        @case ('timeline') {
          <app-table [label]="v.title"
            ><table>
              <thead>
                <tr>
                  <th>{{ 'Scope' | t }}</th>
                  <th>{{ 'Period' | t }}</th>
                  <th>{{ 'Status' | t }}</th>
                  <th>{{ 'Observed seconds' | t }}</th>
                  <th>{{ 'Quality' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of v.items; track $index) {
                  <tr>
                    <th>{{ item.label }}</th>
                    <td>{{ label(item.period, v.period) }}</td>
                    <td>{{ item.severity }} · {{ item.status }} {{ item.resolutionReason }}</td>
                    <td>{{ item.observedSeconds }}</td>
                    <td><app-metric-quality [value]="item.quality" /></td>
                  </tr>
                }
              </tbody></table
          ></app-table>
        }
        @case ('heatmap') {
          <svg class="floor-canvas" viewBox="0 0 1000 700" role="img" [attr.aria-label]="v.title">
            @for (z of v.zones; track z.layout.zoneId) {
              <a
                [routerLink]="['/zones', z.layout.zoneId]"
                [attr.aria-label]="z.layout.zoneName + ': ' + num(z.value) + ' ' + v.unit"
              >
                <polygon
                  [attr.points]="polygon(z.layout.vertices)"
                  [attr.fill]="z.value === null ? 'var(--canvas)' : 'var(--accent)'"
                  [attr.fill-opacity]="z.value === null ? 1 : intensity(z.value, v.zones)"
                />
                <title>{{ z.layout.zoneName }}: {{ num(z.value) }} {{ v.unit }}</title>
              </a>
            }
          </svg>
          <app-table [label]="v.title"
            ><table>
              <thead>
                <tr>
                  <th>{{ 'Zone' | t }}</th>
                  <th>{{ v.unit }}</th>
                  <th>{{ 'Quality' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (z of v.zones; track z.layout.zoneId) {
                  <tr>
                    <th>
                      <a [routerLink]="['/zones', z.layout.zoneId]">{{ z.layout.zoneName }}</a>
                    </th>
                    <td>{{ num(z.value, 1) }}</td>
                    <td><app-metric-quality [value]="z.quality" /></td>
                  </tr>
                }
              </tbody></table
          ></app-table>
        }
      }
    </section>
  }`,
})
export class VisualizationView {
  readonly value = input.required<Visualization>();
  readonly activeSeriesIndex = signal(0);
  readonly format = inject(LocalizedFormat);
  readonly num = this.format.number;
  readonly grouped = computed(() => {
    const v = this.value();
    if (v.visualizationType !== 'groupedBar') return [];
    const pending = [...v.series];
    const groups: {
      id: string;
      title: string;
      primary: string;
      secondary: string;
      points: ChartPoint[];
    }[] = [];
    const key = (p: VisualizationPoint) =>
      `${p.period.startUtc ?? ''}:${p.period.startSourceTimeMs ?? ''}`;
    while (pending.length) {
      const first = pending.shift()!;
      const index = pending.findIndex(
        (s) =>
          s.scope.siteId === first.scope.siteId &&
          s.scope.cameraId === first.scope.cameraId &&
          s.scope.zoneId === first.scope.zoneId,
      );
      const second = index >= 0 ? pending.splice(index, 1)[0] : undefined;
      const next = new Map(second?.points.map((p) => [key(p), p]));
      const primary = new Map(first.points.map((p) => [key(p), p]));
      const periods = [
        ...first.points,
        ...(second?.points.filter((p) => !primary.has(key(p))) ?? []),
      ];
      groups.push({
        id: first.seriesId,
        title: first.label,
        primary: first.label,
        secondary: second?.label ?? '',
        points: periods.map((p) => ({
          label: this.label(p.period, v.period),
          value: primary.get(key(p))?.value ?? null,
          secondary: next.get(key(p))?.value ?? null,
          metricQuality: primary.get(key(p))?.quality,
          secondaryMetricQuality: next.get(key(p))?.quality,
        })),
      });
    }
    return groups;
  });
  label(point: PeriodPoint, period: ReportPeriod): string {
    return period.timeBasis === 'sourceTime'
      ? this.format.sourceTime(point.startSourceTimeMs)
      : this.format.timestamp(point.startUtc, period.timeZoneId);
  }
  points(points: VisualizationPoint[], period: ReportPeriod): ChartPoint[] {
    return points.map((p) => ({
      label: this.label(p.period, period),
      value: p.value,
      metricQuality: p.quality,
    }));
  }
  bins(
    bins: { label: string; value: number | null; quality: VisualizationPoint['quality'] }[],
  ): ChartPoint[] {
    return bins.map((b) => ({ label: b.label, value: b.value, metricQuality: b.quality }));
  }
  polygon(vertices: Vertex[]): string {
    return vertices.map((v) => `${v.x * 1000},${v.y * 700}`).join(' ');
  }
  intensity(value: number, zones: { value: number | null }[]): number {
    return 0.15 + (0.85 * Math.max(0, value)) / Math.max(1, ...zones.map((z) => z.value ?? 0));
  }
  gaugeDashoffset(value: number | null, min: number, max: number): number {
    if (value == null || max <= min) return 138.23;
    const clamped = Math.max(min, Math.min(max, value));
    const fraction = (clamped - min) / (max - min);
    return +(138.23 * (1 - fraction)).toFixed(2);
  }
  gaugeColor(value: number | null, thresholds?: { label: string; value: number }[]): string {
    if (value == null) return '#94a3b8';
    if (thresholds && thresholds.length) {
      const crit = thresholds.find((t) => t.label.toLowerCase() === 'critical');
      if (crit && value >= crit.value) return '#ef4444';
      const warn = thresholds.find((t) => t.label.toLowerCase() === 'warning');
      if (warn && value >= warn.value) return '#f59e0b';
    }
    return '#087f7b';
  }
}
