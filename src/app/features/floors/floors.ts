import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { SmartApi } from '../../core/smart-api';
import { UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Floor } from '../../core/smart-models';
import { TranslatePipe } from '../../core/i18n';
import { StateView } from '../../ui/feedback';
import { Table, Pagination } from '../../ui/table';
import { Dialog } from '../../ui/dialog';
import { DestroyRef } from '@angular/core';

@Component({
  selector: 'app-floors',
  imports: [FormsModule, RouterLink, TranslatePipe, StateView, Table, Pagination, Dialog],
  templateUrl: './floors.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Floors {
  private readonly api = inject(SmartApi);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(AppContext);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly siteId = computed(() => this.params().get('siteId') || this.context.selectedSiteId());
  readonly page = signal(1);
  readonly search = signal('');
  readonly version = signal(0);
  readonly editorOpen = signal(false);
  readonly current = signal<Floor | null>(null);
  readonly error = signal<UiError | null>(null);
  readonly saving = signal(false);
  name = '';
  description = '';
  displayOrder = 0;
  readonly result = toSignal(
    toObservable(
      computed(() => ({
        site: this.siteId(),
        page: this.page(),
        search: this.search(),
        version: this.version(),
      })),
    ).pipe(
      switchMap(({ site, page, search }) =>
        site
          ? this.api.floors(site, { page, pageSize: 20, search }).pipe(
              map((data) => ({ data, loading: false, error: null })),
              catchError((error) => of({ data: null, loading: false, error: apiError(error) })),
              startWith({ data: null, loading: true, error: null }),
            )
          : of({ data: null, loading: false, error: null }),
      ),
    ),
    { initialValue: { data: null, loading: true, error: null } },
  );
  edit(floor: Floor | null = null): void {
    this.current.set(floor);
    this.name = floor?.name ?? '';
    this.description = floor?.description ?? '';
    this.displayOrder = floor?.displayOrder ?? 0;
    this.error.set(null);
    this.editorOpen.set(true);
  }
  reload(): void {
    this.version.update((v) => v + 1);
  }
  errorFields(error: UiError): string[] {
    return Object.values(error.fields).flat();
  }
  save(): void {
    if (
      !this.context.auth.canWrite(this.current()?.siteId ?? this.siteId()) ||
      this.saving() ||
      !this.siteId() ||
      !this.name.trim() ||
      !Number.isInteger(this.displayOrder) ||
      this.displayOrder < 0 ||
      this.displayOrder > 10000 ||
      this.error()?.conflict
    )
      return;
    const floor = this.current();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .saveFloor(floor?.siteId ?? this.siteId(), floor?.id ?? null, {
        name: this.name.trim(),
        description: this.description.trim() || null,
        displayOrder: this.displayOrder,
        ...(floor ? { rowVersion: floor.rowVersion } : {}),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.editorOpen.set(false);
          this.reload();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
  reloadCurrent(): void {
    const floor = this.current();
    if (!floor || this.saving()) return;
    this.saving.set(true);
    this.api
      .floor(floor.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (value) => this.edit(value),
        error: (error) => this.error.set(apiError(error)),
      });
  }
  status(floor: Floor): void {
    if (!this.context.auth.canWrite(floor.siteId)) return;
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .floorStatus(floor)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => this.reload(),
        error: (error) => {
          this.error.set(apiError(error));
          this.reload();
        },
      });
  }
}
