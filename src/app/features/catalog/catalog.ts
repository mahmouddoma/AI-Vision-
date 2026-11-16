import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Camera, CameraWrite, Page, Site, SiteWrite, Zone, ZoneWrite } from '../../core/models';
import { number, timestamp } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { StateView } from '../../ui/feedback';
import { Dialog } from '../../ui/dialog';
import { Table, Pagination } from '../../ui/table';

type Kind = 'sites' | 'cameras' | 'zones';
type Row = Site | Camera | Zone;
export const requiredText = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
export const topicSegment = (control: AbstractControl): ValidationErrors | null =>
  !control.value || /^[^/+#\s]+$/.test(control.value) ? null : { topic: true };

@Component({
  selector: 'app-catalog',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Icon,
    Status,
    StateView,
    Dialog,
    Table,
    Pagination,
    KeyValuePipe,
  ],
  templateUrl: './catalog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(AppContext);
  readonly kind = this.route.snapshot.data['kind'] as Kind;
  readonly title =
    this.kind === 'sites' ? 'Sites' : this.kind === 'cameras' ? 'Cameras & zones' : 'Zones';
  readonly singular = this.kind === 'sites' ? 'site' : this.kind === 'cameras' ? 'camera' : 'zone';
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly cameraId = computed(() => this.params().get('cameraId') ?? '');
  readonly cameraInfo = signal<Camera | null>(null);
  readonly page = signal(1);
  readonly search = signal('');
  readonly draftSearch = signal('');
  private readonly version = signal(0);
  readonly data = signal<Page<Row> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<UiError | null>(null);
  readonly success = signal('');
  readonly dialogMode = signal<'editor' | 'status' | null>(null);
  readonly current = signal<Row | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<UiError | null>(null);
  readonly num = number;
  readonly date = timestamp;
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(200)],
    }),
    description: new FormControl('', { nonNullable: true }),
    code: new FormControl('', { nonNullable: true }),
    timeZoneId: new FormControl('Africa/Cairo', { nonNullable: true }),
    siteId: new FormControl('', { nonNullable: true }),
    externalCameraId: new FormControl('', { nonNullable: true }),
    externalZoneId: new FormControl('', { nonNullable: true }),
    capacity: new FormControl<number | null>(null),
    warningThresholdPercent: new FormControl(80, { nonNullable: true }),
    criticalThresholdPercent: new FormControl(100, { nonNullable: true }),
  });
  private readonly request = computed(() => {
    this.version();
    return {
      path: this.kind === 'zones' ? `cameras/${this.cameraId()}/zones` : this.kind,
      query: {
        page: this.page(),
        pageSize: 20,
        search: this.search(),
        siteId: this.kind === 'cameras' ? this.context.selectedSiteId() : undefined,
      },
    };
  });
  constructor() {
    const c = this.form.controls;
    if (this.kind === 'sites') {
      c.code.setValidators(requiredText);
      c.timeZoneId.setValidators(requiredText);
    }
    if (this.kind === 'cameras') {
      c.siteId.setValidators(Validators.required);
      c.externalCameraId.setValidators([requiredText, topicSegment]);
    }
    if (this.kind === 'zones') {
      c.externalZoneId.setValidators([requiredText, topicSegment]);
      c.capacity.setValidators([Validators.min(1), Validators.pattern(/^\d+$/)]);
      c.warningThresholdPercent.setValidators([Validators.required, Validators.min(0)]);
      c.criticalThresholdPercent.setValidators([Validators.required, Validators.min(0)]);
      this.form.addValidators((control) =>
        control.get('warningThresholdPercent')!.value <
        control.get('criticalThresholdPercent')!.value
          ? null
          : { thresholds: true },
      );
      toObservable(this.cameraId)
        .pipe(
          switchMap((id) => this.api.get<Camera>(`cameras/${id}`).pipe(catchError(() => of(null)))),
          takeUntilDestroyed(this.destroy),
        )
        .subscribe((camera) => this.cameraInfo.set(camera));
    }
    toObservable(this.request)
      .pipe(
        switchMap((request) => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.get<Page<Row>>(request.path, request.query).pipe(
            map((data) => ({ data, error: null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.data.set(result.data);
        this.error.set(result.error);
      });
    let lastSite = this.context.selectedSiteId();
    effect(() => {
      const site = this.context.selectedSiteId();
      if (site !== lastSite && this.kind === 'cameras') {
        lastSite = site;
        this.page.set(1);
      }
    });
  }
  reload(): void {
    this.version.update((value) => value + 1);
  }
  find(): void {
    this.search.set(this.draftSearch().trim());
    this.page.set(1);
    this.reload();
  }
  camera(row: Row): Camera {
    return row as Camera;
  }
  site(row: Row): Site {
    return row as Site;
  }
  zone(row: Row): Zone {
    return row as Zone;
  }
  invalid(name: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[name];
    return field.invalid && field.touched;
  }
  editor(row: Row | null = null): void {
    this.current.set(row);
    this.formError.set(null);
    this.form.reset({
      name: '',
      description: '',
      code: '',
      timeZoneId: 'Africa/Cairo',
      siteId: this.context.selectedSiteId(),
      externalCameraId: '',
      externalZoneId: '',
      capacity: null,
      warningThresholdPercent: 80,
      criticalThresholdPercent: 100,
    });
    if (row) this.form.patchValue({ ...row, description: row.description ?? '' });
    this.dialogMode.set('editor');
  }
  reloadRecord(): void {
    const row = this.current();
    if (!row || this.saving()) return;
    this.saving.set(true);
    this.api
      .get<Row>(`${this.kind}/${row.id}`)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (item) => {
          this.current.set(item);
          this.form.patchValue({ ...item, description: item.description ?? '' });
          this.formError.set(null);
          this.reload();
        },
        error: (error) => this.formError.set(apiError(error)),
      });
  }
  confirmStatus(row: Row): void {
    this.current.set(row);
    this.formError.set(null);
    this.dialogMode.set('status');
  }
  close(): void {
    if (!this.saving()) this.dialogMode.set(null);
  }
  save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const current = this.current();
    const base = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      ...(current ? { rowVersion: current.rowVersion } : {}),
    };
    let body: SiteWrite | CameraWrite | ZoneWrite;
    if (this.kind === 'sites')
      body = { ...base, code: value.code.trim(), timeZoneId: value.timeZoneId.trim() };
    else if (this.kind === 'cameras')
      body = { ...base, siteId: value.siteId, externalCameraId: value.externalCameraId.trim() };
    else
      body = {
        ...base,
        externalZoneId: value.externalZoneId.trim(),
        capacity: value.capacity,
        warningThresholdPercent: value.warningThresholdPercent,
        criticalThresholdPercent: value.criticalThresholdPercent,
      };
    this.saving.set(true);
    this.formError.set(null);
    const request = current
      ? this.api.put<Row>(`${this.kind}/${current.id}`, body)
      : this.api.post<Row>(this.request().path, body);
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.dialogMode.set(null);
          this.success.set(
            `${this.singular[0].toUpperCase() + this.singular.slice(1)} ${current ? 'updated' : 'created'} successfully.`,
          );
          this.reload();
          this.context.refreshSites();
        },
        error: (error) => this.formError.set(apiError(error)),
      });
  }
  changeStatus(): void {
    const row = this.current();
    if (!row || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.api
      .status(`${this.kind}/${row.id}`, !row.isActive, row.rowVersion)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.dialogMode.set(null);
          this.success.set(`${row.name} ${row.isActive ? 'deactivated' : 'activated'}.`);
          this.reload();
          this.context.refreshSites();
        },
        error: (error) => this.formError.set(apiError(error)),
      });
  }
}
