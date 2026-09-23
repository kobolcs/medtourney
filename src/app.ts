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
import { Logger } from './utils/Logger';

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
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => void this.searchTournaments());
        }

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

        // Attach filter change listeners to save preferences
        this.attachFilterChangeListeners();

        // Delegated calendar export — one listener handles all pages/re-renders
        this.initCalendarExportDelegation();

        // Delegated shortlist toggle
        this.initShortlistDelegation();

        // Delegated copy-link button
        this.initCopyLinkDelegation();

        // Delegated whole-card click — opens the tournament's chess-results.com
        // page, matching users' expectation that the card itself is clickable
        this.initTournamentCardClickDelegation();

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
    private initTheme(): void {
        const savedTheme = this.cacheManager.loadFromCache<string>(this.cacheManager.CACHE_KEYS.THEME);

        if (savedTheme === 'dark') {
            this.uiManager.toggleDarkMode();
            this.updateThemeButtonText();
        }
    }

    /**
     * Toggle dark/light theme
     */
    private toggleTheme(): void {
        this.uiManager.toggleDarkMode();

        // Save theme preference
        const isDark = document.body.classList.contains('dark-theme');
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.THEME, isDark ? 'dark' : 'light');

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
    private initCollapsibleFilters(): void {
        const filtersCard = document.querySelector('.filters-card');
        const savedState = this.cacheManager.loadFromCache<string>(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED);

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
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                const expanded = isCollapsed ? 'false' : 'true';
                filtersCard.setAttribute('aria-expanded', expanded);
                filterTitle.setAttribute('aria-expanded', expanded);

                // Save state
                this.cacheManager.saveToCache(
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
        const fromUrl = this.filterStateFromSearchParams(new URLSearchParams(location.search));
        if (fromUrl) {
            this.applyFilterPreferences(fromUrl);
            return;
        }

        const preferences = this.cacheManager.loadFromCache<Partial<FilterState>>(
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
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }

    /**
     * Encode the parts of filter state worth sharing as a link into query
     * params, e.g. "Senior seaside weeks in October" -> ?med=1&senior=1&dur=7.
     * Only non-default values are written, so the common case (no filters
     * narrowed) keeps a clean URL. Date range is deliberately left out - the
     * default window shifts with "today" on every visit, so there's no stable
     * "default" to diff against, and the deep-link ?t= param already covers
     * sharing a single tournament.
     */
    private filterStateToSearchParams(state: FilterState): URLSearchParams {
        const params = new URLSearchParams();

        if (!state.openOnly) params.set('open', '0');
        if (!state.excludeYouth) params.set('excludeYouth', '0');
        if (state.mediterraneanOnly) params.set('med', '1');
        if (state.seniorCategory) params.set('senior', '1');
        if (state.seniorS60) params.set('senior60', '1');
        if (state.womenOnly) params.set('women', '1');
        if (state.includeTeamTournaments) params.set('team', '1');

        const tcEnabled = [
            state.classicalTime && 'classical',
            state.rapidTime && 'rapid',
            state.blitzTime && 'blitz',
        ].filter((v): v is string => Boolean(v));
        if (tcEnabled.length !== 3) params.set('tc', tcEnabled.join(','));

        if (state.countryFilter.length > 0) params.set('country', state.countryFilter.join(','));
        if (state.minDays !== 0) params.set('dur', String(state.minDays));
        if (state.youthCategory) params.set('youthAge', state.youthCategory);
        if (state.ratingCategory) params.set('rating', state.ratingCategory);

        return params;
    }

    /** Inverse of filterStateToSearchParams(). Returns null when the URL carries no filter params at all. */
    private filterStateFromSearchParams(params: URLSearchParams): Partial<FilterState> | null {
        const FILTER_PARAM_KEYS = [
            'open', 'excludeYouth', 'med', 'senior', 'senior60', 'women',
            'team', 'tc', 'country', 'dur', 'youthAge', 'rating'
        ];
        if (!FILTER_PARAM_KEYS.some(key => params.has(key))) return null;

        const preferences: Partial<FilterState> = {};

        if (params.has('open')) preferences.openOnly = params.get('open') !== '0';
        if (params.has('excludeYouth')) preferences.excludeYouth = params.get('excludeYouth') !== '0';
        if (params.has('med')) preferences.mediterraneanOnly = params.get('med') === '1';
        if (params.has('senior')) preferences.seniorCategory = params.get('senior') === '1';
        if (params.has('senior60')) preferences.seniorS60 = params.get('senior60') === '1';
        if (params.has('women')) preferences.womenOnly = params.get('women') === '1';
        if (params.has('team')) preferences.includeTeamTournaments = params.get('team') === '1';

        if (params.has('tc')) {
            const enabled = new Set(params.get('tc')!.split(',').filter(Boolean));
            preferences.classicalTime = enabled.has('classical');
            preferences.rapidTime = enabled.has('rapid');
            preferences.blitzTime = enabled.has('blitz');
        }

        if (params.has('country')) {
            preferences.countryFilter = params.get('country')!.split(',').filter(Boolean);
        }

        if (params.has('dur')) {
            const raw = params.get('dur')!;
            preferences.minDays = (raw === 'weekend' || raw === 'just-weekend') ? raw : Number(raw);
        }

        if (params.has('youthAge')) preferences.youthCategory = params.get('youthAge')!;
        if (params.has('rating')) preferences.ratingCategory = params.get('rating')!;

        return preferences;
    }

    /**
     * Mirror the current filter state into the URL (replacing history, not
     * pushing - every checkbox click shouldn't add a back-button stop) so the
     * current view can be shared or bookmarked. Preserves unrelated params
     * (like the ?t= deep link) untouched.
     */
    private syncFilterStateToURL(): void {
        const filterState = this.getFilterState();
        const filterParams = this.filterStateToSearchParams(filterState);

        const url = new URL(location.href);
        const FILTER_PARAM_KEYS = [
            'open', 'excludeYouth', 'med', 'senior', 'senior60', 'women',
            'team', 'tc', 'country', 'dur', 'youthAge', 'rating'
        ];
        FILTER_PARAM_KEYS.forEach(key => url.searchParams.delete(key));
        filterParams.forEach((value, key) => url.searchParams.set(key, value));

        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    /**
     * Attach listeners to filter inputs to auto-save preferences
     */
    private attachFilterChangeListeners(): void {
        const filterElements = this.getFilterElements();

        const onFilterChange = () => {
            this.saveFilterPreferences();
            this.syncFilterStateToURL();
            this.updateFilterCompatibility();
            this.updateAvailableCountries();
            this.updateAdvancedFilterCount();
        };

        // Attach to all filter inputs so country list updates on every filter change
        Object.values(filterElements).forEach(element => {
            if (element) {
                element.addEventListener('change', onFilterChange);
            }
        });

        // Country checkboxes — delegated on their container
        const countryList = document.getElementById('countryList');
        if (countryList) {
            countryList.addEventListener('change', onFilterChange);
        }
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

    /** Build human-readable filter suggestions for the empty state. */
    private buildEmptySuggestions(): string[] {
        const s = this.getFilterState();
        const tips: string[] = [];

        if (s.mediterraneanOnly) tips.push('Uncheck "Mediterranean Seaside Only"');
        if (s.seniorCategory)    tips.push('Uncheck the S50+ Senior filter');
        if (s.seniorS60)         tips.push('Uncheck the S60+ filter');
        if (s.womenOnly)         tips.push('Uncheck "Women\'s Tournaments Only"');
        if (!s.openOnly)         tips.push('Re-enable "Open Category Only" — it broadens results');
        if (s.countryFilter.length > 0) tips.push(`Clear the country filter (${s.countryFilter.length} selected)`);
        if (s.ratingCategory)    tips.push(`Remove the ${s.ratingCategory} rating ceiling filter`);
        if (s.youthCategory)     tips.push(`Remove the ${s.youthCategory} youth age group filter`);
        if (!s.classicalTime || !s.rapidTime || !s.blitzTime) tips.push('Check all time control options');
        if (s.minDays !== 0)     tips.push(`Reduce minimum duration (currently "${s.minDays} days")`);

        tips.push('Expand your date range');

        return tips.slice(0, 5);
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

            // Recompute which countries have Mediterranean tournaments and update UI constraints
            this.mediterraneanCountries = this.computeMediterraneanCountries();
            this.updateFilterCompatibility();
            this.updateAvailableCountries();

            // Invalidate the filter cache: results are keyed only on filter
            // state, so a fresh data set must not reuse stale cached results.
            this.filterService.clearCache();

            // Apply filters
            const filterState = this.getFilterState();
            this.filteredTournaments = this.filterService.filterTournaments(
                tournaments,
                filterState,
                this.mediterraneanLocations
            );

            // Apply sorting
            this.filteredTournaments = this.filterService.sortTournaments(
                this.filteredTournaments,
                this.currentSort
            );

            // Annotate with confidence, reasons, and travel tags
            this.filteredTournaments = this.filteredTournaments.map(t =>
                this.filterService.annotate(t, this.mediterraneanLocations)
            );

            // Reset display filters and render
            this.currentQuickSearch = '';
            const quickSearch = document.getElementById('quickSearch') as HTMLInputElement | null;
            if (quickSearch) quickSearch.value = '';

            this.applyDisplayFilters();

            // Featured tournament (always computed from full unfiltered set)
            this.uiManager.renderFeaturedTournament(
                this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations)
            );

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
                error instanceof Error ? error.message : 'Failed to fetch tournaments. Please try again.'
            );
        }
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

        let anyVisible = false;
        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code) return;
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (!cb) return;
            const isAvailable = available.has(code);
            if (!cb.checked) {
                // Hide countries that have no results under current filters
                item.style.display = isAvailable ? '' : 'none';
                if (!isAvailable && cb.checked) cb.checked = false;
            } else {
                // Always keep checked countries visible
                item.style.display = '';
            }
            if (item.style.display !== 'none') anyVisible = true;
        });

        // Every other filter can already narrow results to zero on its own
        // (an empty results list explains itself below); an empty country
        // checklist with no message of its own just looks broken.
        const countryList = document.getElementById('countryList');
        const noCountriesMessage = document.getElementById('noCountriesMessage');
        if (countryList) countryList.style.display = anyVisible ? '' : 'none';
        if (noCountriesMessage) noCountriesMessage.hidden = anyVisible;
    }

    /**
     * Compute which country codes (from the dropdown) have at least one
     * Mediterranean tournament in the current dataset.
     */
    private computeMediterraneanCountries(): Set<string> {
        const result = new Set<string>();
        for (const t of this.allTournaments) {
            if (this.filterService.isMediterraneanLocation(t.location.toLowerCase(), this.mediterraneanLocations)) {
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

        const medLabel = document.querySelector('label[for="mediterraneanOnly"]') as HTMLElement | null;
        if (medLabel) {
            medLabel.title = medCompatible
                ? ''
                : 'No Mediterranean tournaments in the selected countries';
        }

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
    private applyDisplayFilters(): void {
        let toDisplay = this.filteredTournaments;

        if (this.showShortlistOnly) {
            toDisplay = toDisplay.filter(t => this.shortlist.has(t.url));
        }

        if (this.currentQuickSearch.trim()) {
            const q = this.currentQuickSearch.toLowerCase();
            toDisplay = toDisplay.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.location.toLowerCase().includes(q)
            );
        }

        this.displayedTournaments = toDisplay;
        this.uiManager.setShortlistedUrls(this.shortlist);

        if (toDisplay.length === 0) {
            this.uiManager.prepareEmptyState(
                this.allTournaments.length,
                this.buildEmptySuggestions()
            );
        }

        this.uiManager.displayTournaments(toDisplay, this.currentSort);

        if (this.deepLinkUrl) {
            const target = this.deepLinkUrl;
            this.deepLinkUrl = null;
            // Defer so the DOM has been painted before we scroll
            setTimeout(() => this.uiManager.highlightTournament(target), 100);
        }
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
        const lastUpdatedTime = document.getElementById('lastUpdatedTime');
        if (!lastUpdatedTime) return;

        const date = this.getCachedTournamentsTimestamp();
        lastUpdatedTime.textContent = date ? date.toLocaleString() : 'Never (no cached data)';
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
            const lastUpdatedTime = document.getElementById('lastUpdatedTime');
            if (lastUpdatedTime) {
                lastUpdatedTime.textContent = generatedAt.toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }

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
