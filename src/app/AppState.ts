/**
 * TournamentFinder's state: services, data, UI state, and the constructor.
 * Base of the class chain in src/app.ts; the methods live in the part
 * files in this folder and in app.ts.
 */
import { Tournament, FilterState } from '../types';
import { CacheManager } from '../services/CacheManager';
import { FilterService } from '../services/FilterService';
import { DataService } from '../services/DataService';
import { ExportService } from '../services/ExportService';
import { UIManager } from '../services/UIManager';
import type { MapView } from '../services/MapView';
import { FilterSheet } from '../services/FilterSheet';
import { Logger } from '../utils/Logger';

/** Sort options for tournaments */
export type SortOption = 'date-asc' | 'date-desc' | 'name' | 'location' | 'country';

/** HTML element map for type safety */
export interface FilterElements {
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

export abstract class AppState {
    // Service modules
    protected readonly cacheManager: CacheManager;
    protected readonly filterService: FilterService;
    protected readonly dataService: DataService;
    protected readonly exportService: ExportService;
    protected readonly uiManager: UIManager;
    protected readonly logger = Logger.createScoped('TournamentFinder');

    // Configuration
    protected europeanCountries: Record<string, string[]>;
    protected mediterraneanLocations: Set<string>;
    protected mediterraneanCountries: Set<string>;

    // Tournament data
    // - allTournaments: the full fetched set (used for shortlist resolution)
    // - filteredTournaments: after filters + sort + annotation
    // - displayedTournaments: what the user actually sees, after the
    //   shortlist-only toggle and quick-search are applied (this is what
    //   CSV export operates on)
    protected allTournaments: Tournament[];
    protected filteredTournaments: Tournament[];
    protected displayedTournaments: Tournament[];

    // Sorting state
    protected currentSort: SortOption;

    // Shortlist (persisted to localStorage)
    protected shortlist: Set<string>;
    protected readonly SHORTLIST_KEY = 'medtourney_shortlist';

    // Display state
    protected showShortlistOnly = false;
    protected currentQuickSearch = '';

    // Deep-link: URL of tournament to highlight after next search (?t= param)
    protected deepLinkUrl: string | null = null;
    protected headerDateLabel: string | null = null;
    protected countrySearchQuery = '';
    protected lastEmptyStateRelaxations: { label: string; count: number; apply: () => void }[] = [];
    protected mapView: MapView | null = null;
    protected filterSheet: FilterSheet | null = null;
    protected currentView: 'list' | 'map' = 'list';

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

    // Implemented further up the chain; declared here so lower parts can call them
    protected abstract initAsync(): Promise<void>;
    protected abstract saveFilterPreferences(): void;
    protected abstract handleFilterChange(): void;
    protected abstract setCheckbox(id: string, checked: boolean): void;
    protected abstract setSelectValue(id: string, value: string): void;
    protected abstract getFilterElements(): FilterElements;
    protected abstract getFilterState(): FilterState;
    protected abstract trackEvent(event: string, props?: Record<string, string | number | boolean>): void;
    protected abstract resetFilters(): void;
    protected abstract searchTournaments(): Promise<void>;
    protected abstract updateCountryFilterSummary(): void;
    protected abstract searchWithinResults(query: string): void;
    protected abstract narrowForDisplay(list: Tournament[], search?: unknown, shortlistOnly?: unknown): Tournament[];
    protected abstract applyDisplayFilters(): void;
    protected abstract exportToCSV(): void;
    protected abstract preloadTournamentData(): Promise<void>;
}
