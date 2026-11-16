import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { DataQuality } from '../core/models';
import { number } from '../core/format';
import { Quality } from './quality';
import { Table, Pagination } from './table';
export interface ChartPoint {
  label: string;
  value: number | null;
  secondary?: number | null;
  quality?: DataQuality;
}
@Component({
  selector: 'app-chart',
  imports: [Table, Quality, Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure class="chart">
    <figcaption>
      <div>
        <h3>{{ title() }}</h3>
        <p>{{ description() }}</p>
      </div>
      <span class="chart-legend"
        >{{ primaryLabel() }}
        @if (secondaryLabel()) {
          <span> / {{ secondaryLabel() }}</span>
        }
      </span>
    </figcaption>
    @if (hasValues()) {
      <div class="chart-canvas">
        <span class="chart-max">{{ num(max(), 1) }}</span>
        <svg
          viewBox="0 0 640 180"
          preserveAspectRatio="none"
          role="img"
          [attr.aria-label]="
            title() + '. ' + description() + '. Exact values in the data table below.'
          "
        >
          <path class="chart-grid" d="M 0 10 H 640 M 0 90 H 640 M 0 170 H 640" />
          <path class="chart-line" [attr.d]="path(false)" />
          @if (secondaryLabel()) {
            <path class="chart-line secondary-line" [attr.d]="path(true)" />
          }</svg
        ><span class="chart-min">0</span>
      </div>
      <div class="chart-axis">
        <span>{{ points()[0]?.label }}</span><span>{{ points().at(-1)?.label }}</span>
      </div>
    } @else {
      <p class="chart-empty">
        No eligible observations in this period. Missing values are not zero.
      </p>
    }
    <details class="chart-data" (toggle)="tableOpen.set($any($event.target).open)">
      <summary>View accessible data table ({{ points().length }} periods)</summary>
      @if (tableOpen()) {
        <app-table label="Chart data"
          ><table>
            <caption class="visually-hidden">
              {{
                title()
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">{{ primaryLabel() }}</th>
                @if (secondaryLabel()) {
                  <th scope="col">{{ secondaryLabel() }}</th>
                }
                <th scope="col">Quality</th>
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
                  <td><app-quality [value]="point.quality" /></td>
                </tr>
              }
            </tbody></table
        ></app-table>
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
  readonly num = number;
  readonly hasValues = computed(() =>
    this.points().some((p) => p.value != null || p.secondary != null),
  );
  readonly max = computed(() =>
    Math.max(1, ...this.points().flatMap((p) => [p.value ?? 0, p.secondary ?? 0])),
  );
  constructor() {
    effect(() => {
      this.points();
      this.tablePage.set(1);
    });
  }
  path(secondary: boolean): string {
    let started = false;
    return this.points()
      .map((point, index) => {
        const value = secondary ? point.secondary : point.value;
        if (value == null || point.quality?.kind === 'InsufficientData') {
          started = false;
          return '';
        }
        const command = started ? 'L' : 'M';
        started = true;
        return `${command}${((index / Math.max(this.points().length - 1, 1)) * 640).toFixed(2)},${(170 - (value / this.max()) * 160).toFixed(2)}`;
      })
      .join(' ');
  }
}
