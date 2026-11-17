import { TranslatePipe } from '../core/i18n';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  inject,
  input,
  output,
  viewChild,
  computed,
} from '@angular/core';
import { Icon, IconName } from './icon';

@Component({
  selector: 'app-dialog',
  imports: [TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    #dialog
    aria-labelledby="dialog-title"
    (keydown)="trapFocus($event)"
    (cancel)="cancel($event)"
    (close)="closed.emit()"
  >
    <header class="dialog-header">
      <div class="dialog-header-info">
        @if (resolvedIcon(); as ic) {
          <div class="dialog-icon-badge" aria-hidden="true">
            <app-icon [name]="ic" />
          </div>
        }
        <div class="dialog-header-text">
          <h2 id="dialog-title" class="dialog-title">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="dialog-subtitle">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <button
        class="dialog-close-btn icon-button"
        [attr.aria-label]="'Close dialog' | t"
        [disabled]="busy()"
        (click)="dismiss()"
      >
        <app-icon name="close" />
      </button>
    </header>
    <div class="dialog-body">
      <ng-content />
    </div>
  </dialog>`,
})
export class Dialog {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly icon = input<IconName | undefined>(undefined);
  readonly busy = input(false);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly resolvedIcon = computed<IconName>(() => {
    if (this.icon()) return this.icon()!;
    const t = (this.title() || '').toLowerCase();
    if (t.includes('site') || t.includes('موقع')) return 'building';
    if (t.includes('camera') || t.includes('كاميرا')) return 'camera';
    if (t.includes('zone') || t.includes('منطق')) return 'zones';
    if (t.includes('status') || t.includes('حالة') || t.includes('نظام') || t.includes('system'))
      return 'server';
    if (
      t.includes('workspace') ||
      t.includes('مساحة') ||
      t.includes('navigation') ||
      t.includes('تنقل')
    )
      return 'overview';
    if (
      t.includes('deactivate') ||
      t.includes('تعطيل') ||
      t.includes('warn') ||
      t.includes('حذف') ||
      t.includes('delete')
    )
      return 'warning';
    return 'edit';
  });

  constructor() {
    let element: HTMLDialogElement | undefined;
    let opener: HTMLElement | null = null;
    afterNextRender(() => {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element = this.dialog().nativeElement;
      element.showModal();
      const firstInput = element.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (firstInput) {
        firstInput.focus();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    });
  }

  dismiss(): void {
    if (!this.busy()) this.dialog().nativeElement.close();
  }

  cancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }

  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.dialog().nativeElement;
    const elements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
