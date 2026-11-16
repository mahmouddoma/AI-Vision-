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
} from '@angular/core';
import { Icon } from './icon';
@Component({
  selector: 'app-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    #dialog
    aria-labelledby="dialog-title"
    (keydown)="trapFocus($event)"
    (cancel)="cancel($event)"
    (close)="closed.emit()"
  >
    <header class="dialog-header">
      <h2 id="dialog-title">{{ title() }}</h2>
      <button class="icon-button" aria-label="Close dialog" [disabled]="busy()" (click)="dismiss()">
        <app-icon name="close" />
      </button>
    </header>
    <ng-content />
  </dialog>`,
})
export class Dialog {
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  constructor() {
    let element: HTMLDialogElement | undefined;
    let opener: HTMLElement | null = null;
    afterNextRender(() => {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      element = this.dialog().nativeElement;
      element.showModal();
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
