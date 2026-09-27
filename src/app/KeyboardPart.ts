/**
 * TournamentFinder, part: KeyboardPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { CardActionsPart } from './CardActionsPart';
import { isDetailPanelOpen } from '../utils/detailPanel';

const SHORTCUTS_DISABLED_KEY = 'medtourney_shortcuts_disabled';

/** Single-key keyboard shortcuts. */
export abstract class KeyboardPart extends CardActionsPart {
    private shortcutsDisabled = localStorage.getItem(SHORTCUTS_DISABLED_KEY) === '1';

    protected initKeyboardNavigation(): void {
        const toggle = document.getElementById('disableShortcutsToggle') as HTMLInputElement | null;
        if (toggle) {
            toggle.checked = this.shortcutsDisabled;
            toggle.addEventListener('change', () => {
                this.shortcutsDisabled = toggle.checked;
                localStorage.setItem(SHORTCUTS_DISABLED_KEY, toggle.checked ? '1' : '0');
            });
        }

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // F1: Toggle help modal (works even while typing — a dedicated
            // function key has no conflicting "insert this character" use)
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleHelpModal();
                return;
            }

            // Escape: Close help modal first, then clear quick search
            if (e.key === 'Escape') {
                const modal = document.getElementById('helpModal');
                if (modal && modal.style.display !== 'none') {
                    this.closeHelpModal();
                    return;
                }
                const quickSearch = document.getElementById('quickSearch') as HTMLInputElement;
                if (quickSearch && quickSearch.value) {
                    quickSearch.value = '';
                    this.searchWithinResults('');
                }
                return;
            }

            // Remaining shortcuts are bare single keys, not Ctrl/Cmd
            // combinations — Ctrl/Cmd+D (bookmark), +S (save page) and +E
            // (address bar in Chrome) are browser shortcuts that a page
            // can't reliably override, so they never worked consistently.
            // Skip while typing, and skip if any modifier is held so the
            // browser's own shortcut still fires unmodified.
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (isDetailPanelOpen()) return; // the panel is modal: no page shortcuts behind it
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (this.shortcutsDisabled && e.key !== 'Escape') return;

            switch (e.key) {
                case '/': {
                    // Focus "filter results" — the closest thing this app has
                    // to a single search box.
                    e.preventDefault();
                    const quickSearch = document.getElementById('quickSearch') as HTMLInputElement | null;
                    quickSearch?.focus();
                    break;
                }
                case '?':
                    e.preventDefault();
                    this.toggleHelpModal();
                    break;
                case 'd':
                    e.preventDefault();
                    this.toggleTheme();
                    break;
                case 's': {
                    const exportShortlistBtn = document.getElementById('exportShortlistBtn');
                    if (exportShortlistBtn && exportShortlistBtn.style.display !== 'none') {
                        e.preventDefault();
                        void this.exportShortlistToCalendar();
                    }
                    break;
                }
                case 'e': {
                    const exportBtn = document.getElementById('exportBtn');
                    if (exportBtn && exportBtn.style.display !== 'none') {
                        e.preventDefault();
                        this.exportToCSV();
                    }
                    break;
                }
            }
        });
    }
}
