import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StateView } from '../ui/feedback';
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="surface">
    <app-state
      icon="search"
      title="Page not found"
      message="This page may have moved, or the address is incomplete."
      ><a routerLink="/" class="button">Back to overview</a></app-state
    >
  </section>`,
})
export class NotFound {}
