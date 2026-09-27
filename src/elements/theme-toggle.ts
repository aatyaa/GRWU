/**
 * <grwu-theme-toggle> cycles auto -> light -> dark and remembers the choice.
 * Markup: a <button> child whose text is replaced with the current state.
 * The pre-paint half of this lives inline in BaseLayout, so there is no flash.
 */
const STORAGE_KEY = 'grwu-theme';
const THEMES = ['auto', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
}

class ThemeToggle extends HTMLElement {
  connectedCallback(): void {
    const button = this.querySelector('button');
    if (!button) return;
    this.render(button, readTheme());
    button.addEventListener('click', () => {
      const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length] ?? 'auto';
      applyTheme(next);
      this.render(button, next);
    });
  }

  private render(button: HTMLButtonElement, theme: Theme): void {
    button.dataset.theme = theme;
    button.textContent = `Theme: ${theme}`;
  }
}

if (!customElements.get('grwu-theme-toggle')) {
  customElements.define('grwu-theme-toggle', ThemeToggle);
}
