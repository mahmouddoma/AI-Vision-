import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../core/i18n';
import { Icon, IconName } from './icon';

@Component({
  selector: 'app-drawer',
  imports: [TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="app-drawer-dialog"
      [class]="'app-drawer-dialog drawer-tone-' + tone()"
      [attr.aria-labelledby]="'drawer-title-' + id()"
      (click)="onBackdropClick($event)"
      (keydown)="onKeydown($event)"
      (cancel)="cancel($event)"
      (close)="onNativeClose()"
    >
      <div class="drawer-inner">
        <div class="drawer-sheet-handle" aria-hidden="true"></div>
        <header class="drawer-header">
          <div class="drawer-header-info">
            @if (resolvedIcon(); as ic) {
              <div class="drawer-icon-badge" aria-hidden="true">
                <app-icon [name]="ic" />
              </div>
            }
            <div class="drawer-header-text">
              <h2 [id]="'drawer-title-' + id()" class="drawer-title">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="drawer-subtitle">{{ subtitle() }}</p>
              }
            </div>
          </div>
          <button
            type="button"
            class="dialog-close-btn icon-button"
            [attr.aria-label]="'action.close' | t"
            (click)="close()"
          >
            <app-icon name="close" />
          </button>
        </header>

        <div class="drawer-body">
          <ng-content />
        </div>

        @if (hasFooter()) {
          <footer class="drawer-footer">
            <ng-content select="[drawer-footer]" />
          </footer>
        }
      </div>
    </dialog>
  `,
})
export class Drawer {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly icon = input<IconName | undefined>(undefined);
  readonly tone = input<'accent' | 'warning' | 'danger' | 'info'>('accent');
  readonly open = input<boolean>(false);
  readonly hasFooter = input<boolean>(false);
  readonly closed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  readonly id = computed(() => Math.random().toString(36).slice(2, 8));

  readonly resolvedIcon = computed<IconName>(() => {
    if (this.icon()) return this.icon()!;
    const t = (this.title() || '').toLowerCase();
    if (t.includes('camera') || t.includes('كاميرا')) return 'camera';
    if (t.includes('zone') || t.includes('منطق')) return 'zones';
    if (t.includes('insight') || t.includes('استنتاج')) return 'overview';
    if (t.includes('quality') || t.includes('جودة')) return 'signal';
    if (t.includes('congestion') || t.includes('ازدحام') || t.includes('warning')) return 'warning';
    return 'overview';
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const el = this.dialog()?.nativeElement;
      if (!el) return;

      if (isOpen && !el.open) {
        el.showModal();
      } else if (!isOpen && el.open) {
        el.close();
      }
    });
  }

  cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  onNativeClose(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  close(): void {
    const el = this.dialog()?.nativeElement;
    if (el?.open) {
      el.close();
    }
    this.closed.emit();
  }
}
