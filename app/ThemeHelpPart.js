import { AppState } from './AppState';
export class ThemeHelpPart extends AppState {
    openHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal)
            return;
        Array.from(document.body.children).forEach(el => {
            if (el.id !== 'helpModal' && el.tagName !== 'SCRIPT') {
                el.inert = true;
            }
        });
        modal.style.display = 'flex';
        modal.removeAttribute('hidden');
        document.getElementById('helpModalClose')?.focus();
        this.trackEvent('Help Opened');
    }
    toggleHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal && modal.style.display !== 'none') {
            this.closeHelpModal();
        }
        else {
            this.openHelpModal();
        }
    }
    closeHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal)
            return;
        modal.style.display = 'none';
        Array.from(document.body.children).forEach(el => {
            el.inert = false;
        });
        document.getElementById('helpBtn')?.focus();
    }
    initHelpModal() {
        document.getElementById('helpBtn')?.addEventListener('click', () => this.openHelpModal());
        document.getElementById('helpModalClose')?.addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpModalBackdrop')?.addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpModal')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab')
                return;
            const dialog = document.querySelector('.help-modal-dialog');
            if (!dialog)
                return;
            const focusable = Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => el.getBoundingClientRect().width > 0);
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            }
            else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }
    initTheme() {
        const saved = this.cacheManager.loadPreference(this.cacheManager.CACHE_KEYS.THEME);
        const deviceDark = window.matchMedia?.('(prefers-color-scheme: dark)');
        const dark = saved === 'dark' || saved === 'light' ? saved === 'dark' : (deviceDark?.matches ?? false);
        this.uiManager.setDarkMode(dark);
        this.updateThemeButtonText();
        deviceDark?.addEventListener('change', (e) => {
            const chosen = this.cacheManager.loadPreference(this.cacheManager.CACHE_KEYS.THEME);
            if (chosen === 'dark' || chosen === 'light')
                return;
            this.uiManager.setDarkMode(e.matches);
            this.updateThemeButtonText();
        });
    }
    toggleTheme() {
        this.uiManager.toggleDarkMode();
        const isDark = document.body.classList.contains('dark-theme');
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.THEME, isDark ? 'dark' : 'light');
        this.updateThemeButtonText();
    }
    updateThemeButtonText() {
        const isDark = document.body.classList.contains('dark-theme');
        const icon = document.getElementById('themeToggleIcon');
        if (icon)
            icon.textContent = isDark ? '☀' : '☽';
        const label = document.getElementById('themeToggleLabel');
        if (label)
            label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
}
//# sourceMappingURL=ThemeHelpPart.js.map