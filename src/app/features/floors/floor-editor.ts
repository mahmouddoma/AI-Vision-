import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { SmartApi } from '../../core/smart-api';
import { Camera, ReportFilter, Zone } from '../../core/models';
import { Vertex, ZoneLayout } from '../../core/smart-models';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { VisualizationView } from '../../ui/visualization';
import { ReportFilters } from '../analytics/report-filters';
import { polygonError } from './geometry';
import { Auth } from '../../core/auth';

@Component({
  selector: 'app-floor-editor',
  imports: [FormsModule, RouterLink, TranslatePipe, StateView, VisualizationView, ReportFilters],
  templateUrl: './floor-editor.html',
  styleUrl: './floor-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorEditor {
  readonly auth = inject(Auth);
  private readonly api = inject(SmartApi);
  private readonly http = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly id = computed(() => this.params().get('id') ?? '');
  readonly heatmapMode = this.route.snapshot.data['heatmap'] === true;
  readonly version = signal(0);
  readonly cameraId = signal('');
  readonly zoneId = signal('');
  readonly vertices = signal<Vertex[]>([]);
  readonly layout = signal<ZoneLayout | null>(null);
  readonly error = signal<UiError | null>(null);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  private dragging: number | null = null;
  readonly filter = signal<ReportFilter | null>(null);
  readonly metric = signal('arrivals');
  readonly polygonError = computed(() => polygonError(this.vertices()));
  readonly result = toSignal(
    toObservable(computed(() => ({ id: this.id(), version: this.version() }))).pipe(
      switchMap(({ id }) => {
        this.zoneId.set('');
        this.vertices.set([]);
        this.layout.set(null);
        return forkJoin({ floor: this.api.floor(id), layouts: this.api.layouts(id) }).pipe(
          switchMap((data) =>
            (this.auth.administrator()
              ? this.http.all<Camera>('cameras', { siteId: data.floor.siteId })
              : of<Camera[]>([])
            ).pipe(map((cameras) => ({ ...data, cameras }))),
          ),
          map((data) => ({ data, loading: false, error: null })),
          catchError((error) => of({ data: null, loading: false, error: apiError(error) })),
          startWith({ data: null, loading: true, error: null }),
        );
      }),
    ),
    { initialValue: { data: null, loading: true, error: null } },
  );
  readonly zones = toSignal(
    toObservable(this.cameraId).pipe(
      switchMap((id) =>
        id && this.auth.administrator()
          ? this.http.all<Zone>(`cameras/${id}/zones`).pipe(
              catchError((error) => {
                this.error.set(apiError(error));
                return of<Zone[]>([]);
              }),
            )
          : of<Zone[]>([]),
      ),
    ),
    { initialValue: [] },
  );
  readonly heatmap = toSignal(
    toObservable(
      computed(() => ({
        id: this.id(),
        filter: this.filter(),
        metric: this.metric(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ id, filter, metric }) =>
        filter && this.heatmapMode
          ? this.api.heatmap(id, metric, filter).pipe(
              map((value) => ({ value, loading: false, error: null })),
              catchError((error) => of({ value: null, loading: false, error: apiError(error) })),
              startWith({ value: null, loading: true, error: null }),
            )
          : of({ value: null, loading: false, error: null }),
      ),
    ),
    { initialValue: { value: null, loading: false, error: null } },
  );
  errorFields(error: UiError): string[] {
    return Object.values(error.fields).flat();
  }
  reload(): void {
    this.error.set(null);
    this.deleting.set(false);
    this.version.update((v) => v + 1);
  }
  selectZone(id: string): void {
    const layout = this.result().data?.layouts.find((l) => l.zoneId === id) ?? null;
    this.zoneId.set(id);
    this.layout.set(layout);
    this.vertices.set(layout?.vertices.map((v) => ({ ...v })) ?? []);
    this.deleting.set(false);
    this.error.set(null);
  }
  polygon(vertices: Vertex[]): string {
    return vertices.map((v) => `${v.x * 1000},${v.y * 700}`).join(' ');
  }
  addPoint(event: MouseEvent): void {
    if (!this.zoneId() || this.saving() || this.vertices().length >= 64) return;
    const svg = event.currentTarget as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    this.vertices.update((v) => [
      ...v,
      { x: Math.min(1, Math.max(0, p.x / 1000)), y: Math.min(1, Math.max(0, p.y / 700)) },
    ]);
  }
  move(index: number, key: 'x' | 'y', value: number): void {
    this.vertices.update((points) =>
      points.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    );
  }
  startDrag(event: PointerEvent, index: number): void {
    if (this.saving() || !this.auth.canWrite(this.result().data?.floor.siteId ?? '')) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = index;
    (event.target as SVGCircleElement).setPointerCapture(event.pointerId);
  }
  drag(event: PointerEvent): void {
    if (this.dragging === null) return;
    const svg = (event.currentTarget as SVGCircleElement).ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const index = this.dragging;
    this.vertices.update((points) =>
      points.map((p, i) =>
        i === index
          ? {
              x: Math.max(0, Math.min(1, point.x / 1000)),
              y: Math.max(0, Math.min(1, point.y / 700)),
            }
          : p,
      ),
    );
  }
  endDrag(): void {
    this.dragging = null;
  }
  remove(index: number): void {
    this.vertices.update((points) => points.filter((_, i) => i !== index));
  }
  save(): void {
    if (!this.auth.canWrite(this.result().data?.floor.siteId ?? '')) return;
    if (!this.zoneId() || this.polygonError() || this.saving() || this.error()?.conflict) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .saveLayout(this.id(), this.zoneId(), this.vertices(), this.layout()?.rowVersion)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({ next: () => this.reload(), error: (error) => this.error.set(apiError(error)) });
  }
  delete(): void {
    if (!this.auth.canWrite(this.result().data?.floor.siteId ?? '')) return;
    const layout = this.layout();
    if (!layout || this.saving()) return;
    this.saving.set(true);
    this.api
      .deleteLayout(this.id(), layout)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({ next: () => this.reload(), error: (error) => this.error.set(apiError(error)) });
  }
}
