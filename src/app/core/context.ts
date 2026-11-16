import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, exhaustMap, map, merge, of, timer } from 'rxjs';
import { Api, UiError, apiError } from './api';
import { MonitoringStatus, Site } from './models';

@Injectable({ providedIn: 'root' })
export class AppContext {
  readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  readonly sites = signal<Site[]>([]);
  readonly sitesLoading = signal(true);
  readonly sitesError = signal<UiError | null>(null);
  readonly selectedSiteId = signal('');
  readonly site = computed(
    () => this.sites().find((site) => site.id === this.selectedSiteId()) ?? null,
  );
  readonly monitoring = signal<MonitoringStatus | null>(null);
  readonly monitoringError = signal<UiError | null>(null);
  readonly monitoringLoading = signal(true);
  private readonly reloadStatus = new Subject<void>();
  private readonly reloadSites = new Subject<void>();
  constructor() {
    merge(of(undefined), this.reloadSites)
      .pipe(
        exhaustMap(() => {
          this.sitesLoading.set(true);
          this.sitesError.set(null);
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
          if (!result.items.some((site) => site.id === this.selectedSiteId()))
            this.selectedSiteId.set(result.items[0]?.id ?? '');
        }
      });
    merge(timer(0, this.api.config.refreshIntervalSeconds * 1000), this.reloadStatus)
      .pipe(
        exhaustMap(() =>
          this.api.get<MonitoringStatus>('monitoring/status').pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.monitoringLoading.set(false);
        this.monitoringError.set(result.error);
        if (result.data) this.monitoring.set(result.data);
      });
  }
  refreshSites(): void {
    this.reloadSites.next();
  }
  refresh(): void {
    this.reloadStatus.next();
    this.reloadSites.next();
  }
}
