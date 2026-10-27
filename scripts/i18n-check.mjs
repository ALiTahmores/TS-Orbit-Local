// Lists Persian interface strings that have no English entry in
// src/lib/locale/en.ts. Strings are read from the TypeScript sources: literals,
// template literals (interpolations become {0}, {1}…), JSX text and `+`
// concatenations. Text that is already bilingual is skipped: the Persian side of
// `isRtl ? 'فارسی' : 'English'`, `{ fa: …, en: … }` pairs and t() keys with an
// English entry in i18n.ts. Console output and type positions are ignored.
//   npm run i18n:check            report missing keys
//   npm run i18n:check -- --json [file]  every key with its first location
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { projectRoot } from './paths.mjs';

const PERSIAN_LETTER = /[ء-يپچژکگی]/;
const RTL_CONDITION = /\b(?:isRtl|isFa|isPersian|rtl)\b|\b(?:locale|lang|language|authLocale|portalLang)\s*===?\s*['"]fa['"]|['"]fa['"]\s*===?\s*(?:locale|lang)/;
const LTR_CONDITION = /\b(?:locale|lang|language|authLocale|portalLang)\s*===?\s*['"]en['"]|!\s*isRtl\b|\bisEnglish\b/;
const SKIP_FILES = [/src[\\/]lib[\\/]locale[\\/]/, /src[\\/]lib[\\/]i18n\.ts$/, /src[\\/]data[\\/]mockData\.ts$/];

export const normalizeKey = text => text.replace(/\s+/g, ' ').trim();

function sourceFiles() {
  const roots = ['src', 'server'].map(dir => path.join(projectRoot, dir));
  const files = [path.join(projectRoot, 'application.ts')];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(full);
    }
  };
  roots.forEach(walk);
  return files.filter(file => !SKIP_FILES.some(pattern => pattern.test(file)));
}

const hasPersian = text => PERSIAN_LETTER.test(text);
const containsPersianLiteral = node => {
  let found = false;
  const visit = child => {
    if (found) return;
    if ((ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child) || ts.isJsxText(child)) && hasPersian(child.text)) found = true;
    else if (ts.isTemplateExpression(child) && (hasPersian(child.head.text) || child.templateSpans.some(span => hasPersian(span.literal.text)))) found = true;
    else ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

/** The node is the Persian half of an already bilingual expression. */
function bilingual(node, english) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isConditionalExpression(parent)) {
      const condition = parent.condition.getText();
      if (child === parent.whenTrue && RTL_CONDITION.test(condition) && !containsPersianLiteral(parent.whenFalse)) return true;
      if (child === parent.whenFalse && LTR_CONDITION.test(condition) && !containsPersianLiteral(parent.whenTrue)) return true;
    }
    if (ts.isPropertyAssignment(parent) && child === parent.initializer && ['fa', "'fa'", '"fa"'].includes(parent.name.getText()) &&
        ts.isObjectLiteralExpression(parent.parent) && parent.parent.properties.some(property => property.name && ['en', "'en'", '"en"'].includes(property.name.getText()))) return true;
    if (ts.isCallExpression(parent) && child === parent.arguments[0] && ts.isIdentifier(parent.expression) && parent.expression.text === 't' && ts.isStringLiteral(node) && english.has(node.text)) return true;
    if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.expression.getText() === 'console') return true;
    if (ts.isLiteralTypeNode(parent) || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isBlock(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

/** Top of a `+` chain that joins strings, with each non-literal operand as {n}. */
function concatenation(node) {
  let top = node;
  while (ts.isBinaryExpression(top.parent) && top.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) top = top.parent;
  if (top === node) return null;
  const parts = [];
  const flatten = part => {
    if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.PlusToken) { flatten(part.left); flatten(part.right); }
    else if (ts.isParenthesizedExpression(part)) flatten(part.expression);
    else parts.push(part);
  };
  flatten(top);
  let placeholder = 0;
  const text = parts.map(part => ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part) ? part.text : `{${placeholder++}}`).join('');
  return { top, text };
}

export function collectKeys() {
  const english = new Set(Object.keys(englishI18n));
  const keys = new Map();
  const add = (text, file, node) => {
    const key = normalizeKey(text);
    // Embedded code (the WordPress plugin source, print-page HTML) is not interface text.
    if (!hasPersian(key) || key.length > 400 || /<\?php|<\/?(?:div|span|table|style|h\d|p)\b/i.test(key)) return;
    const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
    if (!keys.has(key)) keys.set(key, `${path.relative(projectRoot, file).replace(/\\/g, '/')}:${line + 1}`);
  };
  for (const file of sourceFiles()) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = node => {
      if (ts.isTemplateExpression(node)) {
        if (!bilingual(node, english)) {
          let placeholder = 0;
          add(node.head.text + node.templateSpans.map(span => `{${placeholder++}}` + span.literal.text).join(''), file, node);
        }
        node.templateSpans.forEach(span => visit(span.expression));
        return;
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (hasPersian(node.text) && !bilingual(node, english)) {
          const joined = concatenation(node);
          add(joined ? joined.text : node.text, file, joined ? joined.top : node);
        }
        return;
      }
      if (ts.isJsxText(node)) { if (hasPersian(node.text) && !bilingual(node, english)) add(node.text, file, node); return; }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return keys;
}

const { translations } = await import(new URL('../src/lib/i18n.ts', import.meta.url).href);
const englishI18n = translations.en;

export async function missingKeys() {
  const { en } = await import(new URL('../src/lib/locale/en.ts', import.meta.url).href);
  const known = new Set(Object.keys(en).map(normalizeKey));
  return [...collectKeys()].filter(([key]) => !known.has(key));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--json')) {
    const json = JSON.stringify(Object.fromEntries(collectKeys()), null, 2);
    const out = process.argv[process.argv.indexOf('--json') + 1];
    if (out && !out.startsWith('--')) fs.writeFileSync(out, json); else console.log(json);
  } else {
    const missing = await missingKeys();
    for (const [key, where] of missing) console.log(`${where}\t${key}`);
    console.log(missing.length ? `${missing.length} Persian strings have no English entry in src/lib/locale/en.ts.` : 'Every Persian interface string has an English entry.');
    process.exitCode = missing.length ? 1 : 0;
  }
}
