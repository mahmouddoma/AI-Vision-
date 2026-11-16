import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/*.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 150000,
  projects: [base.projects![0]],
});
