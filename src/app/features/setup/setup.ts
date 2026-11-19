import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Api, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Camera } from '../../core/models';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'app-setup',
  imports: [RouterLink, TranslatePipe, StateView, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-heading">
      <div class="page-title-group">
        <div class="page-title-badge">
          <app-icon name="filters" />
        </div>
        <div>
          <h1>{{ 'Setup' | t }}</h1>
          <p>
            {{ 'Create the registry, configure capacity, then verify incoming observations.' | t }}
          </p>
        </div>
      </div>
      <button
        class="header-refresh-btn"
        type="button"
        [disabled]="result().loading"
        (click)="reload()"
        [attr.aria-label]="'action.refresh' | t"
      >
        <app-icon name="refresh" />
        <span>{{ 'action.refresh' | t }}</span>
      </button>
    </header>

    <div class="setup-container">
      <!-- Step 1: Site Registry -->
      <section class="setup-card">
        <div class="setup-card-header">
          <div class="setup-step-group">
            <div class="setup-step-pill">1</div>
            <div class="setup-step-title">
              <h2>{{ 'Site' | t }}</h2>
              <p>{{ 'setup.siteDetails' | t }}</p>
            </div>
          </div>
          <a class="header-refresh-btn" routerLink="/sites">
            <app-icon name="building" />
            <span>{{ 'Manage sites' | t }}</span>
          </a>
        </div>

        <div class="setup-site-preview">
          <div class="setup-site-info">
            <div class="setup-site-icon">
              <app-icon name="building" />
            </div>
            <div>
              <h3 class="setup-site-name">
                {{ context.site()?.name || ('Select or create a site' | t) }}
              </h3>
              <div class="setup-meta-chips">
                @if (context.site()?.timeZoneId) {
                  <span class="setup-chip">
                    <app-icon name="location" />
                    <span>{{ context.site()?.timeZoneId }}</span>
                  </span>
                }
                @if (context.site()?.code) {
                  <span class="setup-chip">
                    <code>{{ context.site()?.code }}</code>
                  </span>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Step 2 & 3: Cameras & Capacity -->
      <section class="setup-card">
        <div class="setup-card-header">
          <div class="setup-step-group">
            <div class="setup-step-pill">2</div>
            <div class="setup-step-title">
              <h2>{{ 'Cameras' | t }}</h2>
              <p>{{ 'overview.registerCamerasDesc' | t }}</p>
            </div>
          </div>
          <a class="header-action-btn button" routerLink="/cameras">
            <app-icon name="plus" />
            <span>{{ 'Register camera' | t }}</span>
          </a>
        </div>

        @if (result().loading || result().error) {
          <app-state [loading]="result().loading" [error]="result().error" (retry)="reload()" />
        } @else if (result().items.length === 0) {
          <div class="table-empty">
            <app-icon name="camera" />
            <p>{{ 'setup.noCameras' | t }}</p>
          </div>
        } @else {
          <div class="setup-camera-grid">
            @for (camera of result().items; track camera.id) {
              <article class="setup-camera-card">
                <div class="setup-camera-head">
                  <div class="setup-camera-title-group">
                    <div class="setup-camera-icon">
                      <app-icon name="camera" />
                    </div>
                    <h3 class="setup-camera-name" [title]="camera.name">{{ camera.name }}</h3>
                  </div>
                  <span class="setup-chip">
                    <app-icon name="zones" />
                    <span>{{ camera.zonesCount }} {{ 'Zones' | t }}</span>
                  </span>
                </div>

                <div class="setup-camera-mqtt">
                  <app-icon name="signal" />
                  <span>MQTT:</span>
                  <code>{{ camera.mqttTopic }}</code>
                </div>

                <a class="setup-zones-btn" [routerLink]="['/cameras', camera.id, 'zones']">
                  <span>3 · {{ 'Register zones and configure capacity' | t }}</span>
                  <app-icon name="arrow" />
                </a>
              </article>
            }
          </div>
        }
      </section>

      <!-- Step 4: Verification -->
      <section class="setup-card">
        <div class="setup-card-header">
          <div class="setup-step-group">
            <div class="setup-step-pill">4</div>
            <div class="setup-step-title">
              <h2>{{ 'Verify observations' | t }}</h2>
              <p>
                {{
                  'Publish supported metadata to the camera topic using your configured publisher, then check MQTT freshness and live measurements.'
                    | t
                }}
              </p>
            </div>
          </div>
        </div>

        <div class="verify-cards-grid">
          <a class="verify-action-card" routerLink="/system-health">
            <div class="verify-action-info">
              <div class="verify-action-icon teal">
                <app-icon name="pulse" />
              </div>
              <div>
                <h4 class="verify-action-title">{{ 'System health' | t }}</h4>
                <p class="verify-action-desc">{{ 'setup.checkHealthDesc' | t }}</p>
              </div>
            </div>
            <span class="verify-arrow">&rarr;</span>
          </a>

          <a class="verify-action-card" routerLink="/live">
            <div class="verify-action-info">
              <div class="verify-action-icon green">
                <app-icon name="live" />
              </div>
              <div>
                <h4 class="verify-action-title">{{ 'Live monitoring' | t }}</h4>
                <p class="verify-action-desc">{{ 'setup.checkLiveDesc' | t }}</p>
              </div>
            </div>
            <span class="verify-arrow">&rarr;</span>
          </a>

          <a class="verify-action-card" routerLink="/floors">
            <div class="verify-action-info">
              <div class="verify-action-icon blue">
                <app-icon name="zones" />
              </div>
              <div>
                <h4 class="verify-action-title">{{ 'Floors' | t }}</h4>
                <p class="verify-action-desc">{{ 'setup.checkFloorsDesc' | t }}</p>
              </div>
            </div>
            <span class="verify-arrow">&rarr;</span>
          </a>
        </div>
      </section>
    </div>`,
})
export class Setup {
  readonly context = inject(AppContext);
  private readonly api = inject(Api);
  readonly version = signal(0);
  reload(): void {
    this.context.refresh();
    this.version.update((v) => v + 1);
  }
  readonly result = toSignal(
    toObservable(
      computed(() => {
        this.version();
        return this.context.selectedSiteId();
      }),
    ).pipe(
      switchMap((siteId) =>
        siteId
          ? this.api.all<Camera>('cameras', { siteId }).pipe(
              map((items) => ({ items, loading: false, error: null })),
              catchError((error) => of({ items: [], loading: false, error: apiError(error) })),
              startWith({ items: [], loading: true, error: null }),
            )
          : of({ items: [], loading: false, error: null }),
      ),
    ),
    { initialValue: { items: [], loading: true, error: null } },
  );
}
