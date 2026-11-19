import { LocalizedFormat } from '../../core/localized-format';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AppContext } from '../../core/context';
import { SystemHealthStore } from '../../core/system-health';
import { Icon } from '../../ui/icon';
import { StateView } from '../../ui/feedback';
import { Status } from '../../ui/status';
import { TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-system-status',
  imports: [Icon, StateView, Status, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .sh-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .sh-donut-wrap {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr);
        align-items: center;
        gap: 16px;
      }
      .sh-svg {
        width: 112px;
        height: 112px;
        display: block;
        margin-inline: auto;
      }
      .sh-tot {
        font-size: 20px;
        font-weight: 800;
        fill: var(--ink);
      }
      .sh-sub {
        font-size: 9.5px;
        font-weight: 600;
        fill: var(--muted);
      }
      .sh-leg {
        display: flex;
        flex-direction: column;
        gap: 9px;
        min-width: 0;
      }
      .sh-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      .sh-dot {
        width: 9px;
        height: 9px;
        border-radius: 3px;
        flex-shrink: 0;
      }
      .sh-lbl {
        color: var(--ink);
        font-weight: 600;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sh-track {
        width: 64px;
        height: 6px;
        border-radius: 99px;
        background: #f1f5f9;
        overflow: hidden;
        flex-shrink: 0;
      }
      .sh-fill {
        height: 100%;
        border-radius: 99px;
      }
      .sh-val {
        font-variant-numeric: tabular-nums;
        color: var(--ink);
        min-width: 22px;
        text-align: end;
      }
      .sh-cov {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 10px;
        background: #f8fbfd;
        border: 1px solid var(--line);
      }
      .sh-cov-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        font-weight: 650;
        color: var(--ink);
      }
      .sh-cov-bar {
        height: 8px;
        border-radius: 99px;
        background: #e2e8f0;
        overflow: hidden;
      }
      .sh-cov-fill {
        height: 100%;
        border-radius: 99px;
        background: linear-gradient(90deg, #087f7b, #14b8a6);
      }
      .sh-side {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .sh-meta-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .sh-audit {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 10px 14px;
        border-radius: 10px;
        background: var(--surface);
        border: 1px solid var(--line);
        font-size: 12px;
        color: var(--muted);
      }
      .sh-audit-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--ink);
        font-weight: 600;
      }
      .sh-audit-group app-icon {
        color: var(--accent);
      }
      @media (max-width: 900px) {
        .sh-grid,
        .sh-meta-row {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 520px) {
        .sh-donut-wrap {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `<div class="health-dashboard">
    @if (health.loading() && !health.hasCompletedCheck()) {
      <app-state [loading]="true" />
    } @else {
      @if (health.state().isOutdated) {
        <div class="notice warning" role="alert">
          <app-icon name="warning" />
          <p>{{ 'health.outdatedNotice' | t }}</p>
        </div>
      }

      @if (health.state().reasonKey; as reasonKey) {
        @if (health.state().overallStatus !== 'healthy' || health.state().mqttDisabled) {
          <div
            class="notice"
            [class.warning]="health.state().overallStatus === 'degraded'"
            [class.error]="health.state().overallStatus === 'unhealthy'"
            role="alert"
          >
            <app-icon [name]="health.state().overallStatus === 'healthy' ? 'info' : 'warning'" />
            <p>{{ reasonKey | t }}</p>
          </div>
        }
      }

      @if (health.state().liveDataMessageKey; as liveKey) {
        <div
          class="notice"
          [class.warning]="health.state().liveDataStatus === 'degraded'"
          role="status"
        >
          <app-icon [name]="health.state().liveDataStatus === 'degraded' ? 'warning' : 'info'" />
          <p>{{ liveKey | t }}</p>
        </div>
      }

      <section class="health-card">
        <div class="health-card-header">
          <div class="health-card-title-group">
            <div class="health-card-icon">
              <app-icon name="server" />
            </div>
            <h3>{{ 'system.coreServices' | t }}</h3>
          </div>
        </div>

        <div class="health-kpi-grid">
          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="server" />
                <span>{{ 'system.liveness' | t }}</span>
              </span>
              <app-status [value]="health.liveness()?.status" />
            </div>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="check" />
                <span>{{ 'system.readiness' | t }}</span>
              </span>
              <app-status [value]="health.readiness()?.status" />
            </div>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="database" />
                <span>{{ 'system.dbReadiness' | t }}</span>
              </span>
              <app-status [value]="health.readiness()?.database" />
            </div>
          </div>

          <div class="health-kpi-tile">
            <div class="health-tile-head">
              <span class="health-tile-label">
                <app-icon name="signal" />
                <span>{{ 'system.mqttSub' | t }}</span>
              </span>
              <app-status
                [value]="health.state().mqttDisabled ? 'MqttDisabled' : health.readiness()?.mqtt"
              />
            </div>
          </div>
        </div>
      </section>

      @if (health.monitoring(); as status) {
        <section class="health-card">
          <div class="health-card-header">
            <div class="health-card-title-group">
              <div class="health-card-icon">
                <app-icon name="pulse" />
              </div>
              <h3>{{ 'system.monitoringTitle' | t }}</h3>
            </div>
          </div>

          <div class="sh-grid">
            <div class="sh-donut-wrap">
              <svg
                viewBox="0 0 100 100"
                class="sh-svg"
                role="img"
                [attr.aria-label]="'system.monitoringTitle' | t"
              >
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" stroke-width="12" />
                @for (s of telemetryMix().slices; track s.key) {
                  @if (s.value > 0) {
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      [attr.stroke]="s.color"
                      stroke-width="12"
                      [attr.stroke-dasharray]="s.dasharray"
                      [attr.stroke-dashoffset]="s.dashoffset"
                      transform="rotate(-90 50 50)"
                    />
                  }
                }
                <text x="50" y="49" text-anchor="middle" class="sh-tot">
                  {{ num(status.registeredCameras) }}
                </text>
                <text x="50" y="63" text-anchor="middle" class="sh-sub">
                  {{ 'Cameras' | t }}
                </text>
              </svg>

              <div class="sh-leg">
                @for (s of telemetryMix().slices; track s.key) {
                  <div class="sh-row">
                    <span class="sh-dot" [style.background]="s.color"></span>
                    <span class="sh-lbl">{{ s.label | t }}</span>
                    <div class="sh-track">
                      <div
                        class="sh-fill"
                        [style.width.%]="s.percent"
                        [style.background]="s.color"
                      ></div>
                    </div>
                    <strong class="sh-val">{{ num(s.value) }}</strong>
                  </div>
                }
              </div>
            </div>

            <div class="sh-side">
              <div class="sh-cov">
                <div class="sh-cov-head">
                  <span>{{ 'system.regActiveCameras' | t }}</span>
                  <strong
                    >{{ num(status.activeCameras) }} / {{ num(status.registeredCameras) }} ({{
                      num(activePercent(), 0)
                    }}%)</strong
                  >
                </div>
                <div class="sh-cov-bar" aria-hidden="true">
                  <div class="sh-cov-fill" [style.width.%]="activePercent()"></div>
                </div>
              </div>

              <div class="sh-meta-row">
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
            </div>
          </div>
        </section>
      }

      @if (health.monitoringError()) {
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

      <div class="sh-audit">
        <span class="sh-audit-group">
          <app-icon name="clock" />
          <span>{{ 'health.lastSuccessful' | t }}: {{ date(health.state().lastCheckedAt) }}</span>
        </span>
        <span class="sh-audit-group">
          <app-icon name="refresh" />
          <span>{{ 'health.lastAttempted' | t }}: {{ date(health.state().lastAttemptedAt) }}</span>
        </span>
      </div>
    }

    @if (!isPage()) {
      <div class="dialog-actions">
        <button class="button secondary" [disabled]="health.loading()" (click)="refresh()">
          <app-icon name="refresh" />
          <span>{{ 'action.refresh' | t }}</span>
        </button>
      </div>
    }
  </div>`,
})
export class SystemStatus {
  readonly isPage = input(false);
  readonly context = inject(AppContext);
  readonly health = inject(SystemHealthStore);
  readonly loading = this.health.loading;
  readonly num = inject(LocalizedFormat).number;
  readonly date = inject(LocalizedFormat).timestamp;
  readonly activePercent = computed(() => {
    const s = this.health.monitoring();
    if (!s || !s.registeredCameras) return 0;
    return Math.min(100, (s.activeCameras / s.registeredCameras) * 100);
  });
  readonly telemetryMix = computed(() => {
    const s = this.health.monitoring();
    const raw = [
      { key: 'fresh', label: 'Fresh', value: s?.fresh ?? 0, color: '#10b981' },
      { key: 'stale', label: 'Stale', value: s?.stale ?? 0, color: '#f59e0b' },
      { key: 'noRecent', label: 'No recent data', value: s?.noRecentData ?? 0, color: '#ef4444' },
      { key: 'never', label: 'Never received', value: s?.neverReceived ?? 0, color: '#94a3b8' },
      { key: 'ended', label: 'Ended', value: s?.ended ?? 0, color: '#6366f1' },
    ];
    const total = raw.reduce((sum, item) => sum + item.value, 0);
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

  refresh(): void {
    this.context.refresh();
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
