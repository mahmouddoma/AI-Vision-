import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppContext } from './core/context';
import { Realtime } from './core/realtime';
import { I18nService, TranslatePipe } from './core/i18n';
import { Icon, IconName } from './ui/icon';
import { Dialog } from './ui/dialog';
import { SystemStatus } from './features/system/system-status';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
    Icon,
    Dialog,
    SystemStatus,
    TranslatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly context = inject(AppContext);
  readonly realtime = inject(Realtime);
  readonly i18n = inject(I18nService);
  readonly menuOpen = signal(false);
  readonly statusOpen = signal(false);
  readonly sidebarCollapsed = signal(false);

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
  readonly navigation: { key: string; path: string; icon: IconName; groupKey: string }[] = [
    { key: 'nav.overview', path: '/', icon: 'overview', groupKey: 'nav.workspace' },
    { key: 'nav.live', path: '/live', icon: 'live', groupKey: '' },
    { key: 'nav.analytics', path: '/analytics', icon: 'chart', groupKey: '' },
    { key: 'nav.sessions', path: '/sessions', icon: 'film', groupKey: '' },
    { key: 'nav.sites', path: '/sites', icon: 'building', groupKey: 'nav.management' },
    { key: 'nav.cameras', path: '/cameras', icon: 'camera', groupKey: '' },
  ];
}
