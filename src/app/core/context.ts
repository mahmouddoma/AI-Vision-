import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, exhaustMap, map, merge, of } from 'rxjs';
import { Api, UiError, apiError } from './api';
import { Site } from './models';
import { Auth } from './auth';
import { SystemHealthStore } from './system-health';

@Injectable({ providedIn: 'root' })
export class AppContext {
  readonly auth = inject(Auth);
  readonly api = inject(Api);
  readonly health = inject(SystemHealthStore);
  private readonly destroy = inject(DestroyRef);
  readonly sites = signal<Site[]>([]);
  readonly sitesLoading = signal(true);
  readonly sitesError = signal<UiError | null>(null);
  readonly selectedSiteId = signal('');
  readonly siteOptions = computed(() =>
    this.auth.administrator()
      ? this.sites().map((site) => ({ id: site.id, name: site.name, isActive: site.isActive }))
      : this.auth.siteIds().map((id) => ({ id, name: id, isActive: true })),
  );
  readonly site = computed(
    () => this.sites().find((site) => site.id === this.selectedSiteId()) ?? null,
  );
  readonly monitoring = this.health.monitoring;
  readonly monitoringError = this.health.monitoringError;
  readonly monitoringLoading = this.health.loading;
  private readonly reloadSites = new Subject<void>();
  constructor() {
    merge(of(undefined), this.reloadSites)
      .pipe(
        exhaustMap(() => {
          if (!this.sites().length) this.sitesLoading.set(true);
          this.sitesError.set(null);
          if (!this.auth.administrator()) {
            this.selectedSiteId.set(this.auth.siteIds()[0] ?? '');
            return of({ items: [] as Site[], error: null });
          }
          return this.api.all<Site>('sites').pipe(
            map((items) => ({ items, error: null })),
            catchError((error) => of({ items: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.sitesLoading.set(false);
        this.sitesError.set(result.error);
        if (result.items) {
          this.sites.set(result.items);
          if (
            this.auth.administrator() &&
            !result.items.some((site) => site.id === this.selectedSiteId())
          )
            this.selectedSiteId.set(result.items[0]?.id ?? '');
        }
      });
  }
  refreshSites(): void {
    this.reloadSites.next();
  }
  refresh(): void {
    this.health.refresh();
    this.reloadSites.next();
  }
}
