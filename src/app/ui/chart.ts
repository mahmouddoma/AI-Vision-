import { LocalizedFormat } from '../core/localized-format';
import { TranslatePipe } from '../core/i18n';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  inject,
} from '@angular/core';
import { DataQuality } from '../core/models';
import { Quality } from './quality';
import { MetricQuality } from '../core/smart-models';
import { MetricQualityView } from './metric-quality';
import { Table, Pagination } from './table';
import { Icon } from './icon';

export interface ChartPoint {
  label: string;
  value: number | null;
  secondary?: number | null;
  quality?: DataQuality;
  metricQuality?: MetricQuality;
  secondaryMetricQuality?: MetricQuality;
}

@Component({
  selector: 'app-chart',
  imports: [TranslatePipe, Table, Quality, Pagination, MetricQualityView, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure class="chart">
    <figcaption>
      <div class="chart-title-group">
        <div class="chart-title-row">
          <h3>{{ title() }}</h3>
          @if (hasValues() && max() > 0) {
            <span class="chart-stat-chip" [title]="'Maximum observed value' | t">
              <app-icon name="trendUp" />
              <span>{{ 'Max' | t }}: {{ num(max(), 1) }}</span>
            </span>
          }
        </div>
        @if (description()) {
          <p>{{ description() }}</p>
        }
      </div>
      <div class="chart-legend-pills">
        <span class="legend-pill primary">
          <span class="legend-indicator" [style.background]="colors().primary"></span>
          <span class="legend-label">{{ primaryLabel() | t }}</span>
          @if (latestPoint()?.value != null) {
            <strong class="legend-val">{{ num(latestPoint()?.value, 1) }}</strong>
          }
        </span>
        @if (secondaryLabel()) {
          <span class="legend-pill secondary">
            <span class="legend-indicator" [style.background]="colors().secondary"></span>
            <span class="legend-label">{{ secondaryLabel() | t }}</span>
            @if (latestPoint()?.secondary != null) {
              <strong class="legend-val">{{ num(latestPoint()?.secondary, 1) }}</strong>
            }
          </span>
        }
      </div>
    </figcaption>
    @if (hasValues()) {
      <div class="chart-canvas" dir="ltr" (mouseleave)="onLeave()">
        <span class="chart-max">{{ num(max(), 1) }}</span>
        <span class="chart-mid">{{ num((max() + min()) / 2, 1) }}</span>
        <span class="chart-min">{{ num(min(), 1) }}</span>

        <div class="chart-plot">
          <svg
          viewBox="0 0 640 180"
          preserveAspectRatio="none"
          role="img"
          [attr.aria-label]="
            title() + '. ' + description() + ('. Exact values in the data table below.' | t)
          "
          (mousemove)="onHover($event)"
          (touchstart)="onTouch($event)"
          (touchmove)="onTouch($event)"
        >
          <defs>
            <linearGradient [id]="chartId + '-area'" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="colors().primary" stop-opacity="0.28" />
              <stop offset="65%" [attr.stop-color]="colors().primaryLight" stop-opacity="0.08" />
              <stop offset="100%" [attr.stop-color]="colors().primary" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient [id]="chartId + '-area-sec'" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="colors().secondary" stop-opacity="0.20" />
              <stop offset="100%" [attr.stop-color]="colors().secondary" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient [id]="chartId + '-bar'" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="colors().primaryLight" />
              <stop offset="100%" [attr.stop-color]="colors().primary" />
            </linearGradient>
            <linearGradient [id]="chartId + '-bar-sec'" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="colors().secondaryLight" />
              <stop offset="100%" [attr.stop-color]="colors().secondary" />
            </linearGradient>
          </defs>

          <!-- 5 Clean horizontal reference grid lines -->
          <path
            class="chart-grid"
            d="M 0 10 H 640 M 0 50 H 640 M 0 90 H 640 M 0 130 H 640 M 0 170 H 640"
          />

          @if (effectiveKind() === 'line' || effectiveKind() === 'area') {
            <!-- Smooth Area Glow Fill -->
            <path
              [attr.d]="area()"
              [attr.fill]="'url(#' + chartId + '-area)'"
              class="chart-area-fill"
            />
            <!-- Crisp Stroke Line -->
            <path class="chart-line" [attr.stroke]="colors().primary" [attr.d]="path(false)" />
          } @else {
            <path
              [attr.d]="bars(false)"
              [attr.fill]="'url(#' + chartId + '-bar)'"
              class="chart-bar"
            />
          }

          @if (secondaryLabel()) {
            @if (effectiveKind() === 'line' || effectiveKind() === 'area') {
              <path
                class="chart-line secondary-line"
                [attr.stroke]="colors().secondary"
                [attr.d]="path(true)"
              />
            } @else {
              <path
                [attr.d]="bars(true)"
                [attr.fill]="'url(#' + chartId + '-bar-sec)'"
                class="chart-bar secondary-bar"
              />
            }
          }

          <!-- Interactive Crosshair -->
          @if (hoveredIndex() !== null && hoveredPoint()) {
            <line
              [attr.x1]="hoveredX()"
              y1="10"
              [attr.x2]="hoveredX()"
              y2="170"
              class="chart-crosshair"
            />
          }
        </svg>

        <!-- Aspect-safe HTML Markers for Isolated Points & Hover (never stretched) -->
        @if (effectiveKind() === 'line' || effectiveKind() === 'area') {
          @for (dot of isolatedDots(false); track $index) {
            <span
              class="chart-point-marker"
              [style.left.%]="(dot.x / 640) * 100"
              [style.top.%]="(dot.y / 180) * 100"
              [style.background]="colors().primary"
              aria-hidden="true"
            ></span>
          }
          @if (secondaryLabel()) {
            @for (dot of isolatedDots(true); track $index) {
              <span
                class="chart-point-marker"
                [style.left.%]="(dot.x / 640) * 100"
                [style.top.%]="(dot.y / 180) * 100"
                [style.background]="colors().secondary"
                aria-hidden="true"
              ></span>
            }
          }
          @if (hoveredIndex() !== null) {
            @if (hoveredYPrimary() !== null) {
              <span
                class="chart-point-marker is-hover"
                [style.left.%]="(hoveredX() / 640) * 100"
                [style.top.%]="(hoveredYPrimary()! / 180) * 100"
                [style.background]="colors().primary"
                aria-hidden="true"
              ></span>
            }
            @if (secondaryLabel() && hoveredYSecondary() !== null) {
              <span
                class="chart-point-marker is-hover"
                [style.left.%]="(hoveredX() / 640) * 100"
                [style.top.%]="(hoveredYSecondary()! / 180) * 100"
                [style.background]="colors().secondary"
                aria-hidden="true"
              ></span>
            }
          }
        }
        </div>

        <!-- Floating Interactive Tooltip -->
        @if (hoveredPoint(); as hp) {
          <div
            class="chart-tooltip"
            [style.left.%]="(hoveredX() / 640) * 100"
            [class.tooltip-flip]="hoveredX() / 640 > 0.65"
            role="tooltip"
          >
            <div class="tooltip-header">{{ hp.label }}</div>
            <div class="tooltip-body">
              @if (hp.value !== null) {
                <div class="tooltip-row">
                  <span class="tooltip-swatch" [style.background]="colors().primary"></span>
                  <span class="tooltip-name">{{ primaryLabel() | t }}:</span>
                  <strong class="tooltip-val">{{ num(hp.value, 1) }}</strong>
                </div>
              }
              @if (secondaryLabel() && hp.secondary !== null) {
                <div class="tooltip-row">
                  <span class="tooltip-swatch" [style.background]="colors().secondary"></span>
                  <span class="tooltip-name">{{ secondaryLabel() | t }}:</span>
                  <strong class="tooltip-val">{{ num(hp.secondary, 1) }}</strong>
                </div>
              }
              @if (hp.metricQuality?.provenance || hp.quality?.kind; as q) {
                <div class="tooltip-quality">
                  <span class="quality-tag">{{ q | t }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="chart-axis" dir="ltr">
        <span>{{ points()[0]?.label }}</span>
        @if (midLabel(); as mid) {
          <span class="chart-axis-mid">{{ mid }}</span>
        }
        <span>{{ points().at(-1)?.label }}</span>
      </div>
    } @else {
      <p class="chart-empty">
        {{ 'No eligible observations in this period. Missing values are not zero.' | t }}
      </p>
    }

    <details class="chart-data" (toggle)="tableOpen.set($any($event.target).open)">
      <summary>
        <span class="data-table-toggle">
          <app-icon name="overview" />
          <span
            >{{ 'View accessible data table (' | t }}{{ points().length }}
            {{ 'periods)' | t }}</span
          >
        </span>
      </summary>
      @if (tableOpen()) {
        <app-table [label]="'Chart data' | t">
          <table>
            <caption class="visually-hidden">
              {{
                title()
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'Period' | t }}</th>
                <th scope="col">{{ primaryLabel() | t }}</th>
                @if (secondaryLabel()) {
                  <th scope="col">{{ secondaryLabel() | t }}</th>
                }
                <th scope="col">{{ 'Quality' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (point of visiblePoints(); track $index) {
                <tr>
                  <th scope="row">{{ point.label }}</th>
                  <td>{{ num(point.value, 1) }}</td>
                  @if (secondaryLabel()) {
                    <td>{{ num(point.secondary, 1) }}</td>
                  }
                  <td>
                    @if (point.metricQuality) {
                      <app-metric-quality [value]="point.metricQuality" />
                    } @else {
                      <app-quality [value]="point.quality" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </app-table>
        <app-pagination
          [total]="points().length"
          [page]="tablePage()"
          [pages]="tablePages()"
          (changed)="tablePage.set($event)"
        />
      }
    </details>
  </figure>`,
})
export class Chart {
  private static idCounter = 0;
  readonly chartId = 'ch-' + ++Chart.idCounter;

  readonly kind = input<'line' | 'area' | 'groupedBar' | 'divergingBar' | 'histogram'>('line');
  readonly palette = input<'teal' | 'indigo' | 'coral' | 'sky' | 'rose'>('teal');
  readonly effectiveKind = computed(() => {
    const k = this.kind();
    if (k === 'line' || k === 'area') {
      const validPrimary = this.points().filter((p) => this.isValidPoint(p, false) != null).length;
      const validSecondary = this.secondaryLabel()
        ? this.points().filter((p) => this.isValidPoint(p, true) != null).length
        : 0;
      if (validPrimary < 2 && validSecondary < 2) {
        return 'groupedBar' as const;
      }
    }
    return k;
  });
  readonly colors = computed(() => {
    switch (this.palette()) {
      case 'indigo':
        return {
          primary: '#7c3aed',
          primaryLight: '#a78bfa',
          secondary: '#ec4899',
          secondaryLight: '#f472b6',
        };
      case 'coral':
        return {
          primary: '#10b981',
          primaryLight: '#34d399',
          secondary: '#f59e0b',
          secondaryLight: '#fbbf24',
        };
      case 'sky':
        return {
          primary: '#0ea5e9',
          primaryLight: '#38bdf8',
          secondary: '#6366f1',
          secondaryLight: '#818cf8',
        };
      case 'rose':
        return {
          primary: '#ef4444',
          primaryLight: '#f87171',
          secondary: '#f59e0b',
          secondaryLight: '#fbbf24',
        };
      default:
        return {
          primary: '#087f7b',
          primaryLight: '#14b8a6',
          secondary: '#0ea5e9',
          secondaryLight: '#38bdf8',
        };
    }
  });
  readonly title = input.required<string>();
  readonly description = input('');
  readonly points = input<ChartPoint[]>([]);
  readonly tableOpen = signal(false);
  readonly tablePage = signal(1);
  readonly tablePages = computed(() => Math.ceil(this.points().length / 100));
  readonly visiblePoints = computed(() =>
    this.points().slice((this.tablePage() - 1) * 100, this.tablePage() * 100),
  );
  readonly primaryLabel = input('Average');
  readonly secondaryLabel = input('');
  readonly num = inject(LocalizedFormat).number;
  readonly hasValues = computed(() =>
    this.points().some((p) => p.value != null || p.secondary != null),
  );
  readonly max = computed(() =>
    Math.max(1, ...this.points().flatMap((p) => [p.value ?? 0, p.secondary ?? 0])),
  );
  readonly min = computed(() =>
    Math.min(0, ...this.points().flatMap((p) => [p.value ?? 0, p.secondary ?? 0])),
  );

  readonly midLabel = computed(() => {
    const pts = this.points();
    if (pts.length < 4) return '';
    return pts[Math.floor(pts.length / 2)]?.label || '';
  });

  readonly latestPoint = computed(() => {
    const pts = this.points();
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].value != null || pts[i].secondary != null) return pts[i];
    }
    return null;
  });

  readonly hoveredIndex = signal<number | null>(null);
  readonly hoveredPoint = computed(() => {
    const idx = this.hoveredIndex();
    return idx != null ? (this.points()[idx] ?? null) : null;
  });
  readonly hoveredX = computed(() => {
    const idx = this.hoveredIndex();
    if (idx == null) return 0;
    return this.x(idx);
  });
  readonly hoveredYPrimary = computed(() => {
    const p = this.hoveredPoint();
    return p?.value != null ? this.y(p.value) : null;
  });
  readonly hoveredYSecondary = computed(() => {
    const p = this.hoveredPoint();
    return p?.secondary != null ? this.y(p.secondary) : null;
  });

  onHover(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || this.points().length === 0) return;
    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const idx = Math.min(
      this.points().length - 1,
      Math.max(0, Math.round(xRatio * (this.points().length - 1))),
    );
    this.hoveredIndex.set(idx);
  }

  onTouch(event: TouchEvent): void {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || this.points().length === 0) return;
    const xRatio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const idx = Math.min(
      this.points().length - 1,
      Math.max(0, Math.round(xRatio * (this.points().length - 1))),
    );
    this.hoveredIndex.set(idx);
  }

  onLeave(): void {
    this.hoveredIndex.set(null);
  }

  private x(index: number): number {
    const count = this.points().length;
    if (count <= 1) return 320;
    return (index / (count - 1)) * 640;
  }

  private y(value: number): number {
    return 170 - ((value - this.min()) / (this.max() - this.min())) * 160;
  }

  private isValidPoint(point: ChartPoint, secondary: boolean): number | null {
    const value = secondary ? point.secondary : point.value;
    if (
      value == null ||
      point.quality?.kind === 'InsufficientData' ||
      point.metricQuality?.provenance === 'InsufficientData'
    ) {
      return null;
    }
    return value;
  }

  isolatedDots(secondary: boolean): { x: number; y: number }[] {
    const pts = this.points();
    const dots: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const value = this.isValidPoint(pts[i], secondary);
      if (value == null) continue;
      const prevValid = i > 0 && this.isValidPoint(pts[i - 1], secondary) != null;
      const nextValid = i < pts.length - 1 && this.isValidPoint(pts[i + 1], secondary) != null;
      if (!prevValid && !nextValid) {
        dots.push({ x: this.x(i), y: this.y(value) });
      }
    }
    return dots;
  }

  bars(secondary = false): string {
    const count = Math.max(1, this.points().length);
    const slotWidth = 640 / count;
    const paired = Boolean(this.secondaryLabel());
    const gap = paired ? Math.min(8, slotWidth * 0.08) : 0;
    const rawBarWidth = (slotWidth * 0.66 - gap) / (paired ? 2 : 1);
    const barWidth = Math.max(4, Math.min(54, rawBarWidth));
    const groupWidth = paired ? barWidth * 2 + gap : barWidth;
    const baseY = this.y(0);

    return this.points()
      .map((p, i) => {
        const value = secondary ? p.secondary : p.value;
        const quality = secondary ? p.secondaryMetricQuality : p.metricQuality;
        if (value == null || quality?.provenance === 'InsufficientData') return '';
        const topY = this.y(value);
        const x = i * slotWidth + (slotWidth - groupWidth) / 2 + (secondary ? barWidth + gap : 0);
        const height = Math.abs(baseY - topY);
        if (height < 0.5) return '';
        const r = Math.min(5, barWidth / 2, height / 2);
        if (topY <= baseY) {
          return `M${x.toFixed(2)},${baseY.toFixed(2)}V${(topY + r).toFixed(2)}Q${x.toFixed(2)},${topY.toFixed(2)} ${(x + r).toFixed(2)},${topY.toFixed(2)}H${(x + barWidth - r).toFixed(2)}Q${(x + barWidth).toFixed(2)},${topY.toFixed(2)} ${(x + barWidth).toFixed(2)},${(topY + r).toFixed(2)}V${baseY.toFixed(2)}Z`;
        }
        return `M${x.toFixed(2)},${baseY.toFixed(2)}V${(topY - r).toFixed(2)}Q${x.toFixed(2)},${topY.toFixed(2)} ${(x + r).toFixed(2)},${topY.toFixed(2)}H${(x + barWidth - r).toFixed(2)}Q${(x + barWidth).toFixed(2)},${topY.toFixed(2)} ${(x + barWidth).toFixed(2)},${(topY - r).toFixed(2)}V${baseY.toFixed(2)}Z`;
      })
      .filter(Boolean)
      .join(' ');
  }

  private segments(secondary: boolean): { x: number; y: number }[][] {
    const segs: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    const pts = this.points();
    for (let i = 0; i < pts.length; i++) {
      const value = this.isValidPoint(pts[i], secondary);
      if (value == null) {
        if (current.length) {
          segs.push(current);
          current = [];
        }
        continue;
      }
      current.push({ x: this.x(i), y: this.y(value) });
    }
    if (current.length) segs.push(current);
    return segs;
  }

  private smoothSegmentPath(pts: { x: number; y: number }[]): string {
    if (!pts.length) return '';
    let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = ((prev.x + curr.x) / 2).toFixed(2);
      d += ` C${cx},${prev.y.toFixed(2)} ${cx},${curr.y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
    }
    return d;
  }

  area(): string {
    const base = this.y(0).toFixed(2);
    return this.segments(false)
      .map((seg) => {
        const line = this.smoothSegmentPath(seg);
        const firstX = seg[0].x.toFixed(2);
        const lastX = seg[seg.length - 1].x.toFixed(2);
        return `${line} L${lastX},${base} L${firstX},${base} Z`;
      })
      .join(' ');
  }

  constructor() {
    effect(() => {
      this.points();
      this.tablePage.set(1);
    });
  }

  path(secondary: boolean): string {
    return this.segments(secondary)
      .map((seg) => this.smoothSegmentPath(seg))
      .join(' ');
  }
}
