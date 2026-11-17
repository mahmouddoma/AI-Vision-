import { LocalizedFormat } from '../../core/localized-format';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { gsap } from 'gsap';
import { Api, UiError, apiError } from '../../core/api';
import { AppContext } from '../../core/context';
import { Camera, Page, Session } from '../../core/models';
import { TranslatePipe } from '../../core/i18n';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { StateView } from '../../ui/feedback';
import { Pagination, Table } from '../../ui/table';
@Component({
  selector: 'app-sessions',
  imports: [RouterLink, Icon, Status, StateView, Pagination, Table, TranslatePipe],
  templateUrl: './sessions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sessions {
  readonly context = inject(AppContext);
  private readonly api = inject(Api);
  private readonly destroy = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
  readonly source = signal('');
  readonly cameraId = signal('');
  readonly page = signal(1);
  readonly search = signal('');
  readonly draft = signal('');
  readonly cameras = signal<Camera[]>([]);
  readonly loading = signal(true);
  readonly data = signal<Page<Session> | null>(null);
  readonly error = signal<UiError | null>(null);
  private readonly version = signal(0);
  readonly date = inject(LocalizedFormat).timestamp;
  readonly sourceTime = inject(LocalizedFormat).sourceTime;
  readonly num = inject(LocalizedFormat).number;
  private readonly query = computed(() => {
    this.version();
    return {
      siteId: this.context.selectedSiteId(),
      cameraId: this.cameraId(),
      sourceType: this.source(),
      page: this.page(),
      pageSize: 20,
      search: this.search(),
    };
  });
  constructor() {
    afterNextRender(() => {
      this.animateEntrance();
    });
    toObservable(this.context.selectedSiteId)
      .pipe(
        switchMap((siteId) =>
          this.api.all<Camera>('cameras', { siteId }).pipe(catchError(() => of([]))),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((items) => {
        this.cameras.set(items);
        if (!items.some((item) => item.id === this.cameraId())) this.cameraId.set('');
      });
    toObservable(this.query)
      .pipe(
        switchMap((query) => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.get<Page<Session>>('analytics/sessions', query).pipe(
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
    let site = this.context.selectedSiteId();
    effect(() => {
      const selected = this.context.selectedSiteId();
      if (site !== selected) {
        site = selected;
        this.cameraId.set('');
        this.page.set(1);
      }
    });
  }
  apply(): void {
    this.page.set(1);
    this.search.set(this.draft().trim());
    this.reload();
  }
  reload(): void {
    this.version.update((value) => value + 1);
  }

  private animateEntrance(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.elementRef.nativeElement as HTMLElement;
    const ctx = gsap.context(() => {
      gsap.from('.page-heading', {
        opacity: 0,
        y: -10,
        duration: 0.45,
        ease: 'power2.out',
      });
      gsap.from('.surface', {
        opacity: 0,
        y: 12,
        duration: 0.45,
        ease: 'power2.out',
        delay: 0.1,
      });
    }, host);

    this.destroy.onDestroy(() => ctx.revert());
  }
}
