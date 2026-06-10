import { CacheManager } from './services/CacheManager';
import { FilterService } from './services/FilterService';
import { DataService } from './services/DataService';
import { ExportService } from './services/ExportService';
import { UIManager } from './services/UIManager';
import { Logger } from './utils/Logger';
class TournamentFinder {
    constructor() {
        this.logger = Logger.createScoped('TournamentFinder');
        this.cacheManager = new CacheManager();
        this.filterService = new FilterService();
        this.dataService = new DataService(this.cacheManager);
        this.exportService = new ExportService();
        this.uiManager = new UIManager();
        this.filteredTournaments = [];
        this.currentSort = 'date-asc';
        this.europeanCountries = {};
        this.mediterraneanLocations = new Set();
        void this.initAsync();
    }
    async initAsync() {
        try {
            this.initTheme();
            this.initCollapsibleFilters();
            await this.loadConfig();
            const today = new Date();
            const sixMonthsLater = new Date(today);
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
            const startDateElement = document.getElementById('startDate');
            const endDateElement = document.getElementById('endDate');
            if (startDateElement)
                startDateElement.valueAsDate = today;
            if (endDateElement)
                endDateElement.valueAsDate = sixMonthsLater;
            this.loadFilterPreferences();
            this.attachEventListeners();
            this.initKeyboardNavigation();
            this.displayLastUpdated();
        }
        catch (error) {
            this.logger.error('Application initialization failed', error);
            this.uiManager.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    attachEventListeners() {
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
        this.attachFilterChangeListeners();
        this.initCalendarExportDelegation();
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
    initTheme() {
        const savedTheme = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.THEME);
        if (savedTheme === 'dark') {
            this.uiManager.toggleDarkMode();
            this.updateThemeButtonText();
        }
    }
    toggleTheme() {
        this.uiManager.toggleDarkMode();
        const isDark = document.body.classList.contains('dark-theme');
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.THEME, isDark ? 'dark' : 'light');
        this.updateThemeButtonText();
    }
    updateThemeButtonText() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
    }
    initCollapsibleFilters() {
        const filtersCard = document.querySelector('.filters-card');
        const savedState = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED);
        if (savedState === 'collapsed' && filtersCard) {
            filtersCard.classList.add('collapsed');
            filtersCard.setAttribute('aria-expanded', 'false');
        }
        const filterTitle = document.querySelector('.filters-card h2');
        if (filterTitle && filtersCard) {
            filterTitle.style.cursor = 'pointer';
            filterTitle.addEventListener('click', () => {
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                filtersCard.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
                this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED, isCollapsed ? 'collapsed' : 'expanded');
            });
        }
    }
    loadFilterPreferences() {
        const preferences = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES);
        if (!preferences)
            return;
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
        if (preferences.countryFilter && filterElements.countryFilter) {
            filterElements.countryFilter.value = preferences.countryFilter;
        }
    }
    saveFilterPreferences() {
        const filterState = this.getFilterState();
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }
    attachFilterChangeListeners() {
        const filterElements = this.getFilterElements();
        const savePrefs = () => this.saveFilterPreferences();
        Object.values(filterElements).forEach(element => {
            if (element) {
                element.addEventListener('change', savePrefs);
            }
        });
    }
    getFilterElements() {
        return {
            openOnly: document.getElementById('openOnly'),
            excludeYouth: document.getElementById('excludeYouth'),
            mediterraneanOnly: document.getElementById('mediterraneanOnly'),
            seniorCategory: document.getElementById('seniorCategory'),
            womenOnly: document.getElementById('womenOnly'),
            includeTeamTournaments: document.getElementById('includeTeamTournaments'),
            classicalTime: document.getElementById('classicalTime'),
            rapidTime: document.getElementById('rapidTime'),
            blitzTime: document.getElementById('blitzTime'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            countryFilter: document.getElementById('countryFilter'),
        };
    }
    getFilterState() {
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
            countryFilter: elements.countryFilter?.value ?? '',
        };
    }
    async searchTournaments() {
        try {
            this.uiManager.showLoadingSkeletons();
            const tournaments = await this.dataService.fetchTournaments();
            const filterState = this.getFilterState();
            this.filteredTournaments = this.filterService.filterTournaments(tournaments, filterState, this.mediterraneanLocations);
            this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, this.currentSort);
            this.uiManager.displayTournaments(this.filteredTournaments);
        }
        catch (error) {
            this.logger.error('Tournament search failed', error, {
                filterState: this.getFilterState(),
                currentSort: this.currentSort
            });
            this.uiManager.showError(error instanceof Error ? error.message : 'Failed to fetch tournaments. Please try again.');
        }
    }
    handleSortChange(sortBy) {
        this.currentSort = sortBy;
        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, sortBy);
            this.uiManager.updateDisplayedTournaments(this.filteredTournaments);
        }
    }
    searchWithinResults(query) {
        if (!query.trim()) {
            this.uiManager.updateDisplayedTournaments(this.filteredTournaments);
        }
        else {
            const lowerQuery = query.toLowerCase();
            const searchResults = this.filteredTournaments.filter(tournament => tournament.name.toLowerCase().includes(lowerQuery) ||
                tournament.location.toLowerCase().includes(lowerQuery));
            this.uiManager.updateDisplayedTournaments(searchResults);
        }
    }
    exportToCSV() {
        if (this.filteredTournaments.length === 0) {
            this.uiManager.showError('No tournaments to export');
            return;
        }
        try {
            this.exportService.exportToCSV(this.filteredTournaments);
            this.logger.info('CSV export successful', {
                tournamentCount: this.filteredTournaments.length
            });
        }
        catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.filteredTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
    }
    initCalendarExportDelegation() {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList)
            return;
        tournamentList.addEventListener('click', (e) => {
            const btn = e.target.closest('.calendar-export-btn');
            if (!btn)
                return;
            e.preventDefault();
            const index = parseInt(btn.dataset.tournamentIndex ?? '-1', 10);
            const tournament = this.uiManager.getTournamentByIndex(index);
            if (tournament) {
                this.exportService.exportToCalendar(tournament);
            }
        });
    }
    initKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchBtn = document.getElementById('searchBtn');
                searchBtn?.focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                const exportBtn = document.getElementById('exportBtn');
                if (exportBtn && exportBtn.style.display !== 'none') {
                    this.exportToCSV();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }
            if (e.key === 'Escape') {
                const quickSearch = document.getElementById('quickSearch');
                if (quickSearch && quickSearch.value) {
                    quickSearch.value = '';
                    this.searchWithinResults('');
                }
            }
        });
    }
    displayLastUpdated() {
        const lastUpdatedTime = document.getElementById('lastUpdatedTime');
        if (!lastUpdatedTime)
            return;
        const cachedData = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
        if (cachedData) {
            const cacheTimestamp = localStorage.getItem(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
            if (cacheTimestamp) {
                try {
                    const parsed = JSON.parse(cacheTimestamp);
                    if (parsed.timestamp) {
                        const date = new Date(parsed.timestamp);
                        lastUpdatedTime.textContent = date.toLocaleString();
                        return;
                    }
                }
                catch (e) {
                    this.logger.warn('Failed to parse cache timestamp', {
                        error: e instanceof Error ? e.message : 'Unknown error'
                    });
                }
            }
        }
        lastUpdatedTime.textContent = 'Never (no cached data)';
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