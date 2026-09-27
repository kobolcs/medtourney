import { CacheManager } from '../services/CacheManager';
import { FilterService } from '../services/FilterService';
import { DataService } from '../services/DataService';
import { ExportService } from '../services/ExportService';
import { UIManager } from '../services/UIManager';
import { Logger } from '../utils/Logger';
export class AppState {
    constructor() {
        this.logger = Logger.createScoped('TournamentFinder');
        this.SHORTLIST_KEY = 'medtourney_shortlist';
        this.showShortlistOnly = false;
        this.currentQuickSearch = '';
        this.deepLinkUrl = null;
        this.countrySearchQuery = '';
        this.lastEmptyStateRelaxations = [];
        this.mapView = null;
        this.filterSheet = null;
        this.currentView = 'list';
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
        this.europeanCountries = {};
        this.mediterraneanLocations = new Set();
        this.mediterraneanCountries = new Set();
        void this.initAsync();
    }
}
//# sourceMappingURL=AppState.js.map