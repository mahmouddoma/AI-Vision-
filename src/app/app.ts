import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppContext } from './core/context';
import { Realtime } from './core/realtime';
import { SystemHealthStore } from './core/system-health';
import { I18nService, TranslatePipe } from './core/i18n';
import { Icon, IconName } from './ui/icon';
import { Dialog } from './ui/dialog';
import { SystemStatus } from './features/system/system-status';
import { Auth } from './core/auth';

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
  readonly auth = inject(Auth);
  readonly context = inject(AppContext);
  readonly health = inject(SystemHealthStore);
  readonly realtime = inject(Realtime);
  readonly i18n = inject(I18nService);
  readonly menuOpen = signal(false);
  readonly statusOpen = signal(false);
  readonly sidebarCollapsed = signal(false);

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
  private readonly allNavigation: {
    key: string;
    path: string;
    icon: IconName;
    groupKey: string;
  }[] = [
    { key: 'nav.overview', path: '/', icon: 'overview', groupKey: 'nav.workspace' },
    { key: 'nav.live', path: '/live', icon: 'live', groupKey: '' },
    { key: 'System health', path: '/system-health', icon: 'server', groupKey: '' },
    { key: 'nav.sites', path: '/sites', icon: 'building', groupKey: 'nav.management' },
    { key: 'nav.cameras', path: '/cameras', icon: 'camera', groupKey: '' },
    { key: 'Setup', path: '/setup', icon: 'check', groupKey: '' },
    { key: 'Floors', path: '/floors', icon: 'zones', groupKey: 'Floors' },
    { key: 'nav.analytics', path: '/analytics', icon: 'chart', groupKey: 'nav.analytics' },
    { key: 'Alerts', path: '/alerts', icon: 'bell', groupKey: 'Alerts' },
    { key: 'nav.sessions', path: '/sessions', icon: 'film', groupKey: 'nav.sessions' },
  ];
  readonly navigation = computed(() =>
    this.allNavigation
      .filter(
        (item) =>
          this.auth.administrator() || ['/floors', '/analytics', '/alerts'].includes(item.path),
      )
      .map((item) =>
        item.path === '/analytics' && !this.auth.administrator()
          ? { ...item, path: '/analytics/flow' }
          : item,
      ),
  );
}
