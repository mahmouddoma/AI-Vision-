import { LocalizedFormat } from '../../core/localized-format';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Icon } from '../../ui/icon';
import { StateView } from '../../ui/feedback';
import { Status } from '../../ui/status';
import { I18nService, TranslatePipe } from '../../core/i18n';

interface Health {
  status: string;
  database?: string;
  mqtt?: string;
}

@Component({
  selector: 'app-system-status',
  imports: [Icon, StateView, Status, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="health-dashboard">
    @if (loading()) {
      <app-state [loading]="true" />
    } @else {
      @if (trouble()) {
        <div class="notice warning" role="alert">
          <app-icon name="warning" />
          <p>{{ troubleMessage() }}</p>
        </div>
      }

      <section class="health-card">
        <div class="health-card-header">
          <div class="health-card-title-group">
            <div class="health-card-icon">
              <app-icon name="server" />
            </div>
            <div>
              <h3>{{ 'system.coreServices' | t }}</h3>
              <p>{{ 'system.coreServicesDesc' | t }}</p>
            </div>
          </div>
        </div>

        <div class="health-kpi-grid">
          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="server" />
                <span>{{ 'system.liveness' | t }}</span>
              </span>
              <app-status [value]="liveness()?.status" />
            </div>
            <p class="health-tile-help">{{ 'system.livenessHelp' | t }}</p>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="check" />
                <span>{{ 'system.readiness' | t }}</span>
              </span>
              <app-status [value]="readiness()?.status" />
            </div>
            <p class="health-tile-help">{{ 'system.readinessHelp' | t }}</p>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="database" />
                <span>{{ 'system.dbReadiness' | t }}</span>
              </span>
              <app-status [value]="readiness()?.database" />
            </div>
            <p class="health-tile-help">{{ 'system.dbHelp' | t }}</p>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="signal" />
                <span>{{ 'system.mqttSub' | t }}</span>
              </span>
              <app-status [value]="readiness()?.mqtt" />
            </div>
            <p class="health-tile-help">{{ 'system.mqttHelp' | t }}</p>
          </div>
        </div>
      </section>

      @if (context.monitoring(); as status) {
        <section class="health-card">
          <div class="health-card-header">
            <div class="health-card-title-group">
              <div class="health-card-icon">
                <app-icon name="pulse" />
              </div>
              <div>
                <h3>{{ 'system.monitoringTitle' | t }}</h3>
                <p>{{ 'system.monitoringSubtitle' | t }}</p>
              </div>
            </div>
          </div>

          <div class="telemetry-grid">
            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="camera" />
                <span>{{ 'system.regActiveCameras' | t }}</span>
              </span>
              <div class="telemetry-val-row">
                <span class="health-num">{{ num(status.registeredCameras) }}</span>
                <span class="health-sep">/</span>
                <span class="health-num text-accent">{{ num(status.activeCameras) }}</span>
              </div>
            </div>

            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="clock" />
                <span>{{ 'system.freshStale' | t }}</span>
              </span>
              <div class="telemetry-val-row">
                <span class="health-num text-success">{{ num(status.fresh) }}</span>
                <span class="health-sep">/</span>
                <span class="health-num text-muted">{{ num(status.stale) }}</span>
              </div>
            </div>

            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="warning" />
                <span>{{ 'system.noDataNever' | t }}</span>
              </span>
              <div class="telemetry-val-row">
                <span class="health-num text-danger">{{ num(status.noRecentData) }}</span>
                <span class="health-sep">/</span>
                <span class="health-num text-muted">{{ num(status.neverReceived) }}</span>
              </div>
            </div>

            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="film" />
                <span>{{ 'system.endedSessions' | t }}</span>
              </span>
              <div class="telemetry-val-row">
                <span class="health-num">{{ num(status.ended) }}</span>
              </div>
            </div>

            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="signal" />
                <span>{{ 'MQTT enabled / subscribed' | t }}</span>
              </span>
              <div class="telemetry-badge-row">
                <span
                  class="status-chip"
                  [class.success]="status.mqttEnabled"
                  [class.muted]="!status.mqttEnabled"
                >
                  {{ status.mqttEnabled ? ('Enabled' | t) : ('Disabled' | t) }}
                </span>
                <span
                  class="status-chip"
                  [class.success]="status.mqttSubscribed"
                  [class.muted]="!status.mqttSubscribed"
                >
                  {{ status.mqttSubscribed ? ('Subscribed' | t) : ('Not subscribed' | t) }}
                </span>
              </div>
            </div>

            <div class="telemetry-tile">
              <span class="health-tile-label">
                <app-icon name="calendar" />
                <span>{{ 'Monitoring checked at' | t }}</span>
              </span>
              <span class="health-date">{{ date(status.checkedAtUtc) }}</span>
            </div>
          </div>
        </section>
      }

      @if (context.monitoringError()) {
        <div class="notice warning" role="alert">
          <app-icon name="warning" />
          <p>
            {{
              'Monitoring status is unavailable. Any displayed counts are from the last successful check.'
                | t
            }}
          </p>
        </div>
      }

      <div class="report-meta-strip">
        <div class="report-meta-item">
          <app-icon name="info" />
          <span class="report-meta-title">{{ 'system.auditTitle' | t }}</span>
        </div>
        <span class="report-meta-divider">|</span>
        <div class="report-meta-item">
          <app-icon name="clock" />
          <span>{{ 'Checked' | t }} {{ date(checkedAt()) }}</span>
        </div>
        <span class="report-meta-divider">|</span>
        <span class="report-note">
          {{
            '. Healthy liveness does not guarantee database readiness. A degraded MQTT subscription can delay new readings.'
              | t
          }}
        </span>
      </div>
    }

    @if (!isPage()) {
      <div class="dialog-actions">
        <button class="button secondary" [disabled]="loading()" (click)="refresh()">
          <app-icon name="refresh" />
          <span>{{ 'action.refresh' | t }}</span>
        </button>
      </div>
    }
  </div>`,
})
export class SystemStatus {
  readonly isPage = input(false);
  private readonly i18n = inject(I18nService);
  readonly troubleMessage = () => {
    const trouble = this.trouble();
    return typeof trouble === 'string'
      ? this.i18n.t(trouble)
      : trouble
        ? this.i18n.errorMessage(trouble)
        : '';
  };
  readonly context = inject(AppContext);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(true);
  readonly trouble = signal<UiError | string>('');
  readonly liveness = signal<Health | null>(null);
  readonly readiness = signal<Health | null>(null);
  readonly checkedAt = signal<string | null>(null);
  readonly num = inject(LocalizedFormat).number;
  readonly date = inject(LocalizedFormat).timestamp;
  private readonly reload = new Subject<void>();
  constructor() {
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.trouble.set('');
          const health = (path: string) =>
            this.api.get<Health>(path).pipe(
              map((data) => ({ data, error: '' })),
              catchError((error) =>
                of({
                  data:
                    error instanceof HttpErrorResponse && error.status === 503
                      ? (error.error as Health)
                      : null,
                  error: apiError(error),
                }),
              ),
            );
          return forkJoin({ live: health('health/live'), ready: health('health/ready') });
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.liveness.set(result.live.data);
        this.readiness.set(result.ready.data);
        this.trouble.set(
          result.live.error ||
            result.ready.error ||
            (result.ready.data?.status === 'Degraded'
              ? 'Backend is running, but MQTT is disconnected. Check the subscriber service.'
              : ''),
        );
        this.checkedAt.set(new Date().toISOString());
      });
  }
  refresh(): void {
    this.context.refresh();
    this.reload.next();
  }
}

@Component({
  selector: 'app-system-health',
  imports: [Icon, SystemStatus, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-heading">
      <div class="page-title-group">
        <div class="page-title-badge">
          <app-icon name="pulse" />
        </div>
        <div>
          <h1>{{ 'System health' | t }}</h1>
          <p>{{ 'system.subtitle' | t }}</p>
        </div>
      </div>
      <button
        class="header-refresh-btn"
        type="button"
        [disabled]="statusComp.loading()"
        (click)="statusComp.refresh()"
        [attr.aria-label]="'action.refresh' | t"
      >
        <app-icon name="refresh" />
        <span>{{ 'action.refresh' | t }}</span>
      </button>
    </header>
    <app-system-status #statusComp [isPage]="true" />`,
})
export class SystemHealth {}
