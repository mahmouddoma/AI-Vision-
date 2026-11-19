import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { SmartApi } from '../../core/smart-api';
import { AppContext } from '../../core/context';
import { Camera, Zone } from '../../core/models';
import { AlertKind, AlertRule, AlertRuleWrite } from '../../core/smart-models';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';

export function ruleError(value: AlertRuleWrite): string | null {
  const zoneScoped = ['Congestion', 'LongStay', 'WrongWaySpike'].includes(value.kind);
  if (
    !value.name.trim() ||
    value.name.trim().length > 160 ||
    !value.siteId ||
    !value.cameraId ||
    zoneScoped !== !!value.zoneId
  )
    return 'Provide a name and a matching camera or zone scope.';
  if (
    !Number.isFinite(value.threshold) ||
    value.threshold <= 0 ||
    value.threshold > 1e9 ||
    (value.kind === 'CameraNoRecentData' && (value.allowVideo || value.threshold > 86400))
  )
    return 'Check the positive threshold and supported video setting.';
  if (
    ![
      value.windowSeconds,
      value.minimumObservedSeconds,
      value.recoverySeconds,
      value.cooldownSeconds ?? 0,
    ].every(Number.isInteger) ||
    value.windowSeconds < 1 ||
    value.windowSeconds > 3600 ||
    value.minimumObservedSeconds < 0 ||
    value.minimumObservedSeconds > value.windowSeconds ||
    value.recoverySeconds < 1 ||
    value.recoverySeconds > value.windowSeconds ||
    (value.cooldownSeconds != null &&
      (value.cooldownSeconds < 0 || value.cooldownSeconds > 86400)) ||
    (value.minimumCoveragePercent != null &&
      (!Number.isFinite(value.minimumCoveragePercent) ||
        value.minimumCoveragePercent <= 0 ||
        value.minimumCoveragePercent > 100))
  )
    return 'Check window, observed duration, recovery, cooldown and coverage.';
  return null;
}
@Component({
  selector: 'app-rule-editor',
  imports: [FormsModule, RouterLink, TranslatePipe, StateView],
  templateUrl: './rule-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleEditor {
  private readonly api = inject(SmartApi);
  private readonly http = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly context = inject(AppContext);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly id = computed(() => this.params().get('id'));
  readonly current = signal<AlertRule | null>(null);
  readonly error = signal<UiError | null>(null);
  readonly validation = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly cameraId = signal('');
  readonly siteId = signal('');
  readonly kinds: AlertKind[] = [
    'Congestion',
    'LongStay',
    'WrongWaySpike',
    'CameraNoRecentData',
    'LowFps',
  ];
  kind: AlertKind = 'Congestion';
  name = '';
  zoneId = '';
  severity: 'Warning' | 'Critical' = 'Warning';
  threshold = 80;
  minimumObservedSeconds = 30;
  recoverySeconds = 15;
  windowSeconds = 60;
  cooldownSeconds: number | null = null;
  minimumCoveragePercent: number | null = null;
  allowVideo = false;
  readonly cameras = toSignal(
    toObservable(computed(() => this.siteId() || this.context.selectedSiteId())).pipe(
      switchMap((siteId) =>
        siteId && this.context.auth.administrator()
          ? this.http.all<Camera>('cameras', { siteId }).pipe(
              catchError((error) => {
                this.error.set(apiError(error));
                return of<Camera[]>([]);
              }),
            )
          : of<Camera[]>([]),
      ),
    ),
    { initialValue: [] },
  );
  readonly zones = toSignal(
    toObservable(this.cameraId).pipe(
      switchMap((id) =>
        id && this.context.auth.administrator()
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
  private readonly version = signal(0);
  constructor() {
    toObservable(computed(() => ({ id: this.id(), version: this.version() })))
      .pipe(
        switchMap(({ id }) => {
          this.error.set(null);
          this.current.set(null);
          this.name = '';
          this.cameraId.set('');
          this.zoneId = '';
          this.siteId.set('');
          this.loading.set(!!id);
          return id
            ? this.api.rule(id).pipe(
                catchError((error) => {
                  this.error.set(apiError(error));
                  return of(null);
                }),
              )
            : of(null);
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((r) => {
        this.loading.set(false);
        if (!r) return;
        this.current.set(r);
        this.name = r.name;
        this.kind = r.kind;
        this.siteId.set(r.scope.siteId);
        this.cameraId.set(r.scope.cameraId ?? '');
        this.zoneId = r.scope.zoneId ?? '';
        this.severity = r.severity;
        this.threshold = r.threshold;
        this.minimumObservedSeconds = r.minimumObservedSeconds;
        this.recoverySeconds = r.recoverySeconds;
        this.windowSeconds = r.windowSeconds;
        this.cooldownSeconds = r.cooldownSeconds;
        this.minimumCoveragePercent = r.minimumCoveragePercent;
        this.allowVideo = r.allowVideo;
      });
  }
  zoneScoped(): boolean {
    return ['Congestion', 'LongStay', 'WrongWaySpike'].includes(this.kind);
  }
  errorFields(error: UiError): string[] {
    return Object.values(error.fields).flat();
  }
  reload(): void {
    this.version.update((v) => v + 1);
  }
  save(): void {
    if (
      !this.context.auth.canWrite(this.siteId() || this.context.selectedSiteId()) ||
      this.saving() ||
      this.loading() ||
      this.error()?.conflict ||
      (this.id() && !this.current())
    )
      return;
    const body: AlertRuleWrite = {
      siteId: this.siteId() || this.context.selectedSiteId(),
      cameraId: this.cameraId(),
      zoneId: this.zoneScoped() ? this.zoneId || null : null,
      name: this.name.trim(),
      kind: this.kind,
      severity: this.severity,
      threshold: this.threshold,
      minimumObservedSeconds: this.minimumObservedSeconds,
      recoverySeconds: this.recoverySeconds,
      windowSeconds: this.windowSeconds,
      cooldownSeconds: this.cooldownSeconds,
      minimumCoveragePercent: this.minimumCoveragePercent,
      allowVideo: this.allowVideo,
      ...(this.current() ? { rowVersion: this.current()!.rowVersion } : {}),
    };
    const message = ruleError(body);
    this.validation.set(message ?? '');
    if (message) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .saveRule(this.id(), body)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/alert-rules']);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
