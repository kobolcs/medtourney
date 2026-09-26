import { ResultsViewPart } from './app/ResultsViewPart';
import { clearCountries } from './utils/countrySelection';
class TournamentFinder extends ResultsViewPart {
    async initAsync() {
        try {
            this.initTheme();
            this.initCollapsibleFilters();
            await this.loadConfig();
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sixMonthsLater = new Date(today);
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
            const startDateElement = document.getElementById('startDate');
            const endDateElement = document.getElementById('endDate');
            if (startDateElement)
                startDateElement.valueAsDate = sevenDaysAgo;
            if (endDateElement)
                endDateElement.valueAsDate = sixMonthsLater;
            this.loadFilterPreferences();
            this.syncFilterStateToURL();
            this.updateAdvancedFilterCount();
            this.loadShortlist();
            this.uiManager.updateShortlistCount(this.shortlist.size);
            if (this.shortlist.size > 0) {
                void this.preloadTournamentData();
            }
            this.attachEventListeners();
            this.initKeyboardNavigation();
            const linkedUrl = new URLSearchParams(location.search).get('t');
            if (linkedUrl) {
                this.deepLinkUrl = linkedUrl;
                void this.searchTournaments();
            }
            else {
                void this.searchTournaments();
            }
        }
        catch (error) {
            this.logger.error('Application initialization failed', error);
            this.uiManager.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    attachEventListeners() {
        document.getElementById('showResultsBtn')?.addEventListener('click', () => {
            this.filterSheet?.hide(false);
            this.uiManager.scrollToResults();
        });
        this.initFilterSheet();
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
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
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const target = e.target;
                this.handleSortChange(target.value);
            });
        }
        const quickSearch = document.getElementById('quickSearch');
        if (quickSearch) {
            quickSearch.addEventListener('input', (e) => {
                const target = e.target;
                this.searchWithinResults(target.value);
            });
        }
        const countrySearch = document.getElementById('countrySearch');
        if (countrySearch) {
            countrySearch.addEventListener('input', (e) => {
                this.countrySearchQuery = e.target.value;
                this.applyCountrySearchFilter();
            });
        }
        this.attachFilterChangeListeners();
        this.initModeSwitch();
        this.syncModeSwitch();
        this.initCalendarExportDelegation();
        this.initShortlistDelegation();
        this.initTournamentCardClickDelegation();
        this.initEmptyStateRelaxationDelegation();
        document.addEventListener('click', (e) => {
            if (e.target.closest('#resetFiltersBtn')) {
                this.resetFilters();
            }
        });
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            this.resetFilters();
        });
        document.getElementById('clearCountriesBtn')?.addEventListener('click', () => {
            clearCountries();
            this.updateCountryFilterSummary();
            this.saveFilterPreferences();
            void this.searchTournaments();
            this.trackEvent('Clear Countries');
        });
        this.initDatePresets();
        const showShortlistOnlyEl = document.getElementById('showShortlistOnly');
        if (showShortlistOnlyEl) {
            showShortlistOnlyEl.addEventListener('change', () => {
                this.showShortlistOnly = showShortlistOnlyEl.checked;
                this.applyDisplayFilters();
            });
        }
        const exportShortlistBtn = document.getElementById('exportShortlistBtn');
        if (exportShortlistBtn) {
            exportShortlistBtn.addEventListener('click', () => void this.exportShortlistToCalendar());
        }
        this.initHelpModal();
    }
    async loadConfig() {
        try {
            const config = await this.dataService.loadConfig();
            this.mediterraneanLocations = new Set(config.mediterraneanLocations);
            this.europeanCountries = {};
            for (const [code, data] of Object.entries(config.countryCodes)) {
                this.europeanCountries[code] = data.keywords;
            }
            this.logger.info('Configuration loaded successfully', {
                mediterraneanLocationsCount: config.mediterraneanLocations.length,
                countryCodesCount: Object.keys(config.countryCodes).length
            });
        }
        catch (error) {
            this.logger.error('Failed to load configuration', error);
            this.uiManager.showError('Failed to load configuration. Some filters may not work correctly.');
        }
    }
    saveFilterPreferences() {
        const filterState = this.getFilterState();
        this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }
    attachFilterChangeListeners() {
        const filterElements = this.getFilterElements();
        const onFilterChange = () => this.handleFilterChange();
        Object.values(filterElements).forEach((element) => {
            if (element) {
                element.addEventListener('change', onFilterChange);
            }
        });
        const countryList = document.getElementById('countryList');
        if (countryList) {
            countryList.addEventListener('change', (e) => {
                this.onCountryListChange(e.target);
                onFilterChange();
                this.syncCountryGroupToggles();
            });
        }
    }
    handleFilterChange() {
        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.updateAdvancedFilterCount();
        this.syncModeSwitch();
        if (this.allTournaments.length > 0)
            this.applyFiltersAndRender();
    }
    setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (el)
            el.checked = checked;
    }
    setSelectValue(id, value) {
        const el = document.getElementById(id);
        if (el)
            el.value = value;
    }
    trackEvent(event, props) {
        window.plausible?.(event, props ? { props } : undefined);
    }
    async searchTournaments() {
        try {
            this.uiManager.showLoadingSkeletons();
            const tournaments = await this.dataService.fetchTournaments();
            this.allTournaments = tournaments;
            this.updateHeaderLiveStatus();
            this.filterService.clearCache();
            this.currentQuickSearch = '';
            const quickSearch = document.getElementById('quickSearch');
            if (quickSearch)
                quickSearch.value = '';
            this.applyFiltersAndRender();
            this.trackEvent('Search', {
                results: this.filteredTournaments.length,
                filters: this.activeFilterSummary()
            });
        }
        catch (error) {
            this.logger.error('Tournament search failed', error, {
                filterState: this.getFilterState(),
                currentSort: this.currentSort
            });
            this.uiManager.showError(error instanceof Error ? error.message : 'Failed to fetch tournaments. Please try again.', 'error', () => void this.searchTournaments());
        }
    }
    applyFiltersAndRender() {
        this.mediterraneanCountries = this.computeMediterraneanCountries();
        this.updateFilterCompatibility();
        this.updateAvailableCountries();
        const filterState = this.getFilterState();
        this.filteredTournaments = this.filterService.filterTournaments(this.allTournaments, filterState, this.mediterraneanLocations);
        this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, this.currentSort);
        this.filteredTournaments = this.filteredTournaments.map(t => this.filterService.annotate(t, this.mediterraneanLocations));
        this.applyDisplayFilters();
        this.renderActiveFilterChips();
        this.uiManager.renderFeaturedTournament(this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations));
    }
    searchWithinResults(query) {
        this.currentQuickSearch = query;
        this.applyDisplayFilters();
    }
    async preloadTournamentData() {
        if (this.allTournaments.length > 0)
            return;
        try {
            this.allTournaments = await this.dataService.fetchTournaments();
            this.logger.info('Preloaded tournament data for shortlist export', {
                count: this.allTournaments.length
            });
            this.uiManager.renderFeaturedTournament(this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations));
        }
        catch (error) {
            this.logger.warn('Background preload of tournament data failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TournamentFinder();
    });
}
else {
    new TournamentFinder();
}
//# sourceMappingURL=app.js.map