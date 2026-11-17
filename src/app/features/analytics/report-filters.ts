import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Camera, Interval, ReportFilter, Session, SourceType, Zone } from '../../core/models';
import { I18nService, TranslatePipe } from '../../core/i18n';
import { Icon } from '../../ui/icon';

export function validateFilter(filter: ReportFilter): string | null {
  if (filter.sourceType === 'video_file') {
    if (!filter.sessionId) return 'Select a recorded-video session.';
    const from = filter.fromSourceTimeMs;
    const to = filter.toSourceTimeMs;
    if (
      (from != null && (!Number.isSafeInteger(from) || from < 0)) ||
      (to != null && (!Number.isSafeInteger(to) || to < 0))
    )
      return 'Video positions must be non-negative milliseconds.';
    if (from != null && to != null && from >= to)
      return 'End position must be after start position.';
  } else {
    const from = Date.parse(filter.from ?? '');
    const to = Date.parse(filter.to ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to)
      return 'Choose a valid start and end time. End must be later than start.';
    const maxDays = filter.interval === 'minute' ? 7 : 90;
    if (to - from > maxDays * 86400000)
      return `Choose a range up to ${maxDays} days for this interval (backend defaults).`;
  }
  return null;
}
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
@Component({
  selector: 'app-report-filters',
  imports: [FormsModule, Icon, TranslatePipe],
  templateUrl: './report-filters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportFilters {
  readonly i18n = inject(I18nService);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly context = inject(AppContext);
  readonly session = input<Session | null>(null);
  readonly busy = input(false);
  readonly expanded = signal(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );
  readonly changed = output<ReportFilter>();
  readonly source = signal<SourceType>('live');
  readonly cameraId = signal('');
  readonly zoneId = signal('');
  readonly sessionId = signal('');
  readonly interval = signal<Interval>('hour');
  readonly from = signal(localDate(new Date(Date.now() - 86400000)));
  readonly to = signal(localDate(new Date()));
  readonly fromMs = signal<number | null>(null);
  readonly toMs = signal<number | null>(null);
  readonly cameras = signal<Camera[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly sessions = signal<Session[]>([]);
  readonly error = signal('');
  readonly lookupsError = signal<UiError | null>(null);
  readonly localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly cameraQuery = computed(() =>
    this.session() ? '' : this.context.selectedSiteId(),
  );
  private readonly sessionQuery = computed(() => ({
    siteId: this.context.selectedSiteId(),
    cameraId: this.cameraId(),
    source: this.source(),
  }));
  constructor() {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('sourceType') === 'video_file') this.source.set('video_file');
    this.cameraId.set(query.get('cameraId') ?? '');
    this.zoneId.set(query.get('zoneId') ?? '');
    this.sessionId.set(query.get('sessionId') ?? '');
    for (const [key, target] of [
      ['fromSourceTimeMs', this.fromMs],
      ['toSourceTimeMs', this.toMs],
    ] as const) {
      const value = query.get(key);
      if (value !== null && Number.isSafeInteger(Number(value))) target.set(Number(value));
    }
    if (['minute', 'hour', 'day'].includes(query.get('interval') ?? ''))
      this.interval.set(query.get('interval') as Interval);
    for (const key of ['from', 'to'] as const) {
      const value = query.get(key);
      if (value && Number.isFinite(Date.parse(value))) this[key].set(localDate(new Date(value)));
    }
    toObservable(this.cameraQuery)
      .pipe(
        switchMap((siteId) =>
          this.api.all<Camera>('cameras', { siteId }).pipe(
            catchError((error) => {
              this.lookupsError.set(apiError(error));
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((items) => {
        this.cameras.set(items);
        const session = this.session();
        const sessionCamera = session && items.find((camera) => camera.id === session.cameraId);
        if (sessionCamera) this.context.selectedSiteId.set(sessionCamera.siteId);
        if (!session && this.cameraId() && !items.some((item) => item.id === this.cameraId())) {
          this.cameraId.set('');
          this.zoneId.set('');
        }
      });
    toObservable(this.cameraId)
      .pipe(
        switchMap((id) =>
          id ? this.api.all<Zone>(`cameras/${id}/zones`).pipe(catchError(() => of([]))) : of([]),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((items) => {
        this.zones.set(items);
        if (!items.some((item) => item.id === this.zoneId())) this.zoneId.set('');
      });
    toObservable(this.sessionQuery)
      .pipe(
        switchMap((query) =>
          query.source === 'video_file' && !this.session()
            ? this.api
                .all<Session>('analytics/sessions', {
                  siteId: query.siteId,
                  cameraId: query.cameraId,
                  sourceType: 'video_file',
                })
                .pipe(
                  catchError((error) => {
                    this.lookupsError.set(apiError(error));
                    return of([]);
                  }),
                )
            : of([]),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((items) => {
        this.sessions.set(items);
        if (!this.session() && !items.some((item) => item.id === this.sessionId()))
          this.sessionId.set('');
      });
    effect(() => {
      const session = this.session();
      if (session) {
        this.source.set(session.sourceType);
        this.sessionId.set(session.id);
        this.cameraId.set(session.cameraId);
        this.fromMs.set(session.firstSourceTimeMs);
        this.toMs.set(session.lastSourceTimeMs == null ? null : session.lastSourceTimeMs + 1);
        if (session.sourceType === 'live') {
          this.from.set(localDate(new Date(session.firstSourceTimestampUtc)));
          this.to.set(localDate(new Date(Date.parse(session.lastSourceTimestampUtc) + 60000)));
        }
      }
    });
    let initial = true;
    let site = this.context.selectedSiteId();
    effect(() => {
      const selected = this.context.selectedSiteId();
      const loaded = !this.context.sitesLoading();
      const session = this.session();
      if (loaded && (initial || selected !== site || !!session)) {
        const firstApplication = initial;
        initial = false;
        const changedSite = selected !== site;
        site = selected;
        untracked(() => {
          if (changedSite && !session && !firstApplication) {
            this.cameraId.set('');
            this.zoneId.set('');
            this.sessionId.set('');
          }
          this.apply(false);
        });
      }
    });
  }
  setCamera(id: string): void {
    this.cameraId.set(id);
    this.zoneId.set('');
    this.sessionId.set(this.session()?.id ?? '');
  }
  apply(persist = true): void {
    const filter: ReportFilter = {
      siteId: this.session() ? undefined : this.context.selectedSiteId() || undefined,
      cameraId: this.cameraId() || undefined,
      zoneId: this.zoneId() || undefined,
      sourceType: this.source(),
      interval: this.interval(),
    };
    if (this.source() === 'video_file') {
      filter.sessionId = this.sessionId() || undefined;
      filter.fromSourceTimeMs = this.fromMs() ?? undefined;
      filter.toSourceTimeMs = this.toMs() ?? undefined;
    } else {
      filter.from =
        this.from() && Number.isFinite(Date.parse(this.from()))
          ? new Date(this.from()).toISOString()
          : undefined;
      filter.to =
        this.to() && Number.isFinite(Date.parse(this.to()))
          ? new Date(this.to()).toISOString()
          : undefined;
    }
    const message = validateFilter(filter);
    this.error.set(message ?? '');
    if (message) return;
    if (persist)
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { ...filter, tab: this.route.snapshot.queryParamMap.get('tab') },
        replaceUrl: true,
      });
    this.changed.emit(filter);
  }
}
