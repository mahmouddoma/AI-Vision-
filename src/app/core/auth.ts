import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import type { User, UserManager } from 'oidc-client-ts';
import { RUNTIME_CONFIG } from './runtime-config';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly config = inject(RUNTIME_CONFIG);
  readonly enabled = !!this.config.auth;
  readonly user = signal<User | null>(null);
  readonly error = signal('');
  private manager?: UserManager;
  private initialized?: Promise<void>;
  readonly authenticated = computed(() => !!this.user() && !this.user()!.expired);
  readonly claims = computed<Record<string, unknown>>(() => {
    const token = this.user()?.access_token;
    if (!token) return {};
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return {};
    }
  });
  readonly roles = computed(() => this.claimList('role'));
  readonly siteIds = computed(() => this.claimList('site_id'));
  readonly administrator = computed(
    () =>
      !this.enabled || (this.authenticated() && this.roles().includes('AnalyticsAdministrator')),
  );
  canRead(siteId: string): boolean {
    return (
      this.administrator() ||
      (this.authenticated() &&
        this.siteIds().includes(siteId) &&
        this.roles().some((r) => r === 'AnalyticsReader' || r === 'AnalyticsOperator'))
    );
  }
  canWrite(siteId: string): boolean {
    return (
      this.administrator() ||
      (this.authenticated() &&
        this.siteIds().includes(siteId) &&
        this.roles().includes('AnalyticsOperator'))
    );
  }
  private claimList(name: string): string[] {
    const value = this.claims()[name];
    return typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
  }
  initialize(): Promise<void> {
    return (this.initialized ??= this.start());
  }
  private async start(): Promise<void> {
    const config = this.config.auth;
    if (!config) return;
    const { UserManager, WebStorageStateStore } = await import('oidc-client-ts');
    this.manager = new UserManager({
      authority: config.authority,
      client_id: config.clientId,
      scope: config.scope,
      redirect_uri: new URL('auth/callback', document.baseURI).href,
      post_logout_redirect_uri: new URL('auth', document.baseURI).href,
      response_type: 'code',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
      ...(config.audience ? { extraQueryParams: { audience: config.audience } } : {}),
    });
    this.manager.events.addUserLoaded((user) => {
      this.user.set(user);
      this.error.set('');
    });
    this.manager.events.addUserUnloaded(() => this.user.set(null));
    this.manager.events.addAccessTokenExpired(() => {
      this.user.set(null);
      this.error.set('Your session has expired. Sign in again to continue.');
    });
    this.manager.events.addSilentRenewError(() =>
      this.error.set('Your session could not be renewed. Sign in again to continue.'),
    );
    try {
      if (window.location.pathname.endsWith('/auth/callback')) {
        if (window.parent !== window) {
          await this.manager.signinSilentCallback();
          return;
        }
        this.user.set(await this.manager.signinRedirectCallback());
        window.history.replaceState({}, '', new URL('auth', document.baseURI).pathname);
      } else {
        const user = await this.manager.getUser();
        this.user.set(user && !user.expired ? user : null);
      }
    } catch {
      this.error.set(
        'Sign-in could not be completed. Check the identity-provider settings and retry.',
      );
      window.history.replaceState({}, '', new URL('auth', document.baseURI).pathname);
    }
  }
  async token(): Promise<string> {
    await this.initialize();
    return this.authenticated() ? this.user()!.access_token : '';
  }
  async signIn(): Promise<void> {
    await this.initialize();
    try {
      await this.manager?.signinRedirect();
    } catch {
      this.error.set('Sign-in could not be started. Check the identity provider and retry.');
    }
  }
  async signOut(): Promise<void> {
    try {
      await this.manager?.signoutRedirect();
    } catch {
      this.error.set('Sign-out could not be completed. Retry with your identity provider.');
    }
  }
}

import { from, switchMap } from 'rxjs';
export const authorizationInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const config = inject(RUNTIME_CONFIG);
  if (!auth.enabled || !request.url.startsWith(config.apiBaseUrl + '/')) return next(request);
  return from(auth.token()).pipe(
    switchMap((token) =>
      next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request),
    ),
  );
};
export const accessGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth),
    router = inject(Router);
  await auth.initialize();
  if (!auth.enabled) return true;
  if (!auth.authenticated()) return router.parseUrl('/auth');
  if (route.data['administrator'] && !auth.administrator())
    return router.parseUrl('/auth?denied=true');
  return true;
};
