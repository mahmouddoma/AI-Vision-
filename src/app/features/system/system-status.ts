import { LocalizedFormat } from '../../core/localized-format';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
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
  template: `<div class="stack">
    @if (loading()) {
      <app-state [loading]="true" />
    } @else {
      <dl class="detail-list">
        <div>
          <dt>{{ 'system.liveness' | t }}</dt>
          <dd><app-status [value]="liveness()?.status" /></dd>
        </div>
        <div>
          <dt>{{ 'system.readiness' | t }}</dt>
          <dd><app-status [value]="readiness()?.status" /></dd>
        </div>
        <div>
          <dt>{{ 'system.dbReadiness' | t }}</dt>
          <dd><app-status [value]="readiness()?.database" /></dd>
        </div>
        <div>
          <dt>{{ 'system.mqttSub' | t }}</dt>
          <dd><app-status [value]="readiness()?.mqtt" /></dd>
        </div>
      </dl>
      @if (trouble()) {
        <div class="notice warning" role="alert">
          <app-icon name="warning" />
          <p>{{ troubleMessage() }}</p>
        </div>
      }
      @if (context.monitoring(); as status) {
        <dl class="detail-list">
          <div>
            <dt>{{ 'system.regActiveCameras' | t }}</dt>
            <dd>{{ num(status.registeredCameras) }} / {{ num(status.activeCameras) }}</dd>
          </div>
          <div>
            <dt>{{ 'system.freshStale' | t }}</dt>
            <dd>{{ num(status.fresh) }} / {{ num(status.stale) }}</dd>
          </div>
          <div>
            <dt>{{ 'system.noDataNever' | t }}</dt>
            <dd>{{ num(status.noRecentData) }} / {{ num(status.neverReceived) }}</dd>
          </div>
          <div>
            <dt>{{ 'system.endedSessions' | t }}</dt>
            <dd>{{ num(status.ended) }}</dd>
          </div>
          <div>
            <dt>{{ 'MQTT enabled / subscribed' | t }}</dt>
            <dd>
              {{ status.mqttEnabled ? ('Enabled' | t) : ('Disabled' | t) }} /
              {{ status.mqttSubscribed ? ('Subscribed' | t) : ('Not subscribed' | t) }}
            </dd>
          </div>
          <div>
            <dt>{{ 'Monitoring checked at' | t }}</dt>
            <dd>{{ date(status.checkedAtUtc) }}</dd>
          </div>
        </dl>
      }
      @if (context.monitoringError()) {
        <p class="notice warning">
          {{
            'Monitoring status is unavailable. Any displayed counts are from the last successful check.'
              | t
          }}
        </p>
      }
      <p class="field-help">
        {{ 'Checked' | t }} {{ date(checkedAt())
        }}{{
          '. Healthy liveness does not guarantee database readiness. A degraded MQTT subscription can delay new readings.'
            | t
        }}
      </p>
    }
    <div class="dialog-actions">
      <button class="button secondary" [disabled]="loading()" (click)="refresh()">
        <app-icon name="refresh" />{{ 'action.refresh' | t }}
      </button>
    </div>
  </div>`,
})
export class SystemStatus {
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
