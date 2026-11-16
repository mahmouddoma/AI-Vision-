import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadConfig, RUNTIME_CONFIG } from './app/core/runtime-config';

loadConfig()
  .then((config) =>
    bootstrapApplication(App, {
      ...appConfig,
      providers: [...appConfig.providers, { provide: RUNTIME_CONFIG, useValue: config }],
    }),
  )
  .catch(() => {
    const root = document.querySelector('app-root');
    if (!root) return;
    const section = document.createElement('section');
    section.className = 'state-view';
    section.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = 'Unable to start AI Vision';
    const message = document.createElement('p');
    message.textContent =
      'Check that config.json is available with a valid API URL, hub path and refresh interval, then try again.';
    const retry = document.createElement('button');
    retry.className = 'button';
    retry.textContent = 'Reload application';
    retry.addEventListener('click', () => window.location.reload());
    section.append(title, message, retry);
    root.replaceChildren(section);
  });
