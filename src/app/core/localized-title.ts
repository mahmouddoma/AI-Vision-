import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n';

@Injectable()
export class LocalizedTitle extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly page = signal('overview.title');

  constructor() {
    super();
    effect(() => this.title.setTitle(`${this.i18n.t(this.page())} · AI Vision`));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.page.set(this.buildTitle(snapshot) ?? 'overview.title');
  }
}
