/**
 * OQL — Orbit Query Language, a JQL-style search language shared by the client
 * (instant errors, suggestions) and the server (the only place it is evaluated).
 *
 *   project = "Website" AND type in (story, bug) AND status = open
 *   assignee = currentUser() AND due < +7d ORDER BY priority DESC, due
 *   وضعیت = باز و مسئول = من
 *
 * Fields, keywords and values accept English and Persian names. The module is
 * pure: no imports, no DOM and no Node APIs.
 */
export type FieldKind = 'enum' | 'user' | 'ref' | 'list' | 'number' | 'date' | 'key' | 'text';
export type Operator = '=' | '!=' | '~' | '!~' | '>' | '>=' | '<' | '<=' | 'in' | 'not in' | 'is empty' | 'is not empty';
export interface FieldDef { kind: FieldKind; label: string; aliases: string[]; sortable: boolean; ops: Operator[] }

const ORDERED: Operator[] = ['=', '!=', '>', '>=', '<', '<=', 'in', 'not in'];
const OPTIONAL: Operator[] = ['is empty', 'is not empty'];
export const FIELDS: Record<string, FieldDef> = {
  project: { kind: 'ref', label: 'پروژه', aliases: ['پروژه'], sortable: true, ops: ['=', '!=', 'in', 'not in', '~'] },
  type: { kind: 'enum', label: 'نوع', aliases: ['نوع', 'issuetype'], sortable: true, ops: ['=', '!=', 'in', 'not in'] },
  status: { kind: 'enum', label: 'وضعیت', aliases: ['وضعیت'], sortable: true, ops: ['=', '!=', 'in', 'not in'] },
  priority: { kind: 'enum', label: 'اولویت', aliases: ['اولویت'], sortable: true, ops: ORDERED },
  assignee: { kind: 'user', label: 'مسئول', aliases: ['مسئول'], sortable: true, ops: ['=', '!=', 'in', 'not in', ...OPTIONAL] },
  creator: { kind: 'user', label: 'سازنده', aliases: ['سازنده', 'reporter'], sortable: false, ops: ['=', '!=', 'in', 'not in'] },
  epic: { kind: 'ref', label: 'اپیک', aliases: ['اپیک'], sortable: true, ops: ['=', '!=', 'in', 'not in', '~', ...OPTIONAL] },
  sprint: { kind: 'ref', label: 'اسپرینت', aliases: ['اسپرینت'], sortable: true, ops: ['=', '!=', 'in', 'not in', '~', ...OPTIONAL] },
  labels: { kind: 'list', label: 'برچسب', aliases: ['برچسب', 'label', 'tags', 'tag'], sortable: false, ops: ['=', '!=', 'in', 'not in', '~', ...OPTIONAL] },
  points: { kind: 'number', label: 'امتیاز', aliases: ['امتیاز', 'storypoints'], sortable: true, ops: [...ORDERED, ...OPTIONAL] },
  due: { kind: 'date', label: 'سررسید', aliases: ['سررسید', 'duedate', 'deadline'], sortable: true, ops: ['=', '!=', '>', '>=', '<', '<=', ...OPTIONAL] },
  created: { kind: 'date', label: 'ایجاد', aliases: ['ایجاد'], sortable: true, ops: ['=', '!=', '>', '>=', '<', '<='] },
  updated: { kind: 'date', label: 'به‌روزرسانی', aliases: ['به‌روزرسانی', 'بروزرسانی'], sortable: true, ops: ['=', '!=', '>', '>=', '<', '<='] },
  key: { kind: 'key', label: 'کلید', aliases: ['کلید', 'issuekey'], sortable: true, ops: ['=', '!=', 'in', 'not in'] },
  title: { kind: 'text', label: 'عنوان', aliases: ['عنوان', 'summary'], sortable: true, ops: ['~', '!~'] },
  text: { kind: 'text', label: 'متن', aliases: ['متن'], sortable: false, ops: ['~', '!~'] },
};

/** Canonical values of the closed fields, with the names people type for them. */
export const ENUMS: Record<string, Record<string, string[]>> = {
  type: { story: ['story', 'استوری'], task: ['task', 'وظیفه'], bug: ['bug', 'باگ'], epic: ['epic', 'اپیک'] },
  status: {
    pending: ['pending', 'todo', 'to do', 'در انتظار'], inprogress: ['inprogress', 'in progress', 'in_progress', 'در حال انجام'],
    review: ['review', 'in review', 'under review', 'در حال بررسی'], blocked: ['blocked', 'مسدود', 'متوقف'],
    completed: ['completed', 'done', 'تکمیل‌شده', 'انجام‌شده'], cancelled: ['cancelled', 'canceled', 'لغوشده'],
  },
  priority: { low: ['low', 'پایین'], medium: ['medium', 'normal', 'متوسط'], high: ['high', 'بالا'], critical: ['critical', 'urgent', 'highest', 'فوری', 'بحرانی'] },
};
/** Shorthands that stand for several statuses. */
export const STATUS_MACROS: Record<string, string[]> = { open: ['pending', 'inprogress', 'review', 'blocked'], closed: ['completed', 'cancelled'] };
const MACRO_NAMES: Record<string, string> = { open: 'open', 'باز': 'open', closed: 'closed', 'بسته': 'closed' };
export const PRIORITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
export const FUNCTIONS: Record<string, { fields: string[]; label: string }> = {
  currentuser: { fields: ['assignee', 'creator'], label: 'currentUser()' },
  opensprints: { fields: ['sprint'], label: 'openSprints()' },
  activesprint: { fields: ['sprint'], label: 'activeSprint()' },
  now: { fields: ['due', 'created', 'updated'], label: 'now()' },
};
const KEYWORDS: Record<string, string> = {
  and: 'and', 'و': 'and', or: 'or', 'یا': 'or', not: 'not', in: 'in', is: 'is', empty: 'empty', null: 'empty', 'خالی': 'empty',
  order: 'order', by: 'by', asc: 'asc', desc: 'desc',
};
export const LIMITS = { length: 2000, clauses: 60, depth: 30, list: 100 };

export class OqlError extends Error {
  start: number; end: number;
  constructor(message: string, start: number, end: number) { super(message); this.start = start; this.end = end; }
}

/** Lower-case, Latin digits, no spacing differences ("تکمیل شده" = "تکمیل‌شده"). */
export const normalize = (value: string) => String(value).toLowerCase()
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c_-]+/g, '');
const fieldIndex = new Map<string, string>();
for (const [name, def] of Object.entries(FIELDS)) for (const alias of [name, ...def.aliases]) fieldIndex.set(normalize(alias), name);
export const fieldOf = (word: string) => fieldIndex.get(normalize(word));
const enumIndex: Record<string, Map<string, string>> = {};
for (const [field, values] of Object.entries(ENUMS)) {
  enumIndex[field] = new Map();
  for (const [canonical, names] of Object.entries(values)) for (const name of [canonical, ...names]) enumIndex[field].set(normalize(name), canonical);
}
/** The canonical values a word stands for, or null when it names none. */
export function enumValues(field: string, word: string): string[] | null {
  if (field === 'status' && MACRO_NAMES[normalize(word)]) return STATUS_MACROS[MACRO_NAMES[normalize(word)]];
  const value = enumIndex[field]?.get(normalize(word));
  return value ? [value] : null;
}

// ------------------------------------------------------------------ tokens

export type TokenType = 'word' | 'string' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';
export interface Token { type: TokenType; value: string; start: number; end: number }

export function tokenize(source: string, tolerant = false): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) { index++; continue; }
    const start = index;
    if (char === '(' || char === ')' || char === ',' || char === '،') {
      tokens.push({ type: char === '(' ? 'lparen' : char === ')' ? 'rparen' : 'comma', value: char, start, end: ++index });
      continue;
    }
    if (char === '"' || char === "'" || char === '«') {
      const close = char === '«' ? '»' : char;
      let value = '';
      index++;
      while (index < source.length && source[index] !== close) {
        if (source[index] === '\\' && index + 1 < source.length) index++;
        value += source[index++];
      }
      if (index >= source.length && !tolerant) throw new OqlError('رشتهٔ داخل گیومه بسته نشده است.', start, source.length);
      index++;
      tokens.push({ type: 'string', value, start, end: Math.min(index, source.length) });
      continue;
    }
    const two = source.slice(index, index + 2);
    if (['!=', '!~', '>=', '<=', '<>'].includes(two)) { tokens.push({ type: 'op', value: two === '<>' ? '!=' : two, start, end: index += 2 }); continue; }
    if ('=~<>'.includes(char)) { tokens.push({ type: 'op', value: char, start, end: ++index }); continue; }
    if (char === '!') { if (tolerant) { index++; continue; } throw new OqlError('«!» فقط در != و !~ به کار می‌رود.', start, start + 1); }
    while (index < source.length && !/[\s(),،"'«=~<>!]/.test(source[index])) index++;
    tokens.push({ type: 'word', value: source.slice(start, index), start, end: index });
  }
  tokens.push({ type: 'eof', value: '', start: source.length, end: source.length });
  return tokens;
}
const keyword = (token: Token | undefined) => token?.type === 'word' ? KEYWORDS[token.value.toLowerCase()] || KEYWORDS[token.value] : undefined;

// ------------------------------------------------------------------ syntax tree

export type Value =
  | { kind: 'text'; value: string; quoted: boolean; start: number; end: number }
  | { kind: 'func'; name: string; start: number; end: number };
export type Node =
  | { type: 'and' | 'or'; left: Node; right: Node }
  | { type: 'not'; node: Node }
  | { type: 'clause'; field: string; op: Operator; values: Value[]; start: number; end: number };
export interface Query { where: Node | null; order: Array<{ field: string; dir: 'asc' | 'desc' }> }

/** Parses and checks a query; throws OqlError pointing at the offending part. */
export function parse(source: string): Query {
  if (source.length > LIMITS.length) throw new OqlError(`جستجو حداکثر ${LIMITS.length} نویسه است.`, LIMITS.length, source.length);
  const tokens = tokenize(source);
  let position = 0, clauses = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const fail = (message: string, token = peek()): never => { throw new OqlError(message, token.start, Math.max(token.end, token.start + 1)); };
  const expect = (type: TokenType, message: string) => peek().type === type ? next() : fail(message);

  const value = (field: string): Value => {
    const token = peek();
    if (token.type === 'string') { next(); return check(field, { kind: 'text', value: token.value, quoted: true, start: token.start, end: token.end }); }
    if (token.type !== 'word' || ['and', 'or', 'order'].includes(keyword(token) || '')) return fail(`برای «${FIELDS[field].label}» مقدار لازم است.`);
    next();
    if (peek().type === 'lparen' && tokens[position + 1]?.type === 'rparen') {
      const name = token.value.toLowerCase();
      const func = FUNCTIONS[name];
      if (!func) return fail(`تابع «${token.value}()» شناخته نشد.`, token);
      if (!func.fields.includes(field)) return fail(`تابع «${func.label}» برای «${FIELDS[field].label}» به کار نمی‌رود.`, token);
      next(); const close = next();
      return { kind: 'func', name, start: token.start, end: close.end };
    }
    return check(field, { kind: 'text', value: token.value, quoted: false, start: token.start, end: token.end });
  };
  const check = (field: string, item: Value): Value => {
    if (item.kind !== 'text') return item;
    const def = FIELDS[field];
    const at = { type: 'word' as TokenType, value: item.value, start: item.start, end: item.end };
    if (def.kind === 'enum' && !enumValues(field, item.value)) {
      const names = Object.keys(ENUMS[field]).concat(field === 'status' ? ['open', 'closed'] : []).join('، ');
      fail(`«${item.value}» برای «${def.label}» معتبر نیست. مقادیر مجاز: ${names}`, at);
    }
    if (def.kind === 'number' && !/^\d+(\.\d+)?$/.test(normalize(item.value))) fail(`«${item.value}» عدد نیست.`, at);
    if (def.kind === 'date' && !dateWord(item.value)) fail(`«${item.value}» تاریخ معتبری نیست؛ مثلاً 2026-11-20، 1405/08/29، today یا -7d.`, at);
    if (def.kind === 'user' && ['me', 'من'].includes(normalize(item.value))) return { kind: 'func', name: 'currentuser', start: item.start, end: item.end };
    if (def.kind === 'date' && ['today', 'امروز'].includes(normalize(item.value))) return { kind: 'func', name: 'now', start: item.start, end: item.end };
    return item;
  };
  const clause = (): Node => {
    const token = peek();
    if (token.type !== 'word') return fail(token.type === 'eof' ? 'جستجو ناتمام است؛ نام فیلد لازم است.' : 'اینجا نام فیلد لازم است.');
    const field = fieldOf(token.value);
    if (!field) return fail(`فیلد «${token.value}» شناخته نشد. فیلدها: ${Object.keys(FIELDS).join('، ')}`);
    next();
    if (++clauses > LIMITS.clauses) fail(`جستجو حداکثر ${LIMITS.clauses} شرط دارد.`, token);
    const def = FIELDS[field];
    let op: Operator;
    const opToken = peek();
    if (opToken.type === 'op') { next(); op = opToken.value as Operator; }
    else if (keyword(opToken) === 'in') { next(); op = 'in'; }
    else if (keyword(opToken) === 'not' && keyword(tokens[position + 1]) === 'in') { next(); next(); op = 'not in'; }
    else if (keyword(opToken) === 'is') {
      next();
      const negated = keyword(peek()) === 'not';
      if (negated) next();
      if (keyword(peek()) !== 'empty') fail('پس از IS باید EMPTY بیاید.');
      next();
      op = negated ? 'is not empty' : 'is empty';
    } else return fail(`پس از «${def.label}» عملگر لازم است (مثل =، !=، ~ یا IN).`);
    if (!def.ops.includes(op)) fail(`عملگر «${op.toUpperCase()}» برای «${def.label}» مجاز نیست؛ مجاز: ${def.ops.map(item => item.toUpperCase()).join('، ')}`, opToken);
    let values: Value[] = [];
    if ((op === 'in' || op === 'not in') && peek().type === 'word' && tokens[position + 1]?.type === 'lparen' && tokens[position + 2]?.type === 'rparen') {
      values = [value(field)]; // a function that stands for a list, e.g. sprint IN openSprints()
    } else if (op === 'in' || op === 'not in') {
      expect('lparen', 'پس از IN باید فهرست داخل پرانتز بیاید.');
      values.push(value(field));
      while (peek().type === 'comma') { next(); values.push(value(field)); }
      expect('rparen', 'پرانتز فهرست بسته نشده است.');
      if (values.length > LIMITS.list) fail(`فهرست حداکثر ${LIMITS.list} مقدار دارد.`, opToken);
    } else if (op !== 'is empty' && op !== 'is not empty') values = [value(field)];
    return { type: 'clause', field, op, values, start: token.start, end: tokens[position - 1].end };
  };
  const factor = (depth: number): Node => {
    if (depth > LIMITS.depth) fail('پرانتزها بیش از حد تودرتو هستند.');
    if (keyword(peek()) === 'not') { next(); return { type: 'not', node: factor(depth + 1) }; }
    if (peek().type === 'lparen') { next(); const node = expression(depth + 1); expect('rparen', 'پرانتز بسته نشده است.'); return node; }
    return clause();
  };
  const term = (depth: number): Node => {
    let node = factor(depth);
    while (keyword(peek()) === 'and') { next(); node = { type: 'and', left: node, right: factor(depth) }; }
    return node;
  };
  const expression = (depth: number): Node => {
    let node = term(depth);
    while (keyword(peek()) === 'or') { next(); node = { type: 'or', left: node, right: term(depth) }; }
    return node;
  };

  const where = peek().type === 'eof' || keyword(peek()) === 'order' ? null : expression(0);
  const order: Query['order'] = [];
  if (keyword(peek()) === 'order') {
    next();
    if (keyword(peek()) !== 'by') fail('پس از ORDER باید BY بیاید.');
    next();
    do {
      if (order.length) next();
      const token = peek();
      const field = token.type === 'word' ? fieldOf(token.value) : undefined;
      if (!field) fail(token.type === 'eof' ? 'فیلد مرتب‌سازی لازم است.' : `فیلد «${token.value}» برای مرتب‌سازی شناخته نشد.`);
      if (!FIELDS[field!].sortable) fail(`مرتب‌سازی بر اساس «${FIELDS[field!].label}» ممکن نیست.`);
      next();
      const dir = keyword(peek()) === 'desc' ? 'desc' : 'asc';
      if (['asc', 'desc'].includes(keyword(peek()) || '')) next();
      order.push({ field: field!, dir });
    } while (peek().type === 'comma');
  }
  if (peek().type !== 'eof') fail(keyword(peek()) ? `«${peek().value}» اینجا معنا ندارد.` : 'بین شرط‌ها AND یا OR لازم است.');
  return { where, order };
}

/** A date word: ISO, Persian calendar, today/now, or a relative offset (-7d, +2w, -1m). */
export const dateWord = (word: string): boolean => resolveDate(word, '2000-01-01') !== null;
/** Digits made Latin, nothing else changed (dates keep their signs and separators). */
const latin = (value: string) => String(value).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).trim().toLowerCase();
/** Resolves a date word to an ISO day, given today's ISO day. */
export function resolveDate(word: string, today: string): string | null {
  const value = latin(word);
  if (['today', 'امروز', 'now'].includes(value)) return today;
  const relative = /^([+-]?)(\d{1,4})([dwm])$/.exec(value);
  const shift = (days: number) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
  if (relative) return shift((relative[1] === '-' ? -1 : 1) * Number(relative[2]) * (relative[3] === 'w' ? 7 : relative[3] === 'm' ? 30 : 1));
  const parts = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(value);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  if (year >= 1300 && year < 1600) return persianToIso(year, month, day);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) === iso ? iso : null;
}
const persianParts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
function persianToIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const cursor = new Date(Date.UTC(year + 621, 2, 1));
  for (let index = 0; index < 400; index++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const parts = Object.fromEntries(persianParts.formatToParts(cursor).filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => [part.type, Number(part.value)]));
    if (parts.year === year && parts.month === month && parts.day === day) return cursor.toISOString().slice(0, 10);
  }
  return null;
}

/** Writes a value back into OQL, quoting it when needed. */
export const quote = (value: string) => /^[^\s(),،"'«»=~<>!]+$/.test(value) && !KEYWORDS[value.toLowerCase()] && !KEYWORDS[value] ? value : `"${value.replace(/["\\]/g, '\\$&')}"`;

// ------------------------------------------------------------------ suggestions

export interface Suggestion { label: string; insert: string; hint?: string }
/**
 * What may come next at the cursor: a field, an operator, a value or a keyword.
 * `values` supplies names for the open fields (projects, people, epics, sprints, labels).
 */
export function suggest(source: string, cursor: number, values: Partial<Record<string, string[]>> = {}): { from: number; to: number; items: Suggestion[] } {
  const before = source.slice(0, cursor);
  const tokens = tokenize(before, true).filter(token => token.type !== 'eof');
  const last = tokens[tokens.length - 1];
  const typing = !!last && last.end === before.length && (last.type === 'word' || last.type === 'string') && !/\s$/.test(before);
  const done = typing ? tokens.slice(0, -1) : tokens;
  const prefix = typing ? last!.value : '';
  const from = typing ? last!.start : cursor;
  const match = (items: Suggestion[]) => items.filter(item => !prefix || normalize(item.label).startsWith(normalize(prefix)) || normalize(item.insert).startsWith(normalize(prefix))).slice(0, 12);
  const fieldItems = () => Object.entries(FIELDS).map(([name, def]) => ({ label: name, insert: name + ' ', hint: def.label }));
  const keywordItems = (inOrder: boolean) => inOrder ? [{ label: ',', insert: ', ' }, { label: 'ASC', insert: 'ASC ' }, { label: 'DESC', insert: 'DESC ' }]
    : [{ label: 'AND', insert: 'AND ', hint: 'و' }, { label: 'OR', insert: 'OR ', hint: 'یا' }, { label: 'ORDER BY', insert: 'ORDER BY ', hint: 'مرتب‌سازی' }];
  const lastWord = done[done.length - 1];
  const orderAt = done.findIndex((token, index) => keyword(token) === 'order' && keyword(done[index + 1]) === 'by');
  if (orderAt >= 0) {
    const tail = done.slice(orderAt + 2);
    const tailLast = tail[tail.length - 1];
    if (!tail.length || tailLast?.type === 'comma') return { from, to: cursor, items: match(Object.entries(FIELDS).filter(([, def]) => def.sortable).map(([name, def]) => ({ label: name, insert: name + ' ', hint: def.label }))) };
    return { from, to: cursor, items: match(keywordItems(true)) };
  }
  // Walk back to the clause being written: field, operator, values.
  // A "(" right after IN opens a value list, so it belongs to the clause; any other "(" groups clauses.
  let start = done.length;
  while (start > 0) {
    const previous = done[start - 1], word = keyword(previous) || '';
    if ((word === 'and' || word === 'or') || (word === 'not' && keyword(done[start]) !== 'in')) break;
    if (previous.type === 'lparen' && keyword(done[start - 2]) !== 'in') break;
    start--;
  }
  let clause = done.slice(start);
  while (clause[0]?.type === 'lparen') clause = clause.slice(1);
  if (!clause.length) return { from, to: cursor, items: match(fieldItems()) };
  const field = clause[0].type === 'word' ? fieldOf(clause[0].value) : undefined;
  if (!field) return { from, to: cursor, items: match(fieldItems()) };
  const def = FIELDS[field];
  if (clause.length === 1) {
    return { from, to: cursor, items: match(def.ops.map(op => ({ label: op.toUpperCase(), insert: (op === 'in' || op === 'not in' ? op.toUpperCase() + ' (' : op.toUpperCase()) + ' ' }))) };
  }
  const opText = clause.slice(1).map(token => token.value.toLowerCase()).join(' ');
  const closedList = clause.some(token => token.type === 'rparen');
  const valueExpected = (/^(=|!=|~|!~|>|>=|<|<=)$/.test(opText)) || (/^(not )?in \(/.test(opText + ' ') && !closedList && (lastWord?.type === 'lparen' || lastWord?.type === 'comma'));
  if (/^is( not)?$/.test(opText)) return { from, to: cursor, items: match([{ label: 'EMPTY', insert: 'EMPTY ' }, ...(opText === 'is' ? [{ label: 'NOT EMPTY', insert: 'NOT EMPTY ' }] : [])]) };
  if (opText === 'not') return { from, to: cursor, items: match([{ label: 'IN', insert: 'IN (' }]) };
  if (valueExpected || (typing && clause.length >= 2 && !closedList && lastWord?.type !== 'word')) {
    const items: Suggestion[] = [];
    if (def.kind === 'enum') for (const [canonical, names] of Object.entries(ENUMS[field])) items.push({ label: canonical, insert: canonical, hint: names[names.length - 1] });
    if (field === 'status') items.unshift({ label: 'open', insert: 'open', hint: 'باز' }, { label: 'closed', insert: 'closed', hint: 'بسته' });
    for (const [name, func] of Object.entries(FUNCTIONS)) if (func.fields.includes(field)) items.push({ label: func.label, insert: func.label, hint: name === 'currentuser' ? 'خودم' : undefined });
    if (def.kind === 'date') items.push({ label: 'today', insert: 'today', hint: 'امروز' }, { label: '-7d', insert: '-7d', hint: 'هفت روز پیش' }, { label: '+7d', insert: '+7d', hint: 'هفت روز بعد' });
    for (const name of values[field] || []) items.push({ label: name, insert: quote(name) });
    const list = /^(not )?in/.test(opText);
    return { from, to: cursor, items: match(items).map(item => ({ ...item, insert: item.insert + (list ? '' : ' ') })) };
  }
  return { from, to: cursor, items: match(keywordItems(false)) };
}
