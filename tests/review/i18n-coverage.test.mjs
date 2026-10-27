import test from 'node:test';
import assert from 'node:assert/strict';
import { missingKeys } from '../../scripts/i18n-check.mjs';
import { setActiveLocale } from '../../src/lib/locale.ts';
import { translateText, tr } from '../../src/lib/domTranslation.ts';

test('every Persian interface string in the sources has an English entry', async () => {
  const missing = await missingKeys();
  assert.deepEqual(missing.map(([key, where]) => `${where}  ${key}`), [], 'run `npm run i18n:check` and add the strings to src/lib/locale/en.ts');
});

test('English rendering keeps spacing, fills runtime numbers and translates captured labels', () => {
  assert.equal(translateText('  پروژه‌ها '), '  Projects ');
  // Numbers inserted at runtime, in Persian digits, match {0}.
  assert.equal(translateText('۵ وظیفهٔ باز'), '5 open tasks');
  assert.equal(translateText('۳ از ۷ وظیفهٔ واگذارشده'), '3 of 7 assigned tasks');
  // A placeholder that captures another interface string is translated too.
  assert.equal(translateText('دپارتمان معتبر نیست.'), 'Department is not valid.');
  // Punctuation around a known label, and "label: value" joins.
  assert.equal(translateText('وضعیت:'), 'Status:');
  assert.equal(translateText('وضعیت: فعال'), 'Status: Active');
  // The more specific template wins over a generic one ("{0} تا {1}").
  assert.equal(translateText('اعتبار تا پایان 4 Azar 1405'), 'Valid until the end of 4 Azar 1405');
  // Unknown text keeps its words but shows Latin digits.
  assert.equal(translateText('متن کاربر ۱۲'), 'متن کاربر 12');
});

test('text outside the page follows the active language', () => {
  setActiveLocale('fa');
  assert.equal(tr('پروژه‌ها'), 'پروژه‌ها');
  setActiveLocale('en');
  assert.equal(tr('پروژه‌ها'), 'Projects');
  setActiveLocale('fa');
});
