// Strings live in data/i18n/<lang>.json. Only ship a language a team member has checked.
let strings = {};
export let lang = 'en';
const RTL = new Set(['ar']);

export async function loadLanguage(code = 'en') {
  const res = await fetch(`data/i18n/${code}.json`);
  if (!res.ok) throw new Error(`Missing language file: ${code}`);
  strings = await res.json();
  lang = code;
  document.documentElement.lang = code;
  document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}

export function t(key, vars = {}) {
  const s = strings[key];
  if (s == null) return key;
  return s.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}

export const has = (key) => key in strings;
