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
    if (
      filter.videoLoop !== undefined &&
      filter.videoLoop !== 'unmarked' &&
      (!Number.isSafeInteger(filter.videoLoop) || filter.videoLoop < 0)
    )
      return 'Video loop must be a non-negative integer or unmarked.';
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
  readonly availableVideoLoops = input<(number | null)[]>([]);
  readonly busy = input(false);
  readonly requireVideoBounds = input(false);
  readonly defaultExpanded = input(true);
  readonly videoLoop = signal<number | 'unmarked'>('unmarked');
  readonly loopError = signal('');
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
  }));
  private userChoseSource = false;
  constructor() {
    effect(() => {
      if (!this.defaultExpanded()) {
        untracked(() => this.expanded.set(false));
      }
    });
    const query = this.route.snapshot.queryParamMap;
    this.userChoseSource = query.has('sourceType');
    if (query.get('siteId')) this.context.selectedSiteId.set(query.get('siteId')!);
    if (query.get('sourceType') === 'video_file') this.source.set('video_file');
    this.cameraId.set(query.get('cameraId') ?? '');
    this.zoneId.set(query.get('zoneId') ?? '');
    this.sessionId.set(query.get('sessionId') ?? '');
    const loop = query.get('videoLoop');
    if (loop !== null) this.setLoop(loop);
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
          this.context.auth.administrator()
            ? this.api.all<Camera>('cameras', { siteId }).pipe(
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
        this.cameras.set(items);
        const session = this.session();
        const sessionCamera = session && items.find((camera) => camera.id === session.cameraId);
        if (sessionCamera) this.context.selectedSiteId.set(sessionCamera.siteId);
        if (
          this.context.auth.administrator() &&
          !session &&
          this.cameraId() &&
          !items.some((item) => item.id === this.cameraId())
        ) {
          this.cameraId.set('');
          this.zoneId.set('');
        }
      });
    toObservable(this.cameraId)
      .pipe(
        switchMap((id) =>
          id && this.context.auth.administrator()
            ? this.api.all<Zone>(`cameras/${id}/zones`).pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((items) => {
        this.zones.set(items);
        if (this.context.auth.administrator() && !items.some((item) => item.id === this.zoneId()))
          this.zoneId.set('');
      });
    toObservable(this.sessionQuery)
      .pipe(
        switchMap((q) =>
          !this.session() && this.context.auth.administrator()
            ? this.api
                .all<Session>('analytics/sessions', {
                  siteId: q.siteId,
                  cameraId: q.cameraId,
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
        const videoSessions = items.filter((item) => item.sourceType === 'video_file');
        const hasLiveSessions = items.some((item) => item.sourceType === 'live');
        this.sessions.set(videoSessions);
        if (!this.context.auth.administrator() || this.session()) return;

        let autoSwitched = false;
        if (!this.userChoseSource && this.source() === 'live' && videoSessions.length > 0 && !hasLiveSessions) {
          this.source.set('video_file');
          autoSwitched = true;
        }

        if (this.source() === 'video_file') {
          const current = videoSessions.find((item) => item.id === this.sessionId());
          if (current) {
            if (this.fromMs() == null && current.firstSourceTimeMs != null) {
              this.fromMs.set(current.firstSourceTimeMs);
            }
            if (this.toMs() == null && current.lastSourceTimeMs != null) {
              this.toMs.set(current.lastSourceTimeMs + 1);
            }
            if (autoSwitched || (this.requireVideoBounds() && this.error())) {
              this.apply(false);
            }
          } else if (videoSessions.length > 0) {
            const preferred =
              videoSessions.find((s) => s.status?.toLowerCase() === 'running') ?? videoSessions[0];
            this.populateFromSession(
              preferred,
              !query.has('videoLoop') || autoSwitched,
              (!query.has('fromSourceTimeMs') && !query.has('toSourceTimeMs')) || autoSwitched,
              !query.has('interval') || autoSwitched,
            );
            this.apply(false);
          } else {
            this.sessionId.set('');
          }
        }
      });
    effect(() => {
      const session = this.session();
      if (session) {
        this.source.set(session.sourceType);
        this.sessionId.set(session.id);
        if (!query.has('videoLoop')) this.videoLoop.set(session.lastVideoLoop ?? 'unmarked');
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
  setSource(next: SourceType): void {
    this.userChoseSource = true;
    this.source.set(next);
    if (next === 'video_file') {
      const videoSessions = this.sessions();
      const preferred =
        videoSessions.find((s) => s.id === this.sessionId()) ??
        videoSessions.find((s) => s.status?.toLowerCase() === 'running') ??
        videoSessions[0];
      if (preferred) {
        this.populateFromSession(preferred, true, true, true);
      } else {
        this.sessionId.set('');
      }
    } else {
      this.sessionId.set('');
    }
  }
  setSession(id: string): void {
    this.sessionId.set(id);
    const selected = this.sessions().find((item) => item.id === id);
    if (selected) {
      this.populateFromSession(selected, true, true, false);
    }
  }
  private populateFromSession(
    session: Session,
    updateLoop: boolean,
    updateBounds: boolean,
    updateInterval: boolean,
  ): void {
    this.sessionId.set(session.id);
    if (updateLoop) {
      this.videoLoop.set(session.lastVideoLoop ?? 'unmarked');
      this.loopError.set('');
    }
    if (updateBounds) {
      const start = session.firstSourceTimeMs ?? 0;
      const end = session.lastSourceTimeMs == null ? null : session.lastSourceTimeMs + 1;
      this.fromMs.set(end != null && start >= end ? 0 : start);
      this.toMs.set(end);
    }
    if (updateInterval && session.lastSourceTimeMs != null && session.lastSourceTimeMs <= 3600000) {
      this.interval.set('minute');
    }
  }
  setCamera(id: string): void {
    this.cameraId.set(id);
    this.zoneId.set('');
    this.sessionId.set(this.session()?.id ?? '');
  }
  setLoop(value: string): void {
    if (value === 'unmarked' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)))) {
      this.videoLoop.set(value === 'unmarked' ? value : Number(value));
      this.loopError.set('');
    } else this.loopError.set('Video loop must be a non-negative integer or unmarked.');
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
      filter.videoLoop = this.videoLoop();
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
    const message =
      (filter.sourceType === 'video_file' ? this.loopError() : '') ||
      validateFilter(filter) ||
      (filter.sourceType === 'video_file' &&
      this.requireVideoBounds() &&
      (filter.fromSourceTimeMs == null || filter.toSourceTimeMs == null)
        ? 'Select start and end source positions for this video loop.'
        : null);
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
