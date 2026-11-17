import { TranslatePipe } from '../core/i18n';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StateView } from '../ui/feedback';
@Component({
  selector: 'app-not-found',
  imports: [TranslatePipe, RouterLink, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="surface">
    <app-state
      icon="search"
      [title]="'Page not found' | t"
      [message]="'This page may have moved, or the address is incomplete.' | t"
      ><a routerLink="/" class="button">{{ 'Back to overview' | t }}</a></app-state
    >
  </section>`,
})
export class NotFound {}
