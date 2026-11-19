import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Api, apiError } from '../../core/api';
import { Camera, LiveCamera, LiveZone, Site, Zone } from '../../core/models';
import { Realtime } from '../../core/realtime';
import { LocalizedFormat } from '../../core/localized-format';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Icon, IconName } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'app-resource-detail',
  imports: [RouterLink, TranslatePipe, StateView, Icon, Status],
  templateUrl: './resource-detail.html',
  styleUrl: './resource-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceDetail {
  private readonly api = inject(Api);
  private readonly realtime = inject(Realtime);
  private readonly route = inject(ActivatedRoute);
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
