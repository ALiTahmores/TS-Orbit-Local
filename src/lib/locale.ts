// The interface language outside React: date and number formatting and the DOM
// translation layer read it synchronously. ProjectContext owns changes.
export type Locale = 'fa' | 'en';

const STORAGE_KEY = 'wp_manager_locale';
let active: Locale = (() => {
  try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fa'; } catch { return 'fa'; }
})();

export const getLocale = (): Locale => active;
export const isEnglish = () => active === 'en';
export function setActiveLocale(locale: Locale) {
  active = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* storage may be unavailable */ }
}

/** Intl locale for numbers: Persian digits in Persian, Latin digits in English. */
export const numberLocale = () => (active === 'en' ? 'en-US' : 'fa-IR');
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => value.toLocaleString(numberLocale(), options);
