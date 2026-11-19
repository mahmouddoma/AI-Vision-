import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Api, apiError } from '../../core/api';
import { Camera, LiveCamera, LiveZone, Site, Zone } from '../../core/models';
import { Realtime } from '../../core/realtime';
import { LocalizedFormat } from '../../core/localized-format';
import { I18nService, TranslatePipe } from '../../core/i18n';
import { Chart, ChartPoint } from '../../ui/chart';
import { StateView } from '../../ui/feedback';
import { Icon, IconName } from '../../ui/icon';
import { Status } from '../../ui/status';

export interface MovementSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
  dash: string;
  offset: number;
}

@Component({
  selector: 'app-resource-detail',
  imports: [RouterLink, TranslatePipe, StateView, Icon, Status, Chart],
  templateUrl: './resource-detail.html',
  styleUrl: './resource-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceDetail {
  private readonly api = inject(Api);
  private readonly realtime = inject(Realtime);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  readonly kind = this.route.snapshot.data['kind'] as 'sites' | 'cameras' | 'zones';
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly id = computed(() => this.params().get('id') ?? '');
  readonly version = signal(0);
  readonly format = inject(LocalizedFormat);

  readonly kindIcon = computed<IconName>(() =>
    this.kind === 'sites' ? 'building' : this.kind === 'cameras' ? 'camera' : 'zones',
  );

  readonly result = toSignal(
    toObservable(
      computed(() => {
        this.version();
        return this.id();
      }),
    ).pipe(
      switchMap((id) =>
        this.api.get<Site | Camera | Zone>(`${this.kind}/${id}`).pipe(
          map((data) => ({ data, loading: false, error: null })),
          catchError((error) => of({ data: null, loading: false, error: apiError(error) })),
          startWith({ data: null, loading: true, error: null }),
        ),
      ),
    ),
    { initialValue: { data: null, loading: true, error: null } },
  );

  readonly feed = toSignal(
    toObservable(computed(() => this.result().data)).pipe(
      switchMap((data) =>
        data && this.kind !== 'sites'
          ? this.realtime.watch(
              'camera',
              this.kind === 'zones' ? this.zone(data).cameraId : data.id,
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  readonly parentCamera = computed<LiveCamera | null>(() => {
    const feed = this.feed();
    return feed?.cameras?.[0] ?? null;
  });

  readonly liveZone = computed<LiveZone | null>(() => {
    const id = this.id();
    const feed = this.feed();
    if (!feed || this.kind !== 'zones') return null;
    for (const camera of feed.cameras) {
      const match = camera.zones.find((z) => z.zoneId === id);
      if (match) return match;
    }
    return null;
  });

  readonly movementChartPoints = computed<ChartPoint[]>(() => {
    const lz = this.liveZone();
    if (!lz) return [];
    const pts: ChartPoint[] = [
      {
        label: this.i18n.t('Zone flow'),
        value: lz.zoneArrivals ?? null,
        secondary: lz.zoneDepartures ?? null,
      },
      {
        label: this.i18n.t('Gate flow'),
        value: lz.entry ?? null,
        secondary: lz.exit ?? null,
      },
      {
        label: this.i18n.t('Wrong-way'),
        value: lz.wrongWayIn ?? null,
        secondary: lz.wrongWayOut ?? null,
      },
    ];
    return pts.some((p) => (p.value ?? 0) > 0 || (p.secondary ?? 0) > 0) ? pts : [];
  });

  readonly movementBreakdown = computed<{ total: number; segments: MovementSegment[] }>(() => {
    const lz = this.liveZone();
    if (!lz) return { total: 0, segments: [] };
    const raw = [
      { key: 'arrivals', label: 'Arrivals', value: lz.zoneArrivals ?? 0, color: '#0ea5e9' },
      { key: 'departures', label: 'Departures', value: lz.zoneDepartures ?? 0, color: '#7c3aed' },
      { key: 'entries', label: 'Gate entries', value: lz.entry ?? 0, color: '#10b981' },
      { key: 'exits', label: 'Gate exits', value: lz.exit ?? 0, color: '#f59e0b' },
      { key: 'wwIn', label: 'Wrong-way in', value: lz.wrongWayIn ?? 0, color: '#f43f5e' },
      { key: 'wwOut', label: 'Wrong-way out', value: lz.wrongWayOut ?? 0, color: '#fb923c' },
    ];
    const total = raw.reduce((acc, item) => acc + Math.max(0, item.value), 0);
    const maxVal = Math.max(1, ...raw.map((r) => r.value));
    const circumference = 2 * Math.PI * 38;
    let cursor = 0;
    const segments: MovementSegment[] = raw.map((item) => {
      const share = total > 0 ? Math.max(0, item.value) / total : 0;
      const arc = share * circumference;
      const offset = -cursor;
      cursor += arc;
      return {
        ...item,
        percent: total > 0 ? Math.round((item.value / maxVal) * 100) : 0,
        dash: `${arc.toFixed(2)} ${(circumference - arc).toFixed(2)}`,
        offset,
      };
    });
    return { total, segments };
  });

  readonly cameraZonesChartPoints = computed<ChartPoint[]>(() => {
    const cam = this.parentCamera();
    if (!cam || this.kind !== 'cameras') return [];
    return cam.zones.map((z) => ({
      label: z.zoneName,
      value: z.occupancy ?? null,
      secondary: z.activeVisitorsCount ?? null,
    }));
  });

  reload(): void {
    this.version.update((v) => v + 1);
  }

  site(item: Site | Camera | Zone): Site {
    return item as Site;
  }

  camera(item: Site | Camera | Zone): Camera {
    return item as Camera;
  }

  zone(item: Site | Camera | Zone): Zone {
    return item as Zone;
  }
}
