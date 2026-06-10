/**
 * Chess Tournament Finder - Main Application (Refactored)
 * Fetches and displays tournaments from chess-results.com
 *
 * @author MedTourney Project
 * @version 3.0.0 (Modular Architecture with Service Layers)
 */

import { Tournament, FilterState } from './types';
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
    countryFilter: HTMLSelectElement | null;
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

    // Tournament data
    private filteredTournaments: Tournament[];

    // Sorting state
    private currentSort: SortOption;

    constructor() {
        // Initialize service modules
        this.cacheManager = new CacheManager();
        this.filterService = new FilterService();
        this.dataService = new DataService(this.cacheManager);
        this.exportService = new ExportService();
        this.uiManager = new UIManager();

        this.filteredTournaments = [];
        this.currentSort = 'date-asc';

        // Will be loaded from config.json
        this.europeanCountries = {};
        this.mediterraneanLocations = new Set();

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

            // Load saved filter preferences
            this.loadFilterPreferences();

            // Attach event listeners
            this.attachEventListeners();

            // Initialize keyboard navigation
            this.initKeyboardNavigation();

            // Display last updated time from cache
            this.displayLastUpdated();

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
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
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
            filterTitle.style.cursor = 'pointer';
            filterTitle.addEventListener('click', () => {
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                filtersCard.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

                // Save state
                this.cacheManager.saveToCache(
                    this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED,
                    isCollapsed ? 'collapsed' : 'expanded'
                );
            });
        }
    }

    /**
     * Load saved filter preferences
     */
    private loadFilterPreferences(): void {
        const preferences = this.cacheManager.loadFromCache<Partial<FilterState>>(
            this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES
        );

        if (!preferences) return;

        // Apply saved filter values
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

    /**
     * Save current filter preferences
     */
    private saveFilterPreferences(): void {
        const filterState = this.getFilterState();
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES, filterState);
    }

    /**
     * Attach listeners to filter inputs to auto-save preferences
     */
    private attachFilterChangeListeners(): void {
        const filterElements = this.getFilterElements();

        const savePrefs = () => this.saveFilterPreferences();

        // Attach to all filter inputs
        Object.values(filterElements).forEach(element => {
            if (element) {
                element.addEventListener('change', savePrefs);
            }
        });
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
            countryFilter: document.getElementById('countryFilter') as HTMLSelectElement | null,
        };
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
            countryFilter: elements.countryFilter?.value ?? '',
        };
    }

    /**
     * Search for tournaments
     */
    async searchTournaments(): Promise<void> {
        try {
            // Show loading skeletons immediately
            this.uiManager.showLoadingSkeletons();

            // Fetch tournaments (with caching)
            const tournaments = await this.dataService.fetchTournaments();

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

            // Display results
            this.uiManager.displayTournaments(this.filteredTournaments);

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
     * Handle sort dropdown change
     */
    private handleSortChange(sortBy: SortOption): void {
        this.currentSort = sortBy;

        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(
                this.filteredTournaments,
                sortBy
            );
            this.uiManager.updateDisplayedTournaments(this.filteredTournaments);
        }
    }

    /**
     * Search within current results
     */
    private searchWithinResults(query: string): void {
        if (!query.trim()) {
            this.uiManager.updateDisplayedTournaments(this.filteredTournaments);
        } else {
            const lowerQuery = query.toLowerCase();
            const searchResults = this.filteredTournaments.filter(tournament =>
                tournament.name.toLowerCase().includes(lowerQuery) ||
                tournament.location.toLowerCase().includes(lowerQuery)
            );
            this.uiManager.updateDisplayedTournaments(searchResults);
        }
    }

    /**
     * Export tournaments to CSV
     */
    private exportToCSV(): void {
        if (this.filteredTournaments.length === 0) {
            this.uiManager.showError('No tournaments to export');
            return;
        }

        try {
            this.exportService.exportToCSV(this.filteredTournaments);
            this.logger.info('CSV export successful', {
                tournamentCount: this.filteredTournaments.length
            });
        } catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.filteredTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
    }

    /**
     * Set up delegated calendar export listener on the tournament list container.
     * Called once during initialization — works correctly across all paginated pages
     * because it reads the stable global index from data-tournament-index.
     */
    private initCalendarExportDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.calendar-export-btn');
            if (!btn) return;
            e.preventDefault();

            const index = parseInt((btn as HTMLElement).dataset.tournamentIndex ?? '-1', 10);
            const tournament = this.uiManager.getTournamentByIndex(index);
            if (tournament) {
                this.exportService.exportToCalendar(tournament);
            }
        });
    }

    /**
     * Initialize keyboard navigation
     */
    private initKeyboardNavigation(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Ctrl/Cmd + K: Focus search button
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchBtn = document.getElementById('searchBtn');
                searchBtn?.focus();
            }

            // Ctrl/Cmd + E: Export to CSV
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                const exportBtn = document.getElementById('exportBtn');
                if (exportBtn && exportBtn.style.display !== 'none') {
                    this.exportToCSV();
                }
            }

            // Ctrl/Cmd + D: Toggle dark mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }

            // Escape: Clear quick search
            if (e.key === 'Escape') {
                const quickSearch = document.getElementById('quickSearch') as HTMLInputElement;
                if (quickSearch && quickSearch.value) {
                    quickSearch.value = '';
                    this.searchWithinResults('');
                }
            }
        });
    }

    /**
     * Display last updated timestamp
     */
    private displayLastUpdated(): void {
        const lastUpdatedTime = document.getElementById('lastUpdatedTime');
        if (!lastUpdatedTime) return;

        const cachedData = this.cacheManager.loadFromCache<Tournament[]>(
            this.cacheManager.CACHE_KEYS.TOURNAMENTS
        );

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
                } catch (e) {
                    this.logger.warn('Failed to parse cache timestamp', {
                        error: e instanceof Error ? e.message : 'Unknown error'
                    });
                }
            }
        }

        lastUpdatedTime.textContent = 'Never (no cached data)';
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
