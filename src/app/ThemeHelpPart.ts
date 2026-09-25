/**
 * TournamentFinder, part: ThemeHelpPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { AppState } from './AppState';

/** Help modal and light/dark theme. */
export abstract class ThemeHelpPart extends AppState {
    protected openHelpModal(): void {
        const modal = document.getElementById('helpModal');
        if (!modal) return;
        // Inert all sibling body children so background is unreachable (A2)
        Array.from(document.body.children).forEach(el => {
            if (el.id !== 'helpModal' && el.tagName !== 'SCRIPT') {
                (el as HTMLElement).inert = true;
            }
        });
        modal.style.display = 'flex';
        modal.removeAttribute('hidden');
        document.getElementById('helpModalClose')?.focus();
        this.trackEvent('Help Opened');
    }

    protected toggleHelpModal(): void {
        const modal = document.getElementById('helpModal');
        if (modal && modal.style.display !== 'none') {
            this.closeHelpModal();
        } else {
            this.openHelpModal();
        }
    }

    protected closeHelpModal(): void {
        const modal = document.getElementById('helpModal');
        if (!modal) return;
        modal.style.display = 'none';
        // Restore background interactivity (A2)
        Array.from(document.body.children).forEach(el => {
            (el as HTMLElement).inert = false;
        });
        document.getElementById('helpBtn')?.focus();
    }

    protected initHelpModal(): void {
        document.getElementById('helpBtn')?.addEventListener('click', () => this.openHelpModal());
        document.getElementById('helpModalClose')?.addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpModalBackdrop')?.addEventListener('click', () => this.closeHelpModal());

        // Focus trap: keep Tab/Shift+Tab inside the modal dialog (A1)
        document.getElementById('helpModal')?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const dialog = document.querySelector('.help-modal-dialog');
            if (!dialog) return;
            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(
                    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            ).filter(el => el.getBoundingClientRect().width > 0);
            if (focusable.length === 0) return;
            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    /**
     * Initialize theme (dark mode)
     */
    /**
     * Theme: the person's own choice if they made one (☾/☀ button), otherwise
     * the device's light/dark setting - followed live until they choose.
     * public/theme-init.js has already applied the same rule before first
     * paint (the CSP allows no inline script), so this only syncs the button
     * and listens for device changes.
     */
    protected initTheme(): void {
        const saved = this.cacheManager.loadPreference<string>(this.cacheManager.CACHE_KEYS.THEME);
        const deviceDark = window.matchMedia?.('(prefers-color-scheme: dark)');
        const dark = saved === 'dark' || saved === 'light' ? saved === 'dark' : (deviceDark?.matches ?? false);
        this.uiManager.setDarkMode(dark);
        this.updateThemeButtonText();

        deviceDark?.addEventListener('change', (e) => {
            const chosen = this.cacheManager.loadPreference<string>(this.cacheManager.CACHE_KEYS.THEME);
            if (chosen === 'dark' || chosen === 'light') return; // their choice wins
            this.uiManager.setDarkMode(e.matches);
            this.updateThemeButtonText();
        });
    }

    /**
     * Toggle dark/light theme
     */
    protected toggleTheme(): void {
        this.uiManager.toggleDarkMode();

        // Save theme preference
        const isDark = document.body.classList.contains('dark-theme');
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.THEME, isDark ? 'dark' : 'light');

        this.updateThemeButtonText();
    }

    /**
     * Update theme button text
     */
    protected updateThemeButtonText(): void {
        const isDark = document.body.classList.contains('dark-theme');
        const icon = document.getElementById('themeToggleIcon');
        if (icon) icon.textContent = isDark ? '☀' : '☽'; // sun / crescent moon
        const label = document.getElementById('themeToggleLabel');
        if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
}
