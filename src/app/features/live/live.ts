import { LocalizedFormat } from '../../core/localized-format';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { gsap } from 'gsap';
import { AppContext } from '../../core/context';
import { Realtime, FeedState } from '../../core/realtime';
import {
  calculateLiveOccupancy,
  describeLiveOccupancy,
  isEligibleLiveCamera,
  isEligibleLiveZone,
} from '../../core/live-occupancy';
import { LiveZone } from '../../core/models';
import { Api, UiError, apiError } from '../../core/api';
import { Icon } from '../../ui/icon';
import { StateView } from '../../ui/feedback';
import { Status } from '../../ui/status';
import { Dialog } from '../../ui/dialog';
import { Chart, ChartPoint } from '../../ui/chart';
import { I18nService, TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-live',
  imports: [RouterLink, Icon, StateView, Status, Dialog, Chart, TranslatePipe],
  templateUrl: './live.html',
  styleUrl: './live.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Live {
  readonly i18n = inject(I18nService);
  readonly context = inject(AppContext);
  readonly realtime = inject(Realtime);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
  private readonly version = signal(0);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly cameraId = computed(() => this.params().get('cameraId') ?? '');
  private readonly target = computed(() => {
    this.version();
    return {
      scope: this.cameraId() ? ('camera' as const) : ('site' as const),
      id: this.cameraId() || this.context.selectedSiteId(),
    };
  });
  readonly feed = toSignal(
    toObservable(this.target).pipe(
      switchMap((target) =>
        target.id
          ? this.realtime.watch(target.scope, target.id)
          : of<FeedState>({ cameras: [], loading: false, error: null, refreshedAt: null }),
      ),
    ),
    { initialValue: { cameras: [], loading: true, error: null, refreshedAt: null } as FeedState },
  );
  readonly search = signal('');
  readonly freshness = signal('');
  readonly collapsedCameras = signal<ReadonlySet<string>>(new Set());
  readonly cameras = computed(() =>
    this.feed().cameras.filter(
      (camera) =>
        camera.cameraName.toLowerCase().includes(this.search().toLowerCase()) &&
        (!this.freshness() || camera.dataFreshness === this.freshness()),
    ),
  );
  readonly allCollapsed = computed(() => {
    const list = this.cameras();
    return list.length > 0 && list.every((c) => this.collapsedCameras().has(c.cameraId));
  });

  toggleCamera(cameraId: string): void {
    const next = new Set(this.collapsedCameras());
    if (next.has(cameraId)) {
      next.delete(cameraId);
    } else {
      next.add(cameraId);
    }
    this.collapsedCameras.set(next);
  }

  isCollapsed(cameraId: string): boolean {
    return this.collapsedCameras().has(cameraId);
  }

  toggleAll(): void {
    if (this.allCollapsed()) {
      this.collapsedCameras.set(new Set());
    } else {
      this.collapsedCameras.set(new Set(this.cameras().map((c) => c.cameraId)));
    }
  }
  readonly occupancySummary = computed(() =>
    calculateLiveOccupancy(this.feed().cameras, { disconnected: Boolean(this.feed().error) }),
  );
  readonly occupancy = computed(() => this.occupancySummary().observedOccupancy);
  readonly occupancyView = computed(() =>
    describeLiveOccupancy(this.occupancySummary(), this.feed().loading),
  );
  readonly cameraHealthMix = computed(() => {
    const s = this.occupancySummary();
    const raw = [
      { key: 'fresh', label: 'Fresh', value: s.freshCameras, color: '#10b981' },
      { key: 'stale', label: 'Stale', value: s.staleCameras, color: '#f59e0b' },
      { key: 'noRecent', label: 'No recent data', value: s.noRecentDataCameras, color: '#ef4444' },
      {
        key: 'other',
        label: 'live.otherExcluded',
        value: s.otherExcludedCameras,
        color: '#6366f1',
      },
    ];
    const total = s.totalCameras;
    const circumference = 2 * Math.PI * 38;
    let offset = 0;
    const slices = raw.map((item) => {
      const share = total > 0 ? item.value / total : 0;
      const len = share * circumference;
      const slice = {
        ...item,
        percent: share * 100,
        dasharray: `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`,
        dashoffset: -offset,
      };
      offset += len;
      return slice;
    });
    return { total, slices };
  });
  readonly eligibleZoneChartPoints = computed<ChartPoint[]>(() => {
    if (this.feed().error) return [];
    const points: ChartPoint[] = [];
    for (const camera of this.feed().cameras) {
      if (!isEligibleLiveCamera(camera)) continue;
      for (const zone of camera.zones) {
        if (!isEligibleLiveZone(zone, camera)) continue;
        points.push({
          label: `${camera.cameraName} · ${zone.zoneName}`,
          value: zone.occupancy,
          secondary: zone.capacity,
        });
      }
    }
    return points;
  });
  readonly cameraPerfChartPoints = computed<ChartPoint[]>(() =>
    this.feed().cameras.map((camera) => ({
      label: camera.cameraName,
      value: camera.processingFps,
      secondary: camera.staffCount,
    })),
  );
  private readonly zoneSnapshot = signal<LiveZone | null>(null);
  readonly zone = computed(() => {
    const snapshot = this.zoneSnapshot();
    const latest = this.feed()
      .cameras.flatMap((camera) => camera.zones)
      .find((zone) => zone.zoneId === snapshot?.zoneId);
    return latest && (latest.stateVersion ?? -1) > (snapshot?.stateVersion ?? -1)
      ? latest
      : snapshot;
  });
  private readonly zoneRequest = signal<{ id: string; nonce: number } | null>(null);
  readonly zoneError = signal<UiError | null>(null);
  readonly zoneLoading = signal(false);
  readonly drawerOpen = signal(false);
  readonly num = inject(LocalizedFormat).number;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly duration = inject(LocalizedFormat).duration;
  reload(): void {
    this.version.update((value) => value + 1);
  }
  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });
    effect(() => {
      const camera = this.feed().cameras[0];
      if (
        this.cameraId() &&
        camera &&
        this.context.sites().some((site) => site.id === camera.siteId)
      )
        this.context.selectedSiteId.set(camera.siteId);
    });
    toObservable(computed(() => (this.drawerOpen() ? this.zoneRequest() : null)))
      .pipe(
        switchMap((request) => {
          if (!request) return of(null);
          this.zoneLoading.set(true);
          this.zoneError.set(null);
          return this.api.get<LiveZone>(`zones/${request.id}/live`).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.zoneLoading.set(false);
        this.zoneError.set(result?.error ?? null);
        if (result?.data) this.zoneSnapshot.set(result.data);
      });
  }
  inspect(zone: LiveZone): void {
    this.zoneSnapshot.set(zone);
    this.drawerOpen.set(true);
    this.zoneRequest.set({ id: zone.zoneId, nonce: Date.now() });
  }

  private animateEntrance(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.elementRef.nativeElement as HTMLElement;
    const ctx = gsap.context(() => {
      gsap.from('.page-heading', {
        opacity: 0,
        y: -10,
        duration: 0.45,
        ease: 'power2.out',
      });
      gsap.from('.kpi-col', {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.05,
        ease: 'power2.out',
        delay: 0.08,
      });
      gsap.from('.surface', {
        opacity: 0,
        y: 12,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.2,
      });
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
}
