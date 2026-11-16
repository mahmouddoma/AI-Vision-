import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';
@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="table-scroll" role="region" [attr.aria-label]="label()" tabindex="0">
    <ng-content />
  </div>`,
})
export class Table {
  readonly label = input.required<string>();
}
@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="pagination" aria-label="Pagination">
    <span>{{ total() }} records · Page {{ page() }} of {{ pages() || 1 }}</span>
    <div class="button-group">
      <button
        class="icon-button"
        aria-label="Previous page"
        [disabled]="busy() || page() <= 1"
        (click)="changed.emit(page() - 1)"
      >
        <app-icon name="left" />
      </button>
      <button
        class="icon-button"
        aria-label="Next page"
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
