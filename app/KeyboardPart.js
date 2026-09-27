import { CardActionsPart } from './CardActionsPart';
import { isDetailPanelOpen } from '../utils/detailPanel';
const SHORTCUTS_DISABLED_KEY = 'medtourney_shortcuts_disabled';
export class KeyboardPart extends CardActionsPart {
    constructor() {
        super(...arguments);
        this.shortcutsDisabled = localStorage.getItem(SHORTCUTS_DISABLED_KEY) === '1';
    }
    initKeyboardNavigation() {
        const toggle = document.getElementById('disableShortcutsToggle');
        if (toggle) {
            toggle.checked = this.shortcutsDisabled;
            toggle.addEventListener('change', () => {
                this.shortcutsDisabled = toggle.checked;
                localStorage.setItem(SHORTCUTS_DISABLED_KEY, toggle.checked ? '1' : '0');
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleHelpModal();
                return;
            }
            if (e.key === 'Escape') {
                const modal = document.getElementById('helpModal');
                if (modal && modal.style.display !== 'none') {
                    this.closeHelpModal();
                    return;
                }
                const quickSearch = document.getElementById('quickSearch');
                if (quickSearch && quickSearch.value) {
                    quickSearch.value = '';
                    this.searchWithinResults('');
                }
                return;
            }
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
                return;
            if (isDetailPanelOpen())
                return;
            if (e.ctrlKey || e.metaKey || e.altKey)
                return;
            if (this.shortcutsDisabled && e.key !== 'Escape')
                return;
            switch (e.key) {
                case '/': {
                    e.preventDefault();
                    const quickSearch = document.getElementById('quickSearch');
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
//# sourceMappingURL=KeyboardPart.js.map