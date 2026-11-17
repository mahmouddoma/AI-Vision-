import { TestBed } from '@angular/core/testing';
import { DICTIONARY, I18nService, initialLanguage, translate } from './i18n';
import { LocalizedFormat } from './localized-format';

describe('Arabic and English localization', () => {
  beforeEach(() => localStorage.removeItem('ai_vision_lang'));
  afterEach(() => localStorage.removeItem('ai_vision_lang'));

  it('has matching keys, nonempty translations and matching placeholders', () => {
    expect(Object.keys(DICTIONARY.ar).sort()).toEqual(Object.keys(DICTIONARY.en).sort());
    for (const [key, english] of Object.entries(DICTIONARY.en)) {
      expect(DICTIONARY.ar[key].trim(), key).not.toBe('');
      expect(DICTIONARY.ar[key].match(/\{\w+\}/g) ?? [], key).toEqual(
        english.match(/\{\w+\}/g) ?? [],
      );
    }
  });

  it('defaults to Arabic and persists the selected language and direction', () => {
    expect(initialLanguage()).toBe('ar');
    const i18n = TestBed.inject(I18nService);
    expect(i18n.currentLang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    i18n.toggleLang();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(initialLanguage()).toBe('en');
  });

  it('supports existing keys, source labels and parameters without translating data', () => {
    expect(translate('ar', 'action.save')).toBe('حفظ');
    expect(translate('ar', 'Save ')).toBe('حفظ ');
    expect(translate('ar', 'catalog.activated', { name: 'Main Mall' })).toBe('تم تفعيل Main Mall.');
    expect(translate('en', 'catalog.activated', { name: 'مول' })).toBe('مول activated.');
    expect(translate('ar', 'my-camera-ID')).toBe('my-camera-ID');
    expect(translate('ar', null)).toBe('');
  });

  it('updates date locale and missing values immediately after switching', () => {
    const i18n = TestBed.inject(I18nService);
    const format = TestBed.inject(LocalizedFormat);
    expect(format.number(null)).toBe('غير متاح');
    const arabicDate = format.timestamp('2026-11-17T12:00:00Z', 'Africa/Cairo');
    expect(arabicDate).toMatch(/[\u0600-\u06ff]/);
    i18n.setLang('en');
    expect(format.number(null)).toBe('N/A');
    expect(format.timestamp('2026-11-17T12:00:00Z', 'Africa/Cairo')).toContain('Nov');
    expect(format.duration(65)).toBe('1:05');
  });

  it('localizes backend error summaries while retaining the original English detail', () => {
    const i18n = TestBed.inject(I18nService);
    const problem = {
      title: 'Update needs your attention',
      message: 'The record version is obsolete.',
      status: 409,
      conflict: true,
      fields: {},
    };
    expect(i18n.errorMessage(problem)).toMatch(/[\u0600-\u06ff]/);
    i18n.setLang('en');
    expect(i18n.errorMessage(problem)).toBe(problem.message);
  });
});
