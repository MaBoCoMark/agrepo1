/**
 * ============================================================================
 * 🌗 GitHub Primer Theme Controller (Light / Dark Mode)
 * ============================================================================
 */

export function initThemeController(): void {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');

  function setTheme(theme: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('primer-color-theme', theme);
    if (themeIcon && themeText) {
      if (theme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
      } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
      }
    }
  }

  const savedTheme = (localStorage.getItem('primer-color-theme') as 'light' | 'dark') || 'light';
  setTheme(savedTheme);

  toggleBtn?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  });
}
