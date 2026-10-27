// English rendering of the Persian interface. Interface strings stay Persian in
// the source and the Persian text is the dictionary key (the gettext model), so
// components need no per-string wiring. In English mode every text node and
// user-visible attribute with a dictionary entry is replaced as React renders it;
// numbers inserted at runtime match {0}, {1}… placeholders, and any remaining
// Persian digits and punctuation become Latin. Text React updates later is
// translated again by the same observer.
import { en } from './locale/en.ts';
import { isEnglish } from './locale.ts';

const PERSIAN = /[؀-ۿ]/;
const PERSIAN_LETTER = /[ء-يپچژکگی]/;
const NUMBER = /[0-9۰-۹٠-٩]+(?:[.,٫٬/:][0-9۰-۹٠-٩]+)*/g;
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SEPARATORS = [': ', ' — ', ' • ', ' · ', '، ', ' | ', ' - '];
// Typed content is never translated; a textarea's placeholder still is.
const SKIP_TEXT = 'script,style,textarea,[contenteditable="true"],[data-no-translate],[translate="no"]';
const SKIP_ATTRIBUTES = '[data-no-translate],[translate="no"]';

const exact = new Map<string, string>();
const patterns: { regex: RegExp; english: string; literal: number }[] = [];
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
for (const [key, english] of Object.entries(en)) {
  const persian = normalize(key);
  exact.set(persian, english);
  // Keys number their placeholders in order of appearance, so capture group n is {n}.
  if (/\{\d+\}/.test(persian)) {
    const source = persian.split(/\{\d+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
    patterns.push({ regex: new RegExp(`^${source}$`), english, literal: persian.replace(/\{\d+\}/g, '').length });
  }
}
// The most specific template wins: "اعتبار تا پایان {0}" before "{0} تا {1}".
patterns.sort((a, b) => b.literal - a.literal);

/** Latin digits and punctuation for text left in Persian script (numbers, dates). */
export const latinize = (text: string) => text
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
  .replace(/٬/g, ',').replace(/٫/g, '.').replace(/٪/g, '%').replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?');

const fill = (english: string, values: string[]) => english.replace(/\{(\d+)\}/g, (_, index) => values[Number(index)] ?? '');
const missing = new Set<string>();

function lookup(text: string): string | null {
  const found = exact.get(text);
  if (found !== undefined) return found;
  if (!PERSIAN_LETTER.test(text)) return latinize(text);
  // Numbers inserted at runtime ("۵ وظیفه") match the template "{0} وظیفه".
  const numbers: string[] = [];
  const shape = text.replace(NUMBER, number => `{${numbers.push(latinize(number)) - 1}}`);
  if (numbers.length) { const template = exact.get(shape); if (template !== undefined) return fill(template, numbers); }
  // "Label: value" and similar joins, when every part has an English rendering.
  for (const separator of SEPARATORS) {
    const parts = text.split(separator);
    if (parts.length < 2 || parts.some(part => !part.trim())) continue;
    const translated = parts.map(part => lookup(part.trim()));
    if (translated.every(part => part !== null && !PERSIAN_LETTER.test(part))) return translated.join(latinize(separator));
  }
  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (match) return fill(pattern.english, match.slice(1).map(value => lookup(value.trim()) ?? value));
  }
  // Labels often carry punctuation or a marker outside the dictionary text.
  const framed = /^([\s•·*:：()«»"'\-–—]*)(.*?)([\s•·*:：()«»"'.!?؟…،؛\-–—]*)$/.exec(text);
  if (framed && (framed[1] || framed[3]) && framed[2]) {
    const inner = lookup(framed[2]);
    if (inner !== null && !PERSIAN_LETTER.test(inner)) return latinize(framed[1]) + inner + latinize(framed[3]);
  }
  return null;
}

/** English for a Persian interface string, or the string itself when no entry exists. */
export function translateText(text: string): string {
  if (!PERSIAN.test(text)) return text;
  const core = normalize(text);
  const translated = lookup(core);
  if (translated === null) {
    if (PERSIAN_LETTER.test(core)) missing.add(core);
    return latinize(text);
  }
  const lead = /^\s*/.exec(text)![0], tail = /\s*$/.exec(text)![0];
  return lead + translated + tail;
}

/** For text outside the DOM (confirm dialogs, CSV headers): English in English mode. */
export const tr = (text: string) => (isEnglish() ? translateText(text) : text);

/** Browser confirm/alert dialogs show their message in the interface language. */
export function translateNativeDialogs() {
  if (typeof window === 'undefined') return;
  const confirm = window.confirm.bind(window), alert = window.alert.bind(window);
  window.confirm = message => confirm(tr(String(message ?? '')));
  window.alert = message => alert(tr(String(message ?? '')));
}

/** Persian strings seen on screen without an English entry (development aid). */
export const missingTranslations = () => [...missing];

function translateTextNode(node: Text) {
  const value = node.nodeValue;
  if (!value || !PERSIAN.test(value) || node.parentElement?.closest(SKIP_TEXT)) return;
  const next = translateText(value);
  if (next !== value) node.nodeValue = next;
}

function translateAttributes(element: Element) {
  if (element.closest(SKIP_ATTRIBUTES)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value && PERSIAN.test(value)) { const next = translateText(value); if (next !== value) element.setAttribute(name, next); }
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateAttributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateAttributes(node as Element);
  }
}

let observer: MutationObserver | null = null;

export function startDomTranslation() {
  if (observer || typeof document === 'undefined') return;
  translateTree(document.body);
  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target as Text);
      else if (record.type === 'attributes') translateAttributes(record.target as Element);
      else record.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
}

/** Stops translating; the caller re-renders the interface to restore Persian text. */
export function stopDomTranslation() {
  observer?.disconnect();
  observer = null;
}
