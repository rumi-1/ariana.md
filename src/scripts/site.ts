// Site-wide behaviour: theme toggle and language switch.
// Runs on every page. Homepage-only rendering lives in scripts/home.ts and listens for the
// 'ariana:langchange' event this file dispatches.
import { I18N } from '../lib/home-data';

const root = document.documentElement;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private windows, cleared site data). The toggle still works for this visit.
  }
}

// Theme

function setTheme(mode: 'light' | 'dark', save = true) {
  root.dataset.theme = mode;
  if (save) writeStored('ariana.theme', mode);
}

document.getElementById('theme')?.addEventListener('click', () => {
  setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

// Language

type Lang = 'en' | 'fa' | 'ps';
const i18nKeys = document.querySelectorAll<HTMLElement>('[data-i18n]');
i18nKeys.forEach((el) => (el.dataset.en = el.textContent ?? ''));
const searchInput = document.querySelector<HTMLInputElement>('[data-i18n-ph]');
const phEn = searchInput?.placeholder ?? '';

export function currentLang(): Lang {
  return (root.lang as Lang) || 'en';
}

export function setLang(lang: Lang) {
  root.lang = lang;
  root.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.querySelectorAll<HTMLElement>('#lang .seg-opt').forEach((o) => {
    o.classList.toggle('on', o.dataset.l === lang);
    o.setAttribute('aria-checked', String(o.dataset.l === lang));
  });
  const dict = lang === 'en' ? null : (I18N as Record<string, any>)[lang];
  i18nKeys.forEach((el) => {
    const key = el.dataset.i18n!;
    el.textContent = (dict && dict[key]) || el.dataset.en || '';
  });
  if (searchInput) searchInput.placeholder = (dict && dict.ph) || phEn;
  document.dispatchEvent(new CustomEvent('ariana:langchange', { detail: lang }));
}

document.querySelectorAll<HTMLElement>('#lang .seg-opt').forEach((o) => {
  o.addEventListener('click', () => setLang(o.dataset.l as Lang));
  o.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setLang(o.dataset.l as Lang);
    }
  });
});

// Keep the theme in sync if the OS preference changes and the reader has not chosen one.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!readStored('ariana.theme')) setTheme(e.matches ? 'dark' : 'light', false);
});
