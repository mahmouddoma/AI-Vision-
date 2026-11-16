import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppContext } from './core/context';
import { Realtime } from './core/realtime';
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
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly context = inject(AppContext);
  readonly realtime = inject(Realtime);
  readonly menuOpen = signal(false);
  readonly statusOpen = signal(false);
  readonly navigation: { label: string; path: string; icon: IconName; group: string }[] = [
    { label: 'Overview', path: '/', icon: 'overview', group: 'Workspace' },
    { label: 'Live monitoring', path: '/live', icon: 'live', group: '' },
    { label: 'Analytics', path: '/analytics', icon: 'chart', group: '' },
    { label: 'Sessions', path: '/sessions', icon: 'film', group: '' },
    { label: 'Sites', path: '/sites', icon: 'building', group: 'Management' },
    { label: 'Cameras & zones', path: '/cameras', icon: 'camera', group: '' },
  ];
}
