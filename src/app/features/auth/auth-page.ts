import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-auth',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-heading">
      <h1>{{ 'Account access' | t }}</h1>
    </header>
    <section class="surface stack">
      @if (auth.error()) {
        <p class="notice error" role="alert">{{ auth.error() | t }}</p>
      }
      @if (!auth.enabled) {
        <p>{{ 'External authentication is not configured for this environment.' | t }}</p>
      } @else if (!auth.authenticated()) {
        <p>{{ 'Sign in with your configured organization identity provider.' | t }}</p>
        <button class="button" (click)="auth.signIn()">{{ 'Sign in' | t }}</button>
      } @else {
        <p>{{ 'Signed in. Available actions depend on your backend role and site claims.' | t }}</p>
        <div class="link-row">
          <a routerLink="/alerts">{{ 'Alerts' | t }}</a
          ><a routerLink="/analytics/flow">{{ 'Flow rate' | t }}</a
          ><a routerLink="/">{{ 'Overview' | t }}</a>
        </div>
        <button class="button secondary" (click)="auth.signOut()">{{ 'Sign out' | t }}</button>
      }
    </section>`,
})
export class AuthPage {
  readonly auth = inject(Auth);
}
