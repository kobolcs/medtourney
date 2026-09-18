import { CacheManager } from './services/CacheManager';
import { FilterService } from './services/FilterService';
import { DataService } from './services/DataService';
import { ExportService } from './services/ExportService';
import { UIManager } from './services/UIManager';
import { Logger } from './utils/Logger';
class TournamentFinder {
    constructor() {
        this.logger = Logger.createScoped('TournamentFinder');
        this.SHORTLIST_KEY = 'medtourney_shortlist';
        this.showShortlistOnly = false;
        this.currentQuickSearch = '';
        this.deepLinkUrl = null;
        this.cacheManager = new CacheManager();
        this.filterService = new FilterService();
        this.dataService = new DataService(this.cacheManager);
        this.exportService = new ExportService();
        this.uiManager = new UIManager();
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
            this.loadShortlist();
            this.uiManager.updateShortlistCount(this.shortlist.size);
            if (this.shortlist.size > 0) {
                void this.preloadTournamentData();
            }
            this.attachEventListeners();
            this.initKeyboardNavigation();
            this.displayLastUpdated();
            void this.checkDataStaleness();
            const linkedUrl = new URLSearchParams(location.search).get('t');
            if (linkedUrl) {
                this.deepLinkUrl = linkedUrl;
                void this.searchTournaments();
            }
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
        this.initShortlistDelegation();
        this.initCopyLinkDelegation();
        document.addEventListener('click', (e) => {
            if (e.target.closest('#resetFiltersBtn')) {
                this.resetFilters();
            }
        });
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            this.resetFilters();
        });
        document.getElementById('clearCountriesBtn')?.addEventListener('click', () => {
            document.querySelectorAll('input[name="countryFilter"]:checked').forEach(cb => {
                cb.checked = false;
            });
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
    openHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal)
            return;
        Array.from(document.body.children).forEach(el => {
            if (el.id !== 'helpModal' && el.tagName !== 'SCRIPT') {
                el.inert = true;
            }
        });
        modal.style.display = 'flex';
        modal.removeAttribute('hidden');
        document.getElementById('helpModalClose')?.focus();
        this.trackEvent('Help Opened');
    }
    closeHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal)
            return;
        modal.style.display = 'none';
        Array.from(document.body.children).forEach(el => {
            el.inert = false;
        });
        document.getElementById('helpBtn')?.focus();
    }
    initHelpModal() {
        document.getElementById('helpBtn')?.addEventListener('click', () => this.openHelpModal());
        document.getElementById('helpModalClose')?.addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpModalBackdrop')?.addEventListener('click', () => this.closeHelpModal());
        document.getElementById('helpModal')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab')
                return;
            const dialog = document.querySelector('.help-modal-dialog');
            if (!dialog)
                return;
            const focusable = Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => el.getBoundingClientRect().width > 0);
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            }
            else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
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
            themeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
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
            filterTitle.setAttribute('role', 'button');
            filterTitle.setAttribute('tabindex', '0');
            const startCollapsed = filtersCard.classList.contains('collapsed');
            filterTitle.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');
            const toggleFilters = () => {
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                const expanded = isCollapsed ? 'false' : 'true';
                filtersCard.setAttribute('aria-expanded', expanded);
                filterTitle.setAttribute('aria-expanded', expanded);
                this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED, isCollapsed ? 'collapsed' : 'expanded');
            };
            filterTitle.addEventListener('click', toggleFilters);
            filterTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleFilters();
                }
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
        if (Array.isArray(preferences.countryFilter) && preferences.countryFilter.length > 0) {
            preferences.countryFilter.forEach((code) => {
                const cb = document.querySelector(`input[name="countryFilter"][value="${code}"]`);
                if (cb)
                    cb.checked = true;
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
        filterElements.mediterraneanOnly?.addEventListener('change', () => {
            this.updateFilterCompatibility();
            this.updateAvailableCountries();
        });
        const countryList = document.getElementById('countryList');
        if (countryList) {
            countryList.addEventListener('change', () => {
                this.updateFilterCompatibility();
                this.updateAvailableCountries();
                this.saveFilterPreferences();
            });
        }
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
            minDays: document.getElementById('minDays'),
            seniorS60: document.getElementById('seniorS60'),
            youthCategory: document.getElementById('youthCategory'),
            ratingCategory: document.getElementById('ratingCategory'),
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
            countryFilter: Array.from(document.querySelectorAll('input[name="countryFilter"]:checked')).map(cb => cb.value),
            minDays: elements.minDays?.value === 'weekend' ? 'weekend'
                : elements.minDays?.value === 'just-weekend' ? 'just-weekend'
                    : (parseInt(elements.minDays?.value ?? '0', 10) || 0),
            seniorS60: elements.seniorS60?.checked ?? false,
            youthCategory: elements.youthCategory?.value ?? '',
            ratingCategory: elements.ratingCategory?.value ?? '',
        };
    }
    trackEvent(event, props) {
        window.plausible?.(event, props ? { props } : undefined);
    }
    activeFilterSummary() {
        const s = this.getFilterState();
        const parts = [];
        if (s.mediterraneanOnly)
            parts.push('mediterranean');
        if (s.seniorCategory)
            parts.push('senior50');
        if (s.seniorS60)
            parts.push('senior60');
        if (s.womenOnly)
            parts.push('women');
        if (s.youthCategory)
            parts.push(`youth_${s.youthCategory}`);
        if (s.countryFilter.length > 0)
            parts.push(`country_${s.countryFilter.join('+')}`);
        if (s.minDays !== 0)
            parts.push(`duration_${String(s.minDays)}`);
        return parts.join(',') || 'none';
    }
    buildEmptySuggestions() {
        const s = this.getFilterState();
        const tips = [];
        if (s.mediterraneanOnly)
            tips.push('Uncheck "Mediterranean Seaside Only"');
        if (s.seniorCategory)
            tips.push('Uncheck the S50+ Senior filter');
        if (s.seniorS60)
            tips.push('Uncheck the S60+ filter');
        if (s.womenOnly)
            tips.push('Uncheck "Women\'s Tournaments Only"');
        if (!s.openOnly)
            tips.push('Re-enable "Open Category Only" — it broadens results');
        if (s.countryFilter.length > 0)
            tips.push(`Clear the country filter (${s.countryFilter.length} selected)`);
        if (s.ratingCategory)
            tips.push(`Remove the ${s.ratingCategory} rating ceiling filter`);
        if (s.youthCategory)
            tips.push(`Remove the ${s.youthCategory} youth age group filter`);
        if (!s.classicalTime || !s.rapidTime || !s.blitzTime)
            tips.push('Check all time control options');
        if (s.minDays !== 0)
            tips.push(`Reduce minimum duration (currently "${s.minDays} days")`);
        tips.push('Expand your date range');
        return tips.slice(0, 5);
    }
    resetFilters() {
        const el = this.getFilterElements();
        if (el.openOnly)
            el.openOnly.checked = true;
        if (el.excludeYouth)
            el.excludeYouth.checked = true;
        if (el.mediterraneanOnly)
            el.mediterraneanOnly.checked = false;
        if (el.seniorCategory)
            el.seniorCategory.checked = false;
        if (el.seniorS60)
            el.seniorS60.checked = false;
        if (el.womenOnly)
            el.womenOnly.checked = false;
        if (el.includeTeamTournaments)
            el.includeTeamTournaments.checked = false;
        if (el.classicalTime)
            el.classicalTime.checked = true;
        if (el.rapidTime)
            el.rapidTime.checked = true;
        if (el.blitzTime)
            el.blitzTime.checked = true;
        if (el.minDays)
            el.minDays.value = '0';
        if (el.youthCategory)
            el.youthCategory.value = '';
        if (el.ratingCategory)
            el.ratingCategory.value = '';
        document.querySelectorAll('input[name="countryFilter"]:checked').forEach(cb => {
            cb.checked = false;
        });
        this.updateCountryFilterSummary();
        const today = new Date();
        const sixMonths = new Date(today);
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        if (el.startDate)
            el.startDate.valueAsDate = today;
        if (el.endDate)
            el.endDate.valueAsDate = sixMonths;
        this.saveFilterPreferences();
        void this.searchTournaments();
        this.trackEvent('Reset Filters');
    }
    async searchTournaments() {
        try {
            this.uiManager.showLoadingSkeletons();
            const tournaments = await this.dataService.fetchTournaments();
            this.allTournaments = tournaments;
            this.mediterraneanCountries = this.computeMediterraneanCountries();
            this.updateFilterCompatibility();
            this.updateAvailableCountries();
            this.filterService.clearCache();
            const filterState = this.getFilterState();
            this.filteredTournaments = this.filterService.filterTournaments(tournaments, filterState, this.mediterraneanLocations);
            this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, this.currentSort);
            this.filteredTournaments = this.filteredTournaments.map(t => this.filterService.annotate(t, this.mediterraneanLocations));
            this.currentQuickSearch = '';
            const quickSearch = document.getElementById('quickSearch');
            if (quickSearch)
                quickSearch.value = '';
            this.applyDisplayFilters();
            this.uiManager.renderFeaturedTournament(this.filterService.pickFeatured(this.allTournaments, this.mediterraneanLocations));
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
            this.uiManager.showError(error instanceof Error ? error.message : 'Failed to fetch tournaments. Please try again.');
        }
    }
    updateAvailableCountries() {
        if (this.allTournaments.length === 0)
            return;
        const stateNoCountry = { ...this.getFilterState(), countryFilter: [] };
        const pool = this.filterService.filterTournaments(this.allTournaments, stateNoCountry, this.mediterraneanLocations);
        const available = new Set();
        for (const t of pool) {
            const parts = t.location.split(',');
            const last = parts[parts.length - 1];
            if (last)
                available.add(last.trim().toUpperCase());
        }
        document.querySelectorAll('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code)
                return;
            const cb = item.querySelector('input[type="checkbox"]');
            if (!cb)
                return;
            const isAvailable = available.has(code);
            if (!cb.checked) {
                cb.disabled = !isAvailable;
                item.classList.toggle('country-unavailable', !isAvailable);
            }
            else {
                cb.disabled = false;
                item.classList.remove('country-unavailable');
            }
        });
    }
    computeMediterraneanCountries() {
        const result = new Set();
        for (const t of this.allTournaments) {
            if (this.filterService.isMediterraneanLocation(t.location.toLowerCase(), this.mediterraneanLocations)) {
                const parts = t.location.split(',');
                const last = parts[parts.length - 1];
                const code = last ? last.trim().toUpperCase() : '';
                if (code)
                    result.add(code);
            }
        }
        return result;
    }
    updateFilterCompatibility() {
        this.updateCountryFilterSummary();
        if (this.allTournaments.length === 0)
            return;
        const medCheckbox = document.getElementById('mediterraneanOnly');
        if (!medCheckbox)
            return;
        const medChecked = medCheckbox.checked;
        document.querySelectorAll('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code)
                return;
            const hasMed = this.mediterraneanCountries.has(code);
            if (medChecked && !hasMed) {
                item.style.display = 'none';
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb?.checked)
                    cb.checked = false;
            }
            else {
                item.style.display = '';
            }
        });
        const selectedCodes = Array.from(document.querySelectorAll('input[name="countryFilter"]:checked')).map(cb => cb.value.toUpperCase());
        const medCompatible = selectedCodes.length === 0 ||
            selectedCodes.some(code => this.mediterraneanCountries.has(code));
        medCheckbox.disabled = !medCompatible;
        if (!medCompatible && medChecked)
            medCheckbox.checked = false;
        const medLabel = document.querySelector('label[for="mediterraneanOnly"]');
        if (medLabel) {
            medLabel.title = medCompatible
                ? ''
                : 'No Mediterranean tournaments in the selected countries';
        }
        const elements = this.getFilterElements();
        const youthSelect = elements.youthCategory;
        if (youthSelect) {
            const excludeYouth = elements.excludeYouth?.checked ?? false;
            const isSenior = (elements.seniorCategory?.checked ?? false) || (elements.seniorS60?.checked ?? false);
            const shouldDisable = excludeYouth || isSenior;
            youthSelect.disabled = shouldDisable;
            const youthGroup = youthSelect.closest('.filter-group');
            if (youthGroup)
                youthGroup.style.opacity = shouldDisable ? '0.4' : '';
            if (shouldDisable && youthSelect.value !== '') {
                youthSelect.value = '';
            }
        }
    }
    updateCountryFilterSummary() {
        const summary = document.getElementById('countryFilterSummary');
        const clearBtn = document.getElementById('clearCountriesBtn');
        if (!summary)
            return;
        const checked = Array.from(document.querySelectorAll('input[name="countryFilter"]:checked'));
        if (checked.length === 0) {
            summary.textContent = 'All';
            if (clearBtn)
                clearBtn.hidden = true;
        }
        else if (checked.length <= 2) {
            summary.textContent = checked.map(cb => cb.value).join(', ');
            if (clearBtn)
                clearBtn.hidden = false;
        }
        else {
            summary.textContent = `${checked.length} countries`;
            if (clearBtn)
                clearBtn.hidden = false;
        }
    }
    handleSortChange(sortBy) {
        this.currentSort = sortBy;
        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, sortBy);
            this.applyDisplayFilters();
        }
    }
    searchWithinResults(query) {
        this.currentQuickSearch = query;
        this.applyDisplayFilters();
    }
    applyDisplayFilters() {
        let toDisplay = this.filteredTournaments;
        if (this.showShortlistOnly) {
            toDisplay = toDisplay.filter(t => this.shortlist.has(t.url));
        }
        if (this.currentQuickSearch.trim()) {
            const q = this.currentQuickSearch.toLowerCase();
            toDisplay = toDisplay.filter(t => t.name.toLowerCase().includes(q) ||
                t.location.toLowerCase().includes(q));
        }
        this.displayedTournaments = toDisplay;
        this.uiManager.setShortlistedUrls(this.shortlist);
        if (toDisplay.length === 0) {
            this.uiManager.prepareEmptyState(this.allTournaments.length, this.buildEmptySuggestions());
        }
        this.uiManager.displayTournaments(toDisplay);
        if (this.deepLinkUrl) {
            const target = this.deepLinkUrl;
            this.deepLinkUrl = null;
            setTimeout(() => this.uiManager.highlightTournament(target), 100);
        }
    }
    exportToCSV() {
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
            this.uiManager.showError(`Exported ${count} tournament${count !== 1 ? 's' : ''} to CSV`, 'success');
        }
        catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.displayedTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
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
    loadShortlist() {
        try {
            const saved = localStorage.getItem(this.SHORTLIST_KEY);
            if (saved) {
                const urls = JSON.parse(saved);
                this.shortlist = new Set(urls);
            }
        }
        catch {
            this.shortlist = new Set();
        }
    }
    saveShortlist() {
        try {
            localStorage.setItem(this.SHORTLIST_KEY, JSON.stringify([...this.shortlist]));
        }
        catch {
        }
    }
    toggleShortlist(url) {
        if (this.shortlist.has(url)) {
            this.shortlist.delete(url);
        }
        else {
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
    initShortlistDelegation() {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList)
            return;
        tournamentList.addEventListener('click', (e) => {
            const btn = e.target.closest('.shortlist-btn');
            if (!btn)
                return;
            e.preventDefault();
            const url = btn.dataset.tournamentUrl;
            if (url) {
                this.toggleShortlist(url);
            }
        });
    }
    initDatePresets() {
        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');
        if (!startDateEl || !endDateEl)
            return;
        document.querySelectorAll('.date-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                const end = new Date(today);
                if (preset === 'month')
                    end.setMonth(end.getMonth() + 1);
                else if (preset === '3months')
                    end.setMonth(end.getMonth() + 3);
                else if (preset === '6months')
                    end.setMonth(end.getMonth() + 6);
                else
                    return;
                startDateEl.valueAsDate = today;
                endDateEl.valueAsDate = end;
            });
        });
    }
    async exportShortlistToCalendar() {
        if (this.shortlist.size === 0) {
            this.uiManager.showError('Star tournaments to add them to your shortlist first', 'warning');
            return;
        }
        if (this.allTournaments.length === 0) {
            await this.preloadTournamentData();
        }
        if (this.allTournaments.length === 0) {
            this.uiManager.showError('Could not load tournament data. Please run a search first, then export your shortlist.', 'warning');
            return;
        }
        const shortlisted = this.allTournaments.filter(t => this.shortlist.has(t.url));
        if (shortlisted.length === 0) {
            this.uiManager.showError('Your shortlisted tournaments are not in the current data set (they may have passed or been removed).', 'warning');
            return;
        }
        try {
            this.exportService.exportMultipleToCalendar(shortlisted);
            this.trackEvent('ICS Export', { type: 'shortlist', count: shortlisted.length });
            this.uiManager.showError(`Exported ${shortlisted.length} shortlisted tournament${shortlisted.length !== 1 ? 's' : ''} to calendar`, 'success');
        }
        catch (error) {
            this.logger.error('Shortlist calendar export failed', error);
            this.uiManager.showError('Failed to export shortlist. Please try again.');
        }
    }
    initCalendarExportDelegation() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.calendar-export-btn');
            if (!btn)
                return;
            e.preventDefault();
            const url = btn.dataset.tournamentUrl;
            if (!url)
                return;
            const tournament = this.displayedTournaments.find(t => t.url === url) ??
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
            }
            catch (error) {
                this.logger.error('Calendar export failed', error);
                this.uiManager.showError('Failed to create calendar event. Please try again.');
            }
        });
    }
    initCopyLinkDelegation() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.copy-link-btn');
            if (!btn)
                return;
            e.preventDefault();
            const url = btn.dataset.tournamentUrl;
            if (!url)
                return;
            const shareUrl = `${location.origin}${location.pathname}?t=${encodeURIComponent(url)}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.uiManager.showCopyLinkFeedback(btn);
                this.trackEvent('Share Link Copied');
            }).catch(() => {
                this.uiManager.showError('Could not copy to clipboard. Please copy the URL manually.', 'warning');
            });
        });
    }
    initKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                const modal = document.getElementById('helpModal');
                if (modal && modal.style.display !== 'none') {
                    this.closeHelpModal();
                }
                else {
                    this.openHelpModal();
                }
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
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const exportShortlistBtn = document.getElementById('exportShortlistBtn');
                if (exportShortlistBtn && exportShortlistBtn.style.display !== 'none') {
                    e.preventDefault();
                    void this.exportShortlistToCalendar();
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
    async checkDataStaleness() {
        try {
            const response = await fetch('tournaments_data_meta.json');
            if (!response.ok)
                return;
            const meta = await response.json();
            if (!meta.generatedAt)
                return;
            const generatedAt = new Date(meta.generatedAt);
            if (isNaN(generatedAt.getTime()))
                return;
            const lastUpdatedTime = document.getElementById('lastUpdatedTime');
            if (lastUpdatedTime) {
                lastUpdatedTime.textContent = generatedAt.toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince > 48) {
                const daysAgo = Math.round(hoursSince / 24);
                this.uiManager.showStalenessBanner(`⚠️ Tournament data is ${daysAgo} day${daysAgo !== 1 ? 's' : ''} old — the daily update may have failed. Some recent tournaments may be missing.`);
            }
        }
        catch (_e) {
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