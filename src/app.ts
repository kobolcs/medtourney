/**
 * Chess Tournament Finder - Main Application (Refactored)
 * Fetches and displays tournaments from chess-results.com
 *
 * @author Csaba Köböl
 * @version 3.0.0 (Modular Architecture with Service Layers)
 */

import type { SortOption } from './app/AppState';
import { ResultsViewPart } from './app/ResultsViewPart';

declare global {
    interface Window {
        plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
    }
}


/**
 * Main application class for finding chess tournaments
 * Coordinates between service modules
 */
class TournamentFinder extends ResultsViewPart {
    /**
     * Asynchronous initialization
     * Loads configuration and sets up event listeners
     */
    protected async initAsync(): Promise<void> {
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
    protected attachEventListeners(): void {
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

    /**
     * Load configuration from config.json
     */
    protected async loadConfig(): Promise<void> {
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
     * Save current filter preferences
     */
    protected saveFilterPreferences(): void {
        const filterState = this.getFilterState();
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }

    /**
     * Attach listeners to filter inputs to auto-save preferences
     */
    protected attachFilterChangeListeners(): void {
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
    protected handleFilterChange(): void {
        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.updateAdvancedFilterCount();
        this.syncModeSwitch();
        if (this.allTournaments.length > 0) this.applyFiltersAndRender();
    }

    protected setCheckbox(id: string, checked: boolean): void {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.checked = checked;
    }

    protected setSelectValue(id: string, value: string): void {
        const el = document.getElementById(id) as HTMLSelectElement | null;
        if (el) el.value = value;
    }

    protected trackEvent(event: string, props?: Record<string, string | number | boolean>): void {
        window.plausible?.(event, props ? { props } : undefined);
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
    protected applyFiltersAndRender(): void {
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
     * Search within current results
     */
    protected searchWithinResults(query: string): void {
        this.currentQuickSearch = query;
        this.applyDisplayFilters();
    }

    /**
     * Best-effort background load of tournament data (no rendering).
     * Used so shortlist export works after a page reload.
     */
    protected async preloadTournamentData(): Promise<void> {
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
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TournamentFinder();
    });
} else {
    new TournamentFinder();
}
