/**
 * Chess Tournament Finder - Main Application (Refactored)
 * Fetches and displays tournaments from chess-results.com
 *
 * @author MedTourney Project
 * @version 3.0.0 (Modular Architecture with Service Layers)
 */

import { Tournament, FilterState } from './types';

declare global {
    interface Window {
        plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
    }
}
import { CacheManager } from './services/CacheManager';
import { FilterService } from './services/FilterService';
import { DataService } from './services/DataService';
import { ExportService } from './services/ExportService';
import { UIManager } from './services/UIManager';
import type { MapView } from './services/MapView';
import { FilterSheet } from './services/FilterSheet';
import { Logger } from './utils/Logger';
import { escapeHTML } from './utils/html';
import { filterStateToSearchParams, filterStateFromSearchParams, FILTER_PARAM_KEYS } from './utils/filterUrl';

/** Sort options for tournaments */
type SortOption = 'date-asc' | 'date-desc' | 'name' | 'location' | 'country';

/** HTML element map for type safety */
interface FilterElements {
    openOnly: HTMLInputElement | null;
    excludeYouth: HTMLInputElement | null;
    mediterraneanOnly: HTMLInputElement | null;
    seniorCategory: HTMLInputElement | null;
    womenOnly: HTMLInputElement | null;
    includeTeamTournaments: HTMLInputElement | null;
    classicalTime: HTMLInputElement | null;
    rapidTime: HTMLInputElement | null;
    blitzTime: HTMLInputElement | null;
    startDate: HTMLInputElement | null;
    endDate: HTMLInputElement | null;
    minDays: HTMLSelectElement | null;
    seniorS60: HTMLInputElement | null;
    youthCategory: HTMLSelectElement | null;
    ratingCategory: HTMLSelectElement | null;
}

/**
 * Main application class for finding chess tournaments
 * Coordinates between service modules
 */
class TournamentFinder {
    // Service modules
    private readonly cacheManager: CacheManager;
    private readonly filterService: FilterService;
    private readonly dataService: DataService;
    private readonly exportService: ExportService;
    private readonly uiManager: UIManager;
    private readonly logger = Logger.createScoped('TournamentFinder');

    // Configuration
    private europeanCountries: Record<string, string[]>;
    private mediterraneanLocations: Set<string>;
    private mediterraneanCountries: Set<string>;

    // Tournament data
    // - allTournaments: the full fetched set (used for shortlist resolution)
    // - filteredTournaments: after filters + sort + annotation
    // - displayedTournaments: what the user actually sees, after the
    //   shortlist-only toggle and quick-search are applied (this is what
    //   CSV export operates on)
    private allTournaments: Tournament[];
    private filteredTournaments: Tournament[];
    private displayedTournaments: Tournament[];

    // Sorting state
    private currentSort: SortOption;

    // Shortlist (persisted to localStorage)
    private shortlist: Set<string>;
    private readonly SHORTLIST_KEY = 'medtourney_shortlist';

    // Display state
    private showShortlistOnly = false;
    private currentQuickSearch = '';

    // Deep-link: URL of tournament to highlight after next search (?t= param)
    private deepLinkUrl: string | null = null;
    private headerDateLabel: string | null = null;
    private countrySearchQuery = '';
    private lastEmptyStateRelaxations: { label: string; count: number; apply: () => void }[] = [];
    private mapView: MapView | null = null;
    private filterSheet: FilterSheet | null = null;
    private currentView: 'list' | 'map' = 'list';

    constructor() {
        // Initialize service modules
        this.cacheManager = new CacheManager();
        this.filterService = new FilterService();
        this.dataService = new DataService(this.cacheManager);
        this.exportService = new ExportService();
        this.uiManager = new UIManager();
        this.uiManager.initViewportOffsetFix();

        this.allTournaments = [];
        this.filteredTournaments = [];
        this.displayedTournaments = [];
        this.currentSort = 'date-asc';
        this.shortlist = new Set();

        // Will be loaded from config.json
        this.europeanCountries = {};
        this.mediterraneanLocations = new Set();
        this.mediterraneanCountries = new Set();

        // Initialize after loading config
        void this.initAsync();
    }

    /**
     * Asynchronous initialization
     * Loads configuration and sets up event listeners
     */
    private async initAsync(): Promise<void> {
        try {
            // Initialize theme
            this.initTheme();

            // Initialize collapsible filters
            this.initCollapsibleFilters();

            // Load configuration
            await this.loadConfig();

            // Set default dates (today to 6 months from now, matching the scraper horizon)
            const today = new Date();
            const sixMonthsLater = new Date(today);
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

            const startDateElement = document.getElementById('startDate') as HTMLInputElement | null;
            const endDateElement = document.getElementById('endDate') as HTMLInputElement | null;

            if (startDateElement) startDateElement.valueAsDate = today;
            if (endDateElement) endDateElement.valueAsDate = sixMonthsLater;

            // Load saved filter preferences (URL takes priority over cache)
            this.loadFilterPreferences();
            this.syncFilterStateToURL();

            // Reflect any non-default advanced filters in the drawer badge,
            // and auto-open the drawer if a saved preference narrows results.
            this.updateAdvancedFilterCount();

            // Load shortlist from localStorage
            this.loadShortlist();
            this.uiManager.updateShortlistCount(this.shortlist.size);

            // If the user returns with a saved shortlist, preload tournament
            // data in the background so "Export Shortlist" works immediately
            // after a reload (without forcing them to run a search first).
            if (this.shortlist.size > 0) {
                void this.preloadTournamentData();
            }

            // Attach event listeners
            this.attachEventListeners();

            // Initialize keyboard navigation
            this.initKeyboardNavigation();

            // Display last updated time from cache, then refine from meta file
            this.displayLastUpdated();
            void this.checkDataStaleness();

            // Handle deep-link: ?t=<encoded tournament URL>
            const linkedUrl = new URLSearchParams(location.search).get('t');
            if (linkedUrl) {
                this.deepLinkUrl = linkedUrl;
                void this.searchTournaments();
            } else {
                // Results-first: run the default 6-month search immediately
                // instead of waiting for the user to find and click Search.
                void this.searchTournaments();
            }

        } catch (error) {
            this.logger.error('Application initialization failed', error);
            this.uiManager.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Attach all event listeners
     */
    private attachEventListeners(): void {
        document.getElementById('showResultsBtn')?.addEventListener('click', () => {
            this.filterSheet?.hide(false); // phones: it's the sheet's "done" button
            this.uiManager.scrollToResults();
        });
        this.initFilterSheet();

        document.querySelectorAll<HTMLButtonElement>('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => void this.setView(btn.dataset.view === 'map' ? 'map' : 'list'));
        });

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }

        // Sort dropdown
        const sortSelect = document.getElementById('sortBy') as HTMLSelectElement;
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                this.handleSortChange(target.value as SortOption);
            });
        }

        // Quick search input
        const quickSearch = document.getElementById('quickSearch') as HTMLInputElement;
        if (quickSearch) {
            quickSearch.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                this.searchWithinResults(target.value);
            });
        }

        // Type-to-filter the country checklist (doesn't touch tournament
        // filtering/results - only narrows which checkboxes are shown).
        const countrySearch = document.getElementById('countrySearch') as HTMLInputElement | null;
        if (countrySearch) {
            countrySearch.addEventListener('input', (e) => {
                this.countrySearchQuery = (e.target as HTMLInputElement).value;
                this.applyCountrySearchFilter();
            });
        }

        // Attach filter change listeners to save preferences
        this.attachFilterChangeListeners();

        // Seaside/Senior mode switch — the review's "front door" control
        this.initModeSwitch();
        this.syncModeSwitch();

        // Delegated calendar export — one listener handles all pages/re-renders
        this.initCalendarExportDelegation();

        // Delegated shortlist toggle
        this.initShortlistDelegation();

        // Delegated copy-link button
        this.initCopyLinkDelegation();

        // Delegated whole-card click — opens the tournament's chess-results.com
        // page, matching users' expectation that the card itself is clickable
        this.initTournamentCardClickDelegation();

        // Delegated one-tap relaxation buttons (rendered inside empty state)
        this.initEmptyStateRelaxationDelegation();

        // Delegated reset-filters button (rendered inside empty state)
        document.addEventListener('click', (e) => {
            if ((e.target as Element).closest('#resetFiltersBtn')) {
                this.resetFilters();
            }
        });

        // Clear all filters button (always-visible in filter panel header)
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            this.resetFilters();
        });

        // Clear countries button (shown only when ≥1 country is checked)
        document.getElementById('clearCountriesBtn')?.addEventListener('click', () => {
            document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked').forEach(cb => {
                cb.checked = false;
            });
            this.updateCountryFilterSummary();
            this.saveFilterPreferences();
            void this.searchTournaments();
            this.trackEvent('Clear Countries');
        });

        // Date preset buttons
        this.initDatePresets();

        // Show shortlist only toggle
        const showShortlistOnlyEl = document.getElementById('showShortlistOnly') as HTMLInputElement | null;
        if (showShortlistOnlyEl) {
            showShortlistOnlyEl.addEventListener('change', () => {
                this.showShortlistOnly = showShortlistOnlyEl.checked;
                this.applyDisplayFilters();
            });
        }

        // Export shortlist to ICS
        const exportShortlistBtn = document.getElementById('exportShortlistBtn');
        if (exportShortlistBtn) {
            exportShortlistBtn.addEventListener('click', () => void this.exportShortlistToCalendar());
        }

        // Help modal
        this.initHelpModal();
    }

    private openHelpModal(): void {
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

    private toggleHelpModal(): void {
        const modal = document.getElementById('helpModal');
        if (modal && modal.style.display !== 'none') {
            this.closeHelpModal();
        } else {
            this.openHelpModal();
        }
    }

    private closeHelpModal(): void {
        const modal = document.getElementById('helpModal');
        if (!modal) return;
        modal.style.display = 'none';
        // Restore background interactivity (A2)
        Array.from(document.body.children).forEach(el => {
            (el as HTMLElement).inert = false;
        });
        document.getElementById('helpBtn')?.focus();
    }

    private initHelpModal(): void {
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
     * Load configuration from config.json
     */
    private async loadConfig(): Promise<void> {
        try {
            const config = await this.dataService.loadConfig();

            // Convert arrays to Sets and Maps
            this.mediterraneanLocations = new Set(config.mediterraneanLocations);

            // Convert country codes to Map
            this.europeanCountries = {};
            for (const [code, data] of Object.entries(config.countryCodes)) {
                this.europeanCountries[code] = data.keywords;
            }

            this.logger.info('Configuration loaded successfully', {
                mediterraneanLocationsCount: config.mediterraneanLocations.length,
                countryCodesCount: Object.keys(config.countryCodes).length
            });
        } catch (error) {
            this.logger.error('Failed to load configuration', error);
            this.uiManager.showError('Failed to load configuration. Some filters may not work correctly.');
        }
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
    private initTheme(): void {
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
    private toggleTheme(): void {
        this.uiManager.toggleDarkMode();

        // Save theme preference
        const isDark = document.body.classList.contains('dark-theme');
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.THEME, isDark ? 'dark' : 'light');

        this.updateThemeButtonText();
    }

    /**
     * Update theme button text
     */
    private updateThemeButtonText(): void {
        const isDark = document.body.classList.contains('dark-theme');
        const icon = document.getElementById('themeToggleIcon');
        if (icon) icon.textContent = isDark ? '☀' : '☽'; // sun / crescent moon
        const label = document.getElementById('themeToggleLabel');
        if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    /**
     * Initialize collapsible filters
     */
    /** Phones: filters in a bottom sheet (see FilterSheet). */
    private initFilterSheet(): void {
        const card = document.getElementById('filtersSheet');
        const bar = document.getElementById('openFiltersBtn') as HTMLButtonElement | null;
        const backdrop = document.getElementById('sheetBackdrop');
        const slot = document.getElementById('mobileQuickFilters');
        const movables = [document.querySelector<HTMLElement>('.mode-switch'), document.getElementById('activeFilterChips')]
            .filter((el): el is HTMLElement => el !== null);
        if (!card || !bar || !backdrop || !slot) return;
        this.filterSheet = new FilterSheet(card, bar, backdrop, slot, movables, card.querySelector('h2'));
        this.filterSheet.init();
    }

    private initCollapsibleFilters(): void {
        const filtersCard = document.querySelector('.filters-card');
        const savedState = this.cacheManager.loadPreference<string>(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED);

        if (savedState === 'collapsed' && filtersCard) {
            filtersCard.classList.add('collapsed');
            filtersCard.setAttribute('aria-expanded', 'false');
        }

        const filterTitle = document.querySelector('.filters-card h2') as HTMLElement | null;
        if (filterTitle && filtersCard) {
            // Make the heading an operable, keyboard-accessible toggle button
            // (WCAG 2.1.1 Keyboard + 4.1.2 Name, Role, Value).
            filterTitle.style.cursor = 'pointer';
            filterTitle.setAttribute('role', 'button');
            filterTitle.setAttribute('tabindex', '0');
            const startCollapsed = filtersCard.classList.contains('collapsed');
            filterTitle.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');

            const toggleFilters = (): void => {
                // Phones: the card is a bottom sheet (FilterSheet), not collapsible
                if (filtersCard.classList.contains('filters-card--sheet')) return;
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                const expanded = isCollapsed ? 'false' : 'true';
                filtersCard.setAttribute('aria-expanded', expanded);
                filterTitle.setAttribute('aria-expanded', expanded);

                // Save state
                this.cacheManager.savePreference(
                    this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED,
                    isCollapsed ? 'collapsed' : 'expanded'
                );
            };

            filterTitle.addEventListener('click', toggleFilters);
            filterTitle.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleFilters();
                }
            });
        }
    }

    /**
     * Load saved filter preferences: a URL carrying filter params (a shared
     * link) takes priority over the localStorage prefs from a previous visit,
     * since a shared link is an explicit request for that exact view.
     */
    private loadFilterPreferences(): void {
        const fromUrl = filterStateFromSearchParams(new URLSearchParams(location.search));
        if (fromUrl) {
            this.applyFilterPreferences(fromUrl);
            return;
        }

        const preferences = this.cacheManager.loadPreference<Partial<FilterState>>(
            this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES
        );

        if (!preferences) return;
        this.applyFilterPreferences(preferences);
    }

    /**
     * Apply a partial filter state (from localStorage or the URL) to the
     * actual filter DOM elements, which are what getFilterState() reads back.
     */
    private applyFilterPreferences(preferences: Partial<FilterState>): void {
        const filterElements = this.getFilterElements();

        if (preferences.openOnly !== undefined && filterElements.openOnly) {
            filterElements.openOnly.checked = preferences.openOnly;
        }
        if (preferences.excludeYouth !== undefined && filterElements.excludeYouth) {
            filterElements.excludeYouth.checked = preferences.excludeYouth;
        }
        if (preferences.mediterraneanOnly !== undefined && filterElements.mediterraneanOnly) {
            filterElements.mediterraneanOnly.checked = preferences.mediterraneanOnly;
        }
        if (preferences.seniorCategory !== undefined && filterElements.seniorCategory) {
            filterElements.seniorCategory.checked = preferences.seniorCategory;
        }
        if (preferences.womenOnly !== undefined && filterElements.womenOnly) {
            filterElements.womenOnly.checked = preferences.womenOnly;
        }
        if (preferences.includeTeamTournaments !== undefined && filterElements.includeTeamTournaments) {
            filterElements.includeTeamTournaments.checked = preferences.includeTeamTournaments;
        }
        if (preferences.classicalTime !== undefined && filterElements.classicalTime) {
            filterElements.classicalTime.checked = preferences.classicalTime;
        }
        if (preferences.rapidTime !== undefined && filterElements.rapidTime) {
            filterElements.rapidTime.checked = preferences.rapidTime;
        }
        if (preferences.blitzTime !== undefined && filterElements.blitzTime) {
            filterElements.blitzTime.checked = preferences.blitzTime;
        }
        if (Array.isArray(preferences.countryFilter) && preferences.countryFilter.length > 0) {
            preferences.countryFilter.forEach((code: string) => {
                const cb = document.querySelector<HTMLInputElement>(
                    `input[name="countryFilter"][value="${code}"]`
                );
                if (cb) cb.checked = true;
            });
            this.updateCountryFilterSummary();
        }
        if (preferences.minDays !== undefined && filterElements.minDays) {
            filterElements.minDays.value = String(preferences.minDays);
        }
        if (preferences.seniorS60 !== undefined && filterElements.seniorS60) {
            filterElements.seniorS60.checked = preferences.seniorS60;
        }
        if (preferences.youthCategory !== undefined && filterElements.youthCategory) {
            filterElements.youthCategory.value = preferences.youthCategory;
        }
        if (preferences.ratingCategory !== undefined && filterElements.ratingCategory) {
            filterElements.ratingCategory.value = preferences.ratingCategory;
        }
    }

    /**
     * Save current filter preferences
     */
    private saveFilterPreferences(): void {
        const filterState = this.getFilterState();
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }

    /**
     * Mirror the current filter state into the URL (replacing history, not
     * pushing - every checkbox click shouldn't add a back-button stop) so the
     * current view can be shared or bookmarked. Preserves unrelated params
     * (like the ?t= deep link) untouched.
     */
    private syncFilterStateToURL(): void {
        const filterParams = filterStateToSearchParams(this.getFilterState());

        const url = new URL(location.href);
        FILTER_PARAM_KEYS.forEach(key => url.searchParams.delete(key));
        filterParams.forEach((value, key) => url.searchParams.set(key, value));

        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    /**
     * Attach listeners to filter inputs to auto-save preferences
     */
    private attachFilterChangeListeners(): void {
        const filterElements = this.getFilterElements();
        const onFilterChange = () => this.handleFilterChange();

        // Attach to all filter inputs so country list updates on every filter change
        Object.values(filterElements).forEach(element => {
            if (element) {
                element.addEventListener('change', onFilterChange);
            }
        });

        // Country checkboxes — delegated on their container
        const countryList = document.getElementById('countryList');
        if (countryList) {
            countryList.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.classList.contains('country-group-toggle')) {
                    this.applyCountryGroupToggle(target);
                }
                onFilterChange();
                this.syncCountryGroupToggles();
            });
        }
    }

    /**
     * Runs on every filter input's change event, and on a mode-switch click:
     * persist, reflect in the URL, keep the drawer badge and mode switch in
     * sync, and re-render live (no Search click needed) once data exists.
     */
    private handleFilterChange(): void {
        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.updateAdvancedFilterCount();
        this.syncModeSwitch();
        if (this.allTournaments.length > 0) this.applyFiltersAndRender();
    }

    /**
     * The "All Europe / Seaside / Senior 50+ / Both" segmented control is a
     * convenience front door onto the existing mediterraneanOnly + seniorCategory
     * checkboxes (which stay the source of truth, still directly reachable -
     * seniorCategory lives in the "More filters" drawer for anyone who wants
     * just that one control). Clicking a mode sets both checkboxes at once;
     * syncModeSwitch() keeps the segmented control's active state honest when
     * the checkboxes change some other way (drawer, URL load, reset).
     */
    private initModeSwitch(): void {
        document.querySelectorAll<HTMLButtonElement>('.mode-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode ?? 'all';
                this.setCheckbox('mediterraneanOnly', mode === 'seaside' || mode === 'both');
                this.setCheckbox('seniorCategory', mode === 'senior' || mode === 'both');
                this.handleFilterChange();
                this.trackEvent('Mode Switch', { mode });
            });
        });
    }

    private syncModeSwitch(): void {
        const med = (document.getElementById('mediterraneanOnly') as HTMLInputElement | null)?.checked ?? false;
        const senior = (document.getElementById('seniorCategory') as HTMLInputElement | null)?.checked ?? false;
        const mode = med && senior ? 'both' : med ? 'seaside' : senior ? 'senior' : 'all';

        document.querySelectorAll<HTMLButtonElement>('.mode-switch-btn').forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }

    private setCheckbox(id: string, checked: boolean): void {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.checked = checked;
    }

    private setSelectValue(id: string, value: string): void {
        const el = document.getElementById(id) as HTMLSelectElement | null;
        if (el) el.value = value;
    }

    private minDaysChipLabel(minDays: FilterState['minDays']): string {
        switch (minDays) {
            case 'just-weekend': return 'Weekend only';
            case 'weekend': return 'Long weekend';
            case 5: return '5+ days';
            case 7: return '1+ week';
            case 14: return '2+ weeks';
            default: return `${minDays}+ days`;
        }
    }

    /** Build removable active-filter chip descriptors from the current filter state. */
    private buildActiveFilterChips(): { label: string; clear: () => void }[] {
        const s = this.getFilterState();
        const chips: { label: string; clear: () => void }[] = [];

        if (s.mediterraneanOnly) chips.push({ label: '🌊 Seaside', clear: () => this.setCheckbox('mediterraneanOnly', false) });
        if (s.seniorCategory) chips.push({ label: 'Senior 50+', clear: () => this.setCheckbox('seniorCategory', false) });
        if (s.seniorS60) chips.push({ label: 'Senior 60+', clear: () => this.setCheckbox('seniorS60', false) });
        if (s.womenOnly) chips.push({ label: "Women's", clear: () => this.setCheckbox('womenOnly', false) });
        if (s.includeTeamTournaments) chips.push({ label: 'Team tournaments', clear: () => this.setCheckbox('includeTeamTournaments', false) });
        if (!s.openOnly) chips.push({ label: 'Open category off', clear: () => this.setCheckbox('openOnly', true) });
        if (!s.excludeYouth) chips.push({ label: 'Youth-only included', clear: () => this.setCheckbox('excludeYouth', true) });

        const tcOff = [!s.classicalTime && 'Classical', !s.rapidTime && 'Rapid', !s.blitzTime && 'Blitz']
            .filter((v): v is string => Boolean(v));
        if (tcOff.length > 0) {
            chips.push({
                label: `${tcOff.join('/')} off`,
                clear: () => {
                    this.setCheckbox('classicalTime', true);
                    this.setCheckbox('rapidTime', true);
                    this.setCheckbox('blitzTime', true);
                }
            });
        }

        if (s.countryFilter.length > 0) {
            const count = s.countryFilter.length;
            chips.push({
                label: `${count} ${count === 1 ? 'country' : 'countries'}`,
                clear: () => {
                    document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
                        .forEach(cb => { cb.checked = false; });
                    this.updateCountryFilterSummary();
                }
            });
        }

        if (s.minDays !== 0) {
            chips.push({ label: this.minDaysChipLabel(s.minDays), clear: () => this.setSelectValue('minDays', '0') });
        }
        if (s.youthCategory) chips.push({ label: s.youthCategory, clear: () => this.setSelectValue('youthCategory', '') });
        if (s.ratingCategory) chips.push({ label: s.ratingCategory, clear: () => this.setSelectValue('ratingCategory', '') });

        return chips;
    }

    /** Render (or hide) the active-filter chip row above the results, wiring each chip's one-tap removal. */
    private renderActiveFilterChips(): void {
        const container = document.getElementById('activeFilterChips');
        if (!container) return;

        const chips = this.buildActiveFilterChips();
        this.filterSheet?.setCount(chips.length);
        if (chips.length === 0) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = chips.map((chip, i) => `
            <button type="button" class="active-filter-chip" data-chip-index="${i}">
                ${escapeHTML(chip.label)}
                <span aria-hidden="true">&times;</span>
                <span class="sr-only">Remove filter: ${escapeHTML(chip.label)}</span>
            </button>
        `).join('') + '<button type="button" class="active-filter-clear-all">Clear all</button>';

        container.querySelectorAll<HTMLButtonElement>('.active-filter-chip').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                chips[i]!.clear();
                this.handleFilterChange();
            });
        });
        container.querySelector('.active-filter-clear-all')?.addEventListener('click', () => this.resetFilters());
    }

    /**
     * Get all filter element references
     */
    private getFilterElements(): FilterElements {
        return {
            openOnly: document.getElementById('openOnly') as HTMLInputElement | null,
            excludeYouth: document.getElementById('excludeYouth') as HTMLInputElement | null,
            mediterraneanOnly: document.getElementById('mediterraneanOnly') as HTMLInputElement | null,
            seniorCategory: document.getElementById('seniorCategory') as HTMLInputElement | null,
            womenOnly: document.getElementById('womenOnly') as HTMLInputElement | null,
            includeTeamTournaments: document.getElementById('includeTeamTournaments') as HTMLInputElement | null,
            classicalTime: document.getElementById('classicalTime') as HTMLInputElement | null,
            rapidTime: document.getElementById('rapidTime') as HTMLInputElement | null,
            blitzTime: document.getElementById('blitzTime') as HTMLInputElement | null,
            startDate: document.getElementById('startDate') as HTMLInputElement | null,
            endDate: document.getElementById('endDate') as HTMLInputElement | null,
            minDays: document.getElementById('minDays') as HTMLSelectElement | null,
            seniorS60: document.getElementById('seniorS60') as HTMLInputElement | null,
            youthCategory: document.getElementById('youthCategory') as HTMLSelectElement | null,
            ratingCategory: document.getElementById('ratingCategory') as HTMLSelectElement | null,
        };
    }

    /**
     * Count the "More filters" drawer controls that differ from their
     * defaults, show it in the summary badge, and auto-open the drawer when
     * the count is > 0 so an active advanced filter never narrows the
     * results invisibly behind a collapsed disclosure.
     */
    private updateAdvancedFilterCount(): void {
        const el = this.getFilterElements();
        let count = 0;

        // openOnly and excludeYouth ship checked, so "active" means unchecked.
        if (el.openOnly && !el.openOnly.checked) count++;
        if (el.excludeYouth && !el.excludeYouth.checked) count++;
        if (el.womenOnly?.checked) count++;
        if (el.includeTeamTournaments?.checked) count++;
        if (el.seniorCategory?.checked) count++;
        if (el.seniorS60?.checked) count++;
        if (el.ratingCategory?.value) count++;
        if (el.youthCategory?.value) count++;
        if (el.minDays && el.minDays.value !== '0') count++;
        if (document.querySelectorAll('input[name="countryFilter"]:checked').length > 0) count++;

        const badge = document.getElementById('advancedFilterCount');
        if (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
        }

        const details = document.getElementById('advancedFilters') as HTMLDetailsElement | null;
        if (details && count > 0) {
            details.open = true;
        }
    }

    /**
     * Get current filter state from UI
     */
    private getFilterState(): FilterState {
        const elements = this.getFilterElements();

        return {
            openOnly: elements.openOnly?.checked ?? true,
            excludeYouth: elements.excludeYouth?.checked ?? true,
            mediterraneanOnly: elements.mediterraneanOnly?.checked ?? false,
            seniorCategory: elements.seniorCategory?.checked ?? false,
            womenOnly: elements.womenOnly?.checked ?? false,
            includeTeamTournaments: elements.includeTeamTournaments?.checked ?? false,
            classicalTime: elements.classicalTime?.checked ?? true,
            rapidTime: elements.rapidTime?.checked ?? true,
            blitzTime: elements.blitzTime?.checked ?? true,
            startDate: elements.startDate?.valueAsDate ?? null,
            endDate: elements.endDate?.valueAsDate ?? null,
            countryFilter: Array.from(
                document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
            ).map(cb => cb.value),
            minDays: elements.minDays?.value === 'weekend' ? 'weekend'
                : elements.minDays?.value === 'just-weekend' ? 'just-weekend'
                : (parseInt(elements.minDays?.value ?? '0', 10) || 0),
            seniorS60: elements.seniorS60?.checked ?? false,
            youthCategory: elements.youthCategory?.value ?? '',
            ratingCategory: elements.ratingCategory?.value ?? '',
        };
    }

    private trackEvent(event: string, props?: Record<string, string | number | boolean>): void {
        window.plausible?.(event, props ? { props } : undefined);
    }

    private activeFilterSummary(): string {
        const s = this.getFilterState();
        const parts: string[] = [];
        if (s.mediterraneanOnly) parts.push('mediterranean');
        if (s.seniorCategory) parts.push('senior50');
        if (s.seniorS60) parts.push('senior60');
        if (s.womenOnly) parts.push('women');
        if (s.youthCategory) parts.push(`youth_${s.youthCategory}`);
        if (s.countryFilter.length > 0) parts.push(`country_${s.countryFilter.join('+')}`)
        if (s.minDays !== 0) parts.push(`duration_${String(s.minDays)}`);
        return parts.join(',') || 'none';
    }

    /**
     * Build one-tap "relax this filter" options for the empty state, each
     * with the actual result count that relaxation would produce (computed
     * by re-running FilterService against the full unfiltered set, never the
     * live UI) - "show 3+ days (12)" beats a plain "reduce minimum duration"
     * tip because the number tells you whether it's worth tapping at all.
     * Sorted biggest-win first and capped so the list stays scannable.
     */
    private buildEmptyStateRelaxations(): { label: string; count: number; apply: () => void; lead?: boolean }[] {
        const base = this.getFilterState();
        const filtered = (partial: Partial<FilterState> = {}): Tournament[] =>
            this.filterService.filterTournaments(this.allTournaments, { ...base, ...partial }, this.mediterraneanLocations);
        // Counts include the search box and "Shortlist only", exactly as the list would
        const countWith = (partial: Partial<FilterState>): number => this.narrowForDisplay(filtered(partial)).length;

        const relaxations: { label: string; count: number; apply: () => void; lead?: boolean }[] = [];

        // When the search text or "Shortlist only" is what empties the list,
        // undoing that is the obvious first fix
        const search = this.currentQuickSearch.trim();
        if (search) {
            relaxations.push({
                label: `Clear search "${search}"`,
                count: this.narrowForDisplay(filtered(), '').length,
                apply: () => this.clearQuickSearch(),
                lead: true,
            });
        }
        if (this.showShortlistOnly) {
            relaxations.push({
                label: 'Show all, not just the shortlist',
                count: this.narrowForDisplay(filtered(), this.currentQuickSearch, false).length,
                apply: () => this.setShortlistOnly(false),
                lead: true,
            });
        }

        if (base.mediterraneanOnly) {
            relaxations.push({
                label: 'Show all of Europe, not just seaside',
                count: countWith({ mediterraneanOnly: false }),
                apply: () => this.setCheckbox('mediterraneanOnly', false)
            });
        }
        if (base.seniorCategory) {
            relaxations.push({
                label: 'Include non-senior tournaments',
                count: countWith({ seniorCategory: false }),
                apply: () => this.setCheckbox('seniorCategory', false)
            });
        }
        if (base.seniorS60) {
            relaxations.push({
                label: 'Include S50+ as well as S60+',
                count: countWith({ seniorS60: false }),
                apply: () => this.setCheckbox('seniorS60', false)
            });
        }
        if (base.womenOnly) {
            relaxations.push({
                label: "Include all tournaments, not just women's",
                count: countWith({ womenOnly: false }),
                apply: () => this.setCheckbox('womenOnly', false)
            });
        }
        if (!base.openOnly) {
            relaxations.push({
                label: 'Re-enable Open Category Only',
                count: countWith({ openOnly: true }),
                apply: () => this.setCheckbox('openOnly', true)
            });
        }
        if (base.countryFilter.length > 0) {
            relaxations.push({
                label: `Clear the country filter (${base.countryFilter.length} selected)`,
                count: countWith({ countryFilter: [] }),
                apply: () => {
                    document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
                        .forEach(cb => { cb.checked = false; });
                    this.updateCountryFilterSummary();
                }
            });
        }
        if (base.ratingCategory) {
            relaxations.push({
                label: `Remove the ${base.ratingCategory} rating ceiling`,
                count: countWith({ ratingCategory: '' }),
                apply: () => this.setSelectValue('ratingCategory', '')
            });
        }
        if (base.youthCategory) {
            relaxations.push({
                label: `Remove the ${base.youthCategory} youth age filter`,
                count: countWith({ youthCategory: '' }),
                apply: () => this.setSelectValue('youthCategory', '')
            });
        }
        if (!base.classicalTime || !base.rapidTime || !base.blitzTime) {
            relaxations.push({
                label: 'Include all time controls',
                count: countWith({ classicalTime: true, rapidTime: true, blitzTime: true }),
                apply: () => {
                    this.setCheckbox('classicalTime', true);
                    this.setCheckbox('rapidTime', true);
                    this.setCheckbox('blitzTime', true);
                }
            });
        }
        if (base.minDays !== 0) {
            relaxations.push({
                label: 'Remove the minimum-duration filter',
                count: countWith({ minDays: 0 }),
                apply: () => this.setSelectValue('minDays', '0')
            });
        }
        if (base.endDate) {
            const extended = new Date(base.endDate);
            extended.setMonth(extended.getMonth() + 1);
            relaxations.push({
                label: 'Extend the date range by a month',
                count: countWith({ endDate: extended }),
                apply: () => {
                    const endDateEl = document.getElementById('endDate') as HTMLInputElement | null;
                    if (endDateEl) endDateEl.valueAsDate = extended;
                }
            });
        }

        return relaxations
            .filter(r => r.count > 0)
            .sort((a, b) => Number(b.lead ?? false) - Number(a.lead ?? false) || b.count - a.count)
            .slice(0, 4);
    }

    private clearQuickSearch(): void {
        this.currentQuickSearch = '';
        const input = document.getElementById('quickSearch') as HTMLInputElement | null;
        if (input) input.value = '';
    }

    private setShortlistOnly(on: boolean): void {
        this.showShortlistOnly = on;
        const toggle = document.getElementById('showShortlistOnly') as HTMLInputElement | null;
        if (toggle) toggle.checked = on;
    }

    /**
     * Delegated click handler for the empty state's one-tap relaxation
     * buttons - #tournamentList is a stable container across re-renders, so
     * this is wired once rather than re-attached every time the empty state
     * itself is rebuilt.
     */
    private initEmptyStateRelaxationDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest<HTMLButtonElement>('.empty-state-relaxation-btn');
            if (!btn) return;
            const index = Number(btn.dataset.relaxationIndex);
            const relaxation = this.lastEmptyStateRelaxations[index];
            if (!relaxation) return;
            relaxation.apply();
            this.handleFilterChange();
        });
    }

    /** Reset all filter inputs to their default values and re-run the search. */
    private resetFilters(): void {
        const el = this.getFilterElements();
        if (el.openOnly)              el.openOnly.checked              = true;
        if (el.excludeYouth)          el.excludeYouth.checked          = true;
        if (el.mediterraneanOnly)     el.mediterraneanOnly.checked     = false;
        if (el.seniorCategory)        el.seniorCategory.checked        = false;
        if (el.seniorS60)             el.seniorS60.checked             = false;
        if (el.womenOnly)             el.womenOnly.checked             = false;
        if (el.includeTeamTournaments) el.includeTeamTournaments.checked = false;
        if (el.classicalTime)         el.classicalTime.checked         = true;
        if (el.rapidTime)             el.rapidTime.checked             = true;
        if (el.blitzTime)             el.blitzTime.checked             = true;
        if (el.minDays)               el.minDays.value                 = '0';
        if (el.youthCategory)         el.youthCategory.value           = '';
        if (el.ratingCategory)        el.ratingCategory.value          = '';

        // Clear country checkboxes
        document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked').forEach(cb => {
            cb.checked = false;
        });
        this.updateCountryFilterSummary();

        // Reset dates to today → 6 months
        const today = new Date();
        const sixMonths = new Date(today);
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        if (el.startDate) el.startDate.valueAsDate = today;
        if (el.endDate)   el.endDate.valueAsDate   = sixMonths;

        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.syncModeSwitch();
        void this.searchTournaments();
        this.trackEvent('Reset Filters');
    }

    /**
     * Search for tournaments
     */
    async searchTournaments(): Promise<void> {
        try {
            // Show loading skeletons immediately
            this.uiManager.showLoadingSkeletons();

            // Fetch tournaments (with caching) and store full set for shortlist export
            const tournaments = await this.dataService.fetchTournaments();
            this.allTournaments = tournaments;
            this.updateHeaderLiveStatus();

            // Invalidate the filter cache: results are keyed only on filter
            // state, so a fresh data set must not reuse stale cached results.
            this.filterService.clearCache();

            // Reset the "filter within results" box - a fresh fetch (new date
            // range, or the initial load) is a new context for it.
            this.currentQuickSearch = '';
            const quickSearch = document.getElementById('quickSearch') as HTMLInputElement | null;
            if (quickSearch) quickSearch.value = '';

            this.applyFiltersAndRender();

            this.trackEvent('Search', {
                results: this.filteredTournaments.length,
                filters: this.activeFilterSummary()
            });

        } catch (error) {
            this.logger.error('Tournament search failed', error, {
                filterState: this.getFilterState(),
                currentSort: this.currentSort
            });
            this.uiManager.showError(
                error instanceof Error ? error.message : 'Failed to fetch tournaments. Please try again.',
                'error',
                () => void this.searchTournaments()
            );
        }
    }

    /**
     * Re-run filter -> sort -> annotate -> render against the already-fetched
     * this.allTournaments, without re-fetching or touching the quick-search
     * box. This is what makes filtering "live": every checkbox/select change
     * calls this directly instead of requiring a Search click, and because
     * DataService's fetch is cache-backed anyway, searchTournaments() itself
     * is just this plus a (usually free) fetch and analytics event.
     */
    private applyFiltersAndRender(): void {
        // Recompute which countries have Mediterranean tournaments and update UI constraints
        this.mediterraneanCountries = this.computeMediterraneanCountries();
        this.updateFilterCompatibility();
        this.updateAvailableCountries();

        const filterState = this.getFilterState();
        this.filteredTournaments = this.filterService.filterTournaments(
            this.allTournaments,
            filterState,
            this.mediterraneanLocations
        );

        this.filteredTournaments = this.filterService.sortTournaments(
            this.filteredTournaments,
            this.currentSort
        );

        this.filteredTournaments = this.filteredTournaments.map(t =>
            this.filterService.annotate(t, this.mediterraneanLocations)
        );

        this.applyDisplayFilters();
        this.renderActiveFilterChips();

        // Featured tournament (always computed from full unfiltered set)
        this.uiManager.renderFeaturedTournament(
            this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations)
        );
    }

    /**
     * After a search, grey out / re-enable country checkboxes based on whether
     * any tournaments pass all current filters when that country is the only
     * country filter active.  Countries with zero results become visually muted
     * and their checkboxes are disabled so users cannot pick dead-end combos.
     *
     * Unchecked-but-disabled countries are shown so users can see what exists;
     * already-checked countries are never disabled (the user may want to widen).
     */
    private updateAvailableCountries(): void {
        if (this.allTournaments.length === 0) return;

        // Filter with no country restriction to get the "available" pool
        const stateNoCountry = { ...this.getFilterState(), countryFilter: [] };
        const pool = this.filterService.filterTournaments(
            this.allTournaments,
            stateNoCountry,
            this.mediterraneanLocations
        );

        // Build set of country codes that appear in the pool
        const available = new Set<string>();
        for (const t of pool) {
            const parts = t.location.split(',');
            const last = parts[parts.length - 1];
            if (last) available.add(last.trim().toUpperCase());
        }

        // Record availability as a data flag rather than setting style.display
        // directly - applyCountrySearchFilter() is the single place that turns
        // this (plus the type-to-filter query) into final visibility, so the
        // two mechanisms narrow together instead of one clobbering the other.
        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code) return;
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (!cb) return;
            // Always keep checked countries available, even with 0 results
            // under the current filters - unchecking is the user's call.
            const unavailable = !cb.checked && !available.has(code);
            item.dataset.unavailable = unavailable ? 'true' : 'false';
        });

        this.applyCountrySearchFilter();
    }

    /**
     * Final country-checkbox visibility: hidden if updateAvailableCountries()
     * flagged it unavailable, OR it doesn't match the type-to-filter query.
     * Called after updateAvailableCountries() (filters changed) and directly
     * from the search input's own listener (only the query changed).
     */
    private applyCountrySearchFilter(): void {
        const query = this.countrySearchQuery.trim().toLowerCase();
        let anyVisible = false;

        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const unavailable = item.dataset.unavailable === 'true';
            const label = item.textContent?.toLowerCase() ?? '';
            const matchesQuery = !query || label.includes(query);
            const visible = !unavailable && matchesQuery;
            item.style.display = visible ? '' : 'none';
            if (visible) anyVisible = true;
        });

        this.syncCountryGroupToggles();

        // Hide a region heading when every country under it is hidden.
        document.querySelectorAll<HTMLElement>('.country-group-label').forEach(label => {
            const grid = label.nextElementSibling;
            const hasVisible = !!grid && Array.from(grid.querySelectorAll<HTMLElement>('.country-item'))
                .some(item => item.style.display !== 'none');
            label.style.display = hasVisible ? '' : 'none';
        });

        // Every other filter can already narrow results to zero on its own
        // (an empty results list explains itself below); an empty country
        // checklist with no message of its own just looks broken.
        const countryList = document.getElementById('countryList');
        const noCountriesMessage = document.getElementById('noCountriesMessage');
        if (countryList) countryList.style.display = anyVisible ? '' : 'none';
        if (noCountriesMessage) {
            noCountriesMessage.hidden = anyVisible;
            noCountriesMessage.textContent = query
                ? `No countries match "${this.countrySearchQuery.trim()}".`
                : 'No countries match your other filters.';
        }
    }

    /**
     * Compute which country codes (from the dropdown) have at least one
     * Mediterranean tournament in the current dataset.
     */
    private computeMediterraneanCountries(): Set<string> {
        const result = new Set<string>();
        for (const t of this.allTournaments) {
            if (this.filterService.isSeaside(t, this.mediterraneanLocations)) {
                const parts = t.location.split(',');
                const last = parts[parts.length - 1];
                const code = last ? last.trim().toUpperCase() : '';
                if (code) result.add(code);
            }
        }
        return result;
    }

    /**
     * Keep the country dropdown and the Mediterranean checkbox in sync so the
     * user cannot select a combination that will always return 0 results:
     *
     * - Country selected with no Med tournaments → disable Mediterranean checkbox.
     * - Mediterranean checked → disable country options that have no Med tournaments.
     */
    private updateFilterCompatibility(): void {
        this.updateCountryFilterSummary();
        if (this.allTournaments.length === 0) return;

        const medCheckbox = document.getElementById('mediterraneanOnly') as HTMLInputElement | null;
        if (!medCheckbox) return;

        const medChecked = medCheckbox.checked;

        // --- Direction 1: Med checked → remove countries with no Med tournaments ---
        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code) return;
            const hasMed = this.mediterraneanCountries.has(code);
            if (medChecked && !hasMed) {
                item.style.display = 'none';
                const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
                if (cb?.checked) cb.checked = false;
            } else {
                item.style.display = '';
            }
        });

        // --- Direction 2: country selection → Mediterranean ---
        const selectedCodes = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
        ).map(cb => cb.value.toUpperCase());

        // Med is compatible when no countries are selected, or at least one has Med tournaments
        const medCompatible = selectedCodes.length === 0 ||
            selectedCodes.some(code => this.mediterraneanCountries.has(code));

        medCheckbox.disabled = !medCompatible;
        if (!medCompatible && medChecked) medCheckbox.checked = false;

        // The checkbox itself is hidden - the mode switch's Seaside/Both
        // buttons are its visible control, so they carry the disabled state.
        document.querySelectorAll<HTMLButtonElement>(
            '.mode-switch-btn[data-mode="seaside"], .mode-switch-btn[data-mode="both"]'
        ).forEach(btn => {
            btn.disabled = !medCompatible;
            btn.title = medCompatible ? '' : 'No Mediterranean tournaments in the selected countries';
        });

        // --- Youth / Senior mutual exclusion ---
        const elements = this.getFilterElements();
        const youthSelect = elements.youthCategory;
        const youthSelected = (youthSelect?.value ?? '') !== '';

        // Youth selector: disable when exclude-youth or any senior filter is active
        if (youthSelect) {
            const excludeYouth = elements.excludeYouth?.checked ?? false;
            const isSenior = (elements.seniorCategory?.checked ?? false) || (elements.seniorS60?.checked ?? false);
            const shouldDisable = excludeYouth || isSenior;
            youthSelect.disabled = shouldDisable;
            const youthGroup = youthSelect.closest('.filter-group') as HTMLElement | null;
            if (youthGroup) youthGroup.style.opacity = shouldDisable ? '0.4' : '';
            if (shouldDisable && youthSelect.value !== '') {
                youthSelect.value = '';
            }
        }

        // Senior checkboxes: disable when a youth age group is selected
        const seniorFields = [elements.seniorCategory, elements.seniorS60];
        for (const cb of seniorFields) {
            if (!cb) continue;
            cb.disabled = youthSelected;
            const grp = cb.closest('label') as HTMLElement | null;
            if (grp) grp.style.opacity = youthSelected ? '0.4' : '';
            if (youthSelected && cb.checked) cb.checked = false;
        }
    }

    /** Visible country checkboxes in the region grid that follows a group label. */
    private countryGroupCheckboxes(toggle: HTMLInputElement): HTMLInputElement[] {
        const grid = toggle.closest('.country-group-label')?.nextElementSibling;
        if (!grid) return [];
        return Array.from(grid.querySelectorAll<HTMLElement>('.country-item'))
            .filter(item => item.style.display !== 'none')
            .map(item => item.querySelector<HTMLInputElement>('input[name="countryFilter"]'))
            .filter((cb): cb is HTMLInputElement => cb !== null);
    }

    /**
     * A region's "select all" tick: (un)check every country currently shown
     * in that region. Countries hidden by the type-to-filter box or by having
     * no results under the other filters are left alone.
     */
    private applyCountryGroupToggle(toggle: HTMLInputElement): void {
        this.countryGroupCheckboxes(toggle).forEach(cb => { cb.checked = toggle.checked; });
        this.updateCountryFilterSummary();
        this.trackEvent('Country Group Toggle', { checked: toggle.checked });
    }

    /** Reflect each region's shown countries in its tick: all, none, or some (indeterminate). */
    private syncCountryGroupToggles(): void {
        document.querySelectorAll<HTMLInputElement>('.country-group-toggle').forEach(toggle => {
            const boxes = this.countryGroupCheckboxes(toggle);
            const checkedCount = boxes.filter(cb => cb.checked).length;
            toggle.checked = boxes.length > 0 && checkedCount === boxes.length;
            toggle.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
        });
    }

    private updateCountryFilterSummary(): void {
        const summary = document.getElementById('countryFilterSummary');
        const clearBtn = document.getElementById('clearCountriesBtn') as HTMLButtonElement | null;
        if (!summary) return;
        const checked = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
        );
        if (checked.length === 0) {
            summary.textContent = 'All';
            if (clearBtn) clearBtn.hidden = true;
        } else if (checked.length <= 2) {
            summary.textContent = checked.map(cb => cb.value).join(', ');
            if (clearBtn) clearBtn.hidden = false;
        } else {
            summary.textContent = `${checked.length} countries`;
            if (clearBtn) clearBtn.hidden = false;
        }
    }

    /**
     * Handle sort dropdown change
     */
    private handleSortChange(sortBy: SortOption): void {
        this.currentSort = sortBy;

        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(
                this.filteredTournaments,
                sortBy
            );
            this.applyDisplayFilters();
        }
    }

    /**
     * Search within current results
     */
    private searchWithinResults(query: string): void {
        this.currentQuickSearch = query;
        this.applyDisplayFilters();
    }

    /**
     * Apply shortlist-only and quick-search display filters on top of filteredTournaments.
     * Always call this instead of uiManager.updateDisplayedTournaments directly.
     */
    /**
     * The results' own narrowing on top of the filters: "Shortlist only" and
     * the "Filter results..." text. Shared with the empty state's counts so a
     * suggested fix never promises results the list would then hide.
     */
    private narrowForDisplay(
        list: Tournament[],
        search = this.currentQuickSearch,
        shortlistOnly = this.showShortlistOnly
    ): Tournament[] {
        let out = list;
        if (shortlistOnly) out = out.filter(t => this.shortlist.has(t.url));
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter(t => t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q));
        }
        return out;
    }

    private applyDisplayFilters(): void {
        const toDisplay = this.narrowForDisplay(this.filteredTournaments);
        this.displayedTournaments = toDisplay;
        this.uiManager.setShortlistedUrls(this.shortlist);

        if (toDisplay.length === 0) {
            this.lastEmptyStateRelaxations = this.buildEmptyStateRelaxations();
            this.uiManager.prepareEmptyState(
                this.allTournaments.length,
                this.lastEmptyStateRelaxations.map(({ label, count }) => ({ label, count }))
            );
        }

        this.uiManager.displayTournaments(toDisplay, this.currentSort);
        this.uiManager.updateShowResultsButton(toDisplay.length);
        this.filterSheet?.setResultCount(toDisplay.length);
        if (this.currentView === 'map') {
            this.syncMapVisibility();
            this.mapView?.update(toDisplay);
        }

        if (this.deepLinkUrl) {
            const target = this.deepLinkUrl;
            this.deepLinkUrl = null;
            // Defer so the DOM has been painted before we scroll
            setTimeout(() => this.uiManager.highlightTournament(target), 100);
        }
    }

    /**
     * List/Map toggle. The map shows every tournament in the current results
     * (all pages); MapView loads Leaflet on first use. With zero results the
     * list's empty state (and its one-tap relaxations) stays on screen.
     */
    private async setView(view: 'list' | 'map'): Promise<void> {
        this.currentView = view;
        document.querySelectorAll<HTMLButtonElement>('.view-toggle-btn').forEach(btn => {
            const active = btn.dataset.view === view;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        this.syncMapVisibility();
        if (view === 'list') return;

        const canvas = document.getElementById('mapCanvas');
        if (!canvas) return;
        try {
            // The map module (and Leaflet behind it) is only fetched on first use
            if (!this.mapView) {
                const { MapView } = await import('./services/MapView');
                this.mapView ??= new MapView(canvas, document.getElementById('mapNote'), url => {
                    void this.setView('list');
                    this.uiManager.showTournamentInList(url);
                });
            }
            await this.mapView.show(this.displayedTournaments);
            this.trackEvent('Map View');
        } catch {
            this.uiManager.showError("The map couldn't be loaded - showing the list instead.", 'warning');
            void this.setView('list');
        }
    }

    private syncMapVisibility(): void {
        const showMap = this.currentView === 'map' && this.displayedTournaments.length > 0;
        const mapView = document.getElementById('mapView');
        const list = document.getElementById('tournamentList');
        if (mapView) mapView.hidden = !showMap;
        if (list) list.hidden = showMap;
    }

    /**
     * Export the currently displayed tournaments to CSV.
     * Exports exactly what the user sees — i.e. after the shortlist-only
     * toggle and quick-search have been applied — not the hidden superset.
     */
    private exportToCSV(): void {
        if (this.displayedTournaments.length === 0) {
            this.uiManager.showError('No tournaments to export. Adjust your filters or search first.', 'warning');
            return;
        }

        try {
            this.exportService.exportToCSV(this.displayedTournaments);
            this.logger.info('CSV export successful', {
                tournamentCount: this.displayedTournaments.length
            });
            const count = this.displayedTournaments.length;
            this.trackEvent('CSV Export', { count });
            this.uiManager.showError(
                `Exported ${count} tournament${count !== 1 ? 's' : ''} to CSV`,
                'success'
            );
        } catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.displayedTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
    }

    /**
     * Best-effort background load of tournament data (no rendering).
     * Used so shortlist export works after a page reload.
     */
    private async preloadTournamentData(): Promise<void> {
        if (this.allTournaments.length > 0) return;
        try {
            this.allTournaments = await this.dataService.fetchTournaments();
            this.logger.info('Preloaded tournament data for shortlist export', {
                count: this.allTournaments.length
            });
            this.uiManager.renderFeaturedTournament(
                this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations)
            );
        } catch (error) {
            this.logger.warn('Background preload of tournament data failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Load shortlist from localStorage (URLs, no TTL — persists indefinitely)
     */
    private loadShortlist(): void {
        try {
            const saved = localStorage.getItem(this.SHORTLIST_KEY);
            if (saved) {
                const urls: string[] = JSON.parse(saved);
                this.shortlist = new Set(urls);
            }
        } catch {
            this.shortlist = new Set();
        }
    }

    private saveShortlist(): void {
        try {
            localStorage.setItem(this.SHORTLIST_KEY, JSON.stringify([...this.shortlist]));
        } catch {
            // Storage full or unavailable — silently ignore
        }
    }

    private toggleShortlist(url: string): void {
        if (this.shortlist.has(url)) {
            this.shortlist.delete(url);
        } else {
            this.shortlist.add(url);
            this.trackEvent('Shortlist Add');
        }
        this.saveShortlist();
        this.uiManager.refreshShortlistButtons(this.shortlist);
        this.uiManager.updateShortlistCount(this.shortlist.size);
        if (this.showShortlistOnly) {
            this.applyDisplayFilters();
        }
    }

    /**
     * Delegated shortlist toggle listener — one listener handles all cards/pages
     */
    private initShortlistDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.shortlist-btn');
            if (!btn) return;
            e.preventDefault();
            const url = (btn as HTMLElement).dataset.tournamentUrl;
            if (url) {
                this.toggleShortlist(url);
            }
        });
    }

    /**
     * Wire up date preset buttons (Next Month / 3 Months / 6 Months)
     */
    private initDatePresets(): void {
        const startDateEl = document.getElementById('startDate') as HTMLInputElement | null;
        const endDateEl = document.getElementById('endDate') as HTMLInputElement | null;
        if (!startDateEl || !endDateEl) return;

        document.querySelectorAll<HTMLButtonElement>('.date-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                const end = new Date(today);

                if (preset === 'month') end.setMonth(end.getMonth() + 1);
                else if (preset === '3months') end.setMonth(end.getMonth() + 3);
                else if (preset === '6months') end.setMonth(end.getMonth() + 6);
                else return;

                startDateEl.valueAsDate = today;
                endDateEl.valueAsDate = end;
            });
        });
    }

    /**
     * Export all shortlisted tournaments to a single .ics file.
     *
     * Handles the post-reload case honestly: if the user has saved shortlist
     * items but tournament data has not loaded yet, we load it first instead of
     * falsely telling them to "star tournaments first".
     */
    private async exportShortlistToCalendar(): Promise<void> {
        // Genuinely empty shortlist — this is the only case where the
        // "star tournaments first" guidance is correct.
        if (this.shortlist.size === 0) {
            this.uiManager.showError('Star tournaments to add them to your shortlist first', 'warning');
            return;
        }

        // The user has shortlist items but data may not be loaded yet
        // (e.g. straight after a page reload). Load it before resolving URLs.
        if (this.allTournaments.length === 0) {
            await this.preloadTournamentData();
        }

        if (this.allTournaments.length === 0) {
            this.uiManager.showError(
                'Could not load tournament data. Please run a search first, then export your shortlist.',
                'warning'
            );
            return;
        }

        const shortlisted = this.allTournaments.filter(t => this.shortlist.has(t.url));

        if (shortlisted.length === 0) {
            this.uiManager.showError(
                'Your shortlisted tournaments are not in the current data set (they may have passed or been removed).',
                'warning'
            );
            return;
        }

        try {
            this.exportService.exportMultipleToCalendar(shortlisted);
            this.trackEvent('ICS Export', { type: 'shortlist', count: shortlisted.length });
            this.uiManager.showError(
                `Exported ${shortlisted.length} shortlisted tournament${shortlisted.length !== 1 ? 's' : ''} to calendar`,
                'success'
            );
        } catch (error) {
            this.logger.error('Shortlist calendar export failed', error);
            this.uiManager.showError('Failed to export shortlist. Please try again.');
        }
    }

    /**
     * Set up delegated calendar export listener on the tournament list container.
     * Called once during initialization — works correctly across all paginated
     * pages because each button carries its tournament's stable URL key
     * (data-tournament-url) rather than a DOM/array position.
     */
    private initCalendarExportDelegation(): void {
        document.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.calendar-export-btn');
            if (!btn) return;
            e.preventDefault();

            const url = (btn as HTMLElement).dataset.tournamentUrl;
            if (!url) return;

            const tournament =
                this.displayedTournaments.find(t => t.url === url) ??
                this.filteredTournaments.find(t => t.url === url) ??
                this.allTournaments.find(t => t.url === url);

            if (!tournament) {
                this.uiManager.showError('Could not find that tournament to export.', 'warning');
                return;
            }

            try {
                this.exportService.exportToCalendar(tournament);
                this.trackEvent('ICS Export', { type: 'single' });
                this.uiManager.showError(`Calendar event created for "${tournament.name}"`, 'success');
            } catch (error) {
                this.logger.error('Calendar export failed', error);
                this.uiManager.showError('Failed to create calendar event. Please try again.');
            }
        });
    }

    /**
     * Delegated click handler for copy-link buttons on tournament cards.
     * Copies a deep-link URL (?t=<encoded>) to the clipboard and shows brief feedback.
     */
    private initCopyLinkDelegation(): void {
        document.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.copy-link-btn');
            if (!btn) return;
            e.preventDefault();

            const url = (btn as HTMLElement).dataset.tournamentUrl;
            if (!url) return;

            const shareUrl = `${location.origin}${location.pathname}?t=${encodeURIComponent(url)}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.uiManager.showCopyLinkFeedback(btn as HTMLElement);
                this.trackEvent('Share Link Copied');
            }).catch(() => {
                this.uiManager.showError('Could not copy to clipboard. Please copy the URL manually.', 'warning');
            });
        });
    }

    /**
     * Delegated click handler that makes the whole tournament card open the
     * tournament's chess-results.com page in a new tab, not just the name
     * text. Ignores clicks on any link/button inside the card (the name
     * link, shortlist star, calendar export, copy link) so those keep their
     * own behavior instead of also triggering this.
     */
    private initTournamentCardClickDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            if ((e.target as Element).closest('a, button')) return;

            const card = (e.target as Element).closest<HTMLElement>('.tournament-card');
            const url = card?.dataset.tournamentUrl;
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    }

    /**
     * Initialize keyboard navigation
     */
    private initKeyboardNavigation(): void {
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
            if (e.ctrlKey || e.metaKey || e.altKey) return;

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

    /**
     * Parse the timestamp localStorage keeps alongside the cached tournament
     * list. Shared by the footer's "Data updated" line and the header's live
     * status line, which format it differently.
     */
    private getCachedTournamentsTimestamp(): Date | null {
        const cacheTimestamp = localStorage.getItem(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
        if (!cacheTimestamp) return null;
        try {
            const parsed = JSON.parse(cacheTimestamp);
            if (parsed.timestamp) {
                const date = new Date(parsed.timestamp);
                if (!isNaN(date.getTime())) return date;
            }
        } catch (e) {
            this.logger.warn('Failed to parse cache timestamp', {
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
        return null;
    }

    /**
     * Display last updated timestamp
     */
    private displayLastUpdated(): void {
        // First paint on repeat visits: when this browser cached the data (a
        // close lower bound on freshness). checkDataStaleness() replaces it
        // with the authoritative scrape time; with neither, the line stays hidden.
        const date = this.getCachedTournamentsTimestamp();
        if (date) this.setFooterTimestamp(date);
    }

    /** Show the footer's "Data updated <date> ·" segment with the given time. */
    private setFooterTimestamp(date: Date): void {
        const wrap = document.getElementById('lastUpdatedWrap');
        const time = document.getElementById('lastUpdatedTime');
        if (!wrap || !time) return;
        time.textContent = date.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        wrap.hidden = false;
    }

    /**
     * Refresh the header's "N European tournaments · updated <when>" line.
     * Called after every search (count) and once checkDataStaleness resolves
     * the authoritative scrape timestamp (date), so it settles quickly on
     * repeat visits and self-corrects once the meta file lands.
     */
    private updateHeaderLiveStatus(): void {
        const countEl = document.getElementById('headerTournamentCount');
        if (!countEl || this.allTournaments.length === 0) return;

        const count = this.allTournaments.length.toLocaleString('en-GB');
        const date = this.headerDateLabel ?? this.getCachedTournamentsTimestamp()?.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }) ?? null;

        countEl.textContent = date
            ? `${count} European tournaments · updated ${date}`
            : `${count} European tournaments`;
    }

    /**
     * Check if tournament data is stale (>48h since last scrape).
     * Updates the footer timestamp from the authoritative meta file and
     * shows a warning banner if the data is too old.
     */
    private async checkDataStaleness(): Promise<void> {
        try {
            const response = await fetch('tournaments_data_meta.json');
            if (!response.ok) return;
            const meta = await response.json() as { generatedAt?: string };
            if (!meta.generatedAt) return;

            const generatedAt = new Date(meta.generatedAt);
            if (isNaN(generatedAt.getTime())) return;

            // Overwrite footer with the authoritative generation timestamp
            this.setFooterTimestamp(generatedAt);

            this.headerDateLabel = generatedAt.toLocaleString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            this.updateHeaderLiveStatus();

            const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince > 48) {
                const daysAgo = Math.round(hoursSince / 24);
                this.uiManager.showStalenessBanner(
                    `⚠️ Tournament data is ${daysAgo} day${daysAgo !== 1 ? 's' : ''} old — the daily update may have failed. Some recent tournaments may be missing.`
                );
            }
        } catch (_e) {
            // Non-critical — silently ignore
        }
    }
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TournamentFinder();
    });
} else {
    new TournamentFinder();
}
