import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../core/i18n';
import { Icon } from './icon';
@Component({
  selector: 'app-table',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="table-scroll" role="region" [attr.aria-label]="label() | t" tabindex="0">
    <ng-content />
  </div>`,
})
export class Table {
  readonly label = input.required<string>();
}
@Component({
  selector: 'app-pagination',
  imports: [Icon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="pagination" [attr.aria-label]="'Pagination' | t">
    <span
      >{{ total() }} {{ 'pagination.records' | t }} · {{ 'pagination.page' | t }} {{ page() }}
      {{ 'pagination.of' | t }} {{ pages() || 1 }}</span
    >
    <div class="button-group">
      <button
        class="icon-button"
        [attr.aria-label]="'pagination.prev' | t"
        [title]="'pagination.prev' | t"
        [disabled]="busy() || page() <= 1"
        (click)="changed.emit(page() - 1)"
      >
        <app-icon name="left" />
      </button>
      <button
        class="icon-button"
        [attr.aria-label]="'pagination.next' | t"
        [title]="'pagination.next' | t"
        [disabled]="busy() || page() >= pages()"
        (click)="changed.emit(page() + 1)"
      >
        <app-icon name="right" />
      </button>
    </div>
  </nav>`,
})
export class Pagination {
  readonly total = input(0);
  readonly page = input(1);
  readonly pages = input(1);
  readonly busy = input(false);
  readonly changed = output<number>();
}
