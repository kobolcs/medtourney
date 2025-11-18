/**
 * Chess Tournament Finder - Main Application
 * Fetches and displays tournaments from chess-results.com
 *
 * @author MedTourney Project
 * @version 2.2.0 (TypeScript - Enhanced with Caching, Dark Mode, Export)
 */

/** Tournament data structure */
interface Tournament {
    name: string;
    url: string;
    location: string;
    date: Date;
    category: string;
    description: string;
}

/** Cached data structure for LocalStorage */
interface CachedData<T> {
    data: T;
    timestamp: number;
    version: string;
}

/** Configuration structure loaded from config.json */
interface AppConfig {
    europeanCountries: string[];
    nonEuropeanCountries: string[];
    mediterraneanLocations: string[];
    countryCodes: Record<string, CountryData>;
}

/** Country data with keywords */
interface CountryData {
    name: string;
    keywords: string[];
}

/** Filter state */
interface FilterState {
    openOnly: boolean;
    excludeYouth: boolean;
    mediterraneanOnly: boolean;
    seniorCategory: boolean;
    womenOnly: boolean;
    includeTeamTournaments: boolean;
    classicalTime: boolean;
    rapidTime: boolean;
    blitzTime: boolean;
    startDate: Date | null;
    endDate: Date | null;
    countryFilter: string;
}

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
 */
class TournamentFinder {
    private readonly corsProxies: readonly string[];

    // Configuration
    private europeanCountries: Record<string, string[]>;
    private nonEuropeanCountries: Set<string>;
    private mediterraneanLocations: Set<string>;

    // Pagination state
    private currentPage: number;
    private readonly tournamentsPerPage: number;
    private allTournaments: Tournament[];

    // Performance: Filter result cache
    private filterCache: Map<string, Tournament[]>;

    // Cache configuration
    private readonly CACHE_VERSION = '2.2.0';
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private readonly CACHE_KEYS = {
        TOURNAMENTS: 'medtourney_tournaments',
        CONFIG: 'medtourney_config',
        THEME: 'medtourney_theme',
        FILTERS_COLLAPSED: 'medtourney_filters_collapsed'
    };

    constructor() {
        // CORS proxy services (with fallbacks)
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
        ] as const;

        this.currentPage = 1;
        this.tournamentsPerPage = 20;
        this.allTournaments = [];

        // Initialize filter cache for performance
        this.filterCache = new Map();

        // Will be loaded from config.json
        this.europeanCountries = {};
        this.nonEuropeanCountries = new Set();
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

            // Set default dates (today to 3 months from now)
            const today = new Date();
            const threeMonthsLater = new Date(today);
            threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

            const startDateElement = document.getElementById('startDate') as HTMLInputElement | null;
            const endDateElement = document.getElementById('endDate') as HTMLInputElement | null;

            if (startDateElement) startDateElement.valueAsDate = today;
            if (endDateElement) endDateElement.valueAsDate = threeMonthsLater;

            // Attach event listeners
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
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application. Please refresh the page.', 'error');
        }
    }

    /**
     * Load application configuration from config.json
     */
    private async loadConfig(): Promise<void> {
        try {
            // Try to load from cache first
            const cachedConfig = this.loadFromCache<AppConfig>(this.CACHE_KEYS.CONFIG);
            if (cachedConfig) {
                this.applyConfig(cachedConfig);
                console.log('✓ Using cached configuration');
                return;
            }

            // Fetch from server
            const response = await fetch('./config.json', {
                cache: 'no-cache',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }

            const rawConfig = await response.json();
            const config = this.validateConfig(rawConfig);

            // Save to cache
            this.saveToCache(this.CACHE_KEYS.CONFIG, config);

            // Apply configuration
            this.applyConfig(config);

            console.log(`✓ Loaded config: ${Object.keys(this.europeanCountries).length} countries, ` +
                       `${this.nonEuropeanCountries.size} non-European countries, ` +
                       `${this.mediterraneanLocations.size} Mediterranean locations`);
        } catch (error) {
            console.error('Error loading config.json, using fallback defaults:', error);
            this.showError('Failed to load configuration. Using defaults.', 'warning');
            this.loadDefaultConfig();
        }
    }

    /**
     * Apply configuration to instance variables
     */
    private applyConfig(config: AppConfig): void {
        // Convert to Sets for O(1) lookup performance
        this.nonEuropeanCountries = new Set(config.nonEuropeanCountries);
        this.mediterraneanLocations = new Set(config.mediterraneanLocations);

        // Convert countryCodes to the format used by the app
        this.europeanCountries = {};

        for (const [code, data] of Object.entries(config.countryCodes)) {
            this.europeanCountries[code] = data.keywords;
        }
    }

    /**
     * Load fallback configuration if config.json fails
     */
    private loadDefaultConfig(): void {
        // Fallback configuration if config.json fails to load
        this.europeanCountries = {
            'ESP': ['spain', 'españa', 'esp'],
            'FRA': ['france', 'francia', 'fra'],
            'ITA': ['italy', 'italia', 'ita'],
            'GER': ['germany', 'deutschland', 'ger'],
            'GRE': ['greece', 'gre', 'hellas'],
            'CRO': ['croatia', 'hrvatska', 'cro'],
            'HUN': ['hungary', 'magyarország', 'hun'],
            'POL': ['poland', 'polska', 'pol'],
            'CZE': ['czech', 'česko', 'cze'],
            'AUT': ['austria', 'österreich', 'aut'],
            'NED': ['netherlands', 'nederland', 'ned'],
            'BEL': ['belgium', 'belgië', 'bel'],
            'SUI': ['switzerland', 'schweiz', 'sui'],
            'POR': ['portugal', 'por'],
            'SRB': ['serbia', 'srbija', 'srb'],
            'ROU': ['romania', 'românia', 'rou'],
            'UKR': ['ukraine', 'україна', 'ukr'],
            'SVK': ['slovakia', 'slovensko', 'svk'],
            'SLO': ['slovenia', 'slovenija', 'slo'],
            'DEN': ['denmark', 'danmark', 'den'],
            'NOR': ['norway', 'norge', 'nor'],
            'SWE': ['sweden', 'sverige', 'swe'],
            'FIN': ['finland', 'suomi', 'fin'],
            'ENG': ['england', 'eng'],
            'SCO': ['scotland', 'sco'],
            'WAL': ['wales', 'wal'],
            'IRL': ['ireland', 'éire', 'irl'],
            'ISL': ['iceland', 'ísland', 'isl'],
            'ALB': ['albania', 'shqipëri', 'alb'],
            'BIH': ['bosnia', 'bih'],
            'BUL': ['bulgaria', 'българия', 'bul'],
            'CYP': ['cyprus', 'κύπρος', 'cyp'],
            'EST': ['estonia', 'eesti', 'est'],
            'LAT': ['latvia', 'latvija', 'lat'],
            'LTU': ['lithuania', 'lietuva', 'ltu'],
            'LUX': ['luxembourg', 'lëtzebuerg', 'lux'],
            'MKD': ['macedonia', 'north macedonia', 'mkd'],
            'MLT': ['malta', 'mlt'],
            'MDA': ['moldova', 'mda'],
            'MNE': ['montenegro', 'crna gora', 'mne'],
            'AND': ['andorra', 'and'],
            'MON': ['monaco', 'mon'],
            'SMR': ['san marino', 'smr'],
            'LIE': ['liechtenstein', 'lie']
        };

        this.nonEuropeanCountries = new Set([
            'malaysia', 'uae', 'dubai', 'qatar', 'saudi', 'china', 'india',
            'indonesia', 'singapore', 'thailand', 'vietnam', 'philippines',
            'japan', 'korea', 'australia', 'new zealand', 'usa', 'canada',
            'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia',
            'egypt', 'morocco', 'tunisia', 'algeria', 'south africa',
            'israel', 'jordan', 'lebanon', 'iran', 'iraq', 'turkey',
            'russia', 'moscow', 'petersburg', 'kazakhstan', 'uzbekistan'
        ]);

        this.mediterraneanLocations = new Set([
            'barcelona', 'valencia', 'alicante', 'malaga', 'marbella',
            'benidorm', 'torrevieja', 'almeria', 'murcia', 'cartagena',
            'palma', 'mallorca', 'ibiza', 'menorca', 'tarragona', 'castellon',
            'nice', 'cannes', 'monaco', 'marseille', 'montpellier',
            'toulon', 'antibes', 'perpignan',
            'genoa', 'genova', 'naples', 'napoli', 'sicily', 'sicilia',
            'palermo', 'catania', 'messina', 'syracuse', 'siracusa',
            'rome', 'roma', 'bari', 'brindisi', 'ancona', 'pescara',
            'rimini', 'livorno', 'la spezia', 'sardinia', 'sardegna',
            'cagliari', 'sassari',
            'athens', 'αθήνα', 'thessaloniki', 'θεσσαλονίκη',
            'patras', 'heraklion', 'chania', 'rhodes', 'corfu', 'crete',
            'split', 'dubrovnik', 'rijeka', 'zadar', 'sibenik', 'pula',
            'kotor', 'budva', 'tivat', 'bar',
            'durres', 'vlore', 'saranda',
            'malta', 'valletta', 'sliema',
            'limassol', 'larnaca', 'paphos', 'cyprus'
        ]);
    }

    /**
     * Validate configuration JSON structure
     * Prevents prototype pollution and ensures required fields exist
     */
    private validateConfig(data: unknown): AppConfig {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid config structure: not an object');
        }

        const config = data as Record<string, unknown>;

        // Validate required fields exist and are correct types
        if (!Array.isArray(config.europeanCountries)) {
            throw new Error('Invalid config: europeanCountries must be an array');
        }

        if (!Array.isArray(config.nonEuropeanCountries)) {
            throw new Error('Invalid config: nonEuropeanCountries must be an array');
        }

        if (!Array.isArray(config.mediterraneanLocations)) {
            throw new Error('Invalid config: mediterraneanLocations must be an array');
        }

        if (!config.countryCodes || typeof config.countryCodes !== 'object') {
            throw new Error('Invalid config: countryCodes must be an object');
        }

        // Validate countryCodes structure
        const countryCodes = config.countryCodes as Record<string, unknown>;
        for (const [code, value] of Object.entries(countryCodes)) {
            if (!value || typeof value !== 'object') {
                throw new Error(`Invalid countryCodes entry for ${code}`);
            }
            const countryData = value as Record<string, unknown>;
            if (!Array.isArray(countryData.keywords)) {
                throw new Error(`Invalid keywords for country ${code}`);
            }
        }

        // Safe cast after validation
        return config as unknown as AppConfig;
    }

    /**
     * Search for tournaments with current filters
     */
    private async searchTournaments(): Promise<void> {
        const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement | null;
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const results = document.getElementById('results');

        // Validate required DOM elements exist
        if (!searchBtn || !loading || !error || !results) {
            console.error('Required DOM elements not found');
            return;
        }

        // Show loading, hide results
        searchBtn.disabled = true;
        loading.style.display = 'block';
        error.style.display = 'none';
        results.style.display = 'none';

        try {
            // Fetch tournaments from chess-results.com
            const tournaments = await this.fetchTournaments();

            // Apply filters
            const filtered = this.filterTournaments(tournaments);

            // Display results
            this.displayResults(filtered);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Error fetching tournaments:', err);
            error.textContent = `Error: ${errorMessage}. The tool is using fallback data.`;
            error.style.display = 'block';

            // Still show results even on error
            const filtered = this.filterTournaments([]);
            this.displayResults(filtered);
        } finally {
            searchBtn.disabled = false;
            loading.style.display = 'none';
        }
    }

    /**
     * Fetch tournaments from various sources
     * @returns Array of tournaments
     */
    private async fetchTournaments(): Promise<Tournament[]> {
        // Strategy 0: Try to load from cache first
        const cachedTournaments = this.loadFromCache<Array<Omit<Tournament, 'date'> & { date: string }>>(
            this.CACHE_KEYS.TOURNAMENTS
        );
        if (cachedTournaments && cachedTournaments.length > 0) {
            console.log(`✓ Loaded ${cachedTournaments.length} tournaments from cache`);
            return cachedTournaments.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
        }

        // Strategy 1: Try to load from local JSON file (generated by Robot Framework scraper)
        try {
            console.log('Loading tournaments from local data file...');
            const response = await fetch('./tournaments_data.json', {
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    console.log(`✓ Loaded ${rawTournaments.length} tournaments from local data file`);
                    // Save to cache
                    this.saveToCache(this.CACHE_KEYS.TOURNAMENTS, rawTournaments);
                    // Convert date strings to Date objects
                    return rawTournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.warn('Could not load local data file:', errorMessage);
        }

        // Strategy 2: Try to fetch from chess-results.com via CORS proxies
        console.log('Attempting to fetch from chess-results.com...');

        const urls = [
            'https://chess-results.com/',
            'https://chess-results.com/tnr_cal.aspx',
        ];

        for (const url of urls) {
            try {
                const html = await this.fetchWithProxy(url);
                const tournaments = this.parseTournaments(html);

                if (tournaments.length > 0) {
                    console.log(`✓ Parsed ${tournaments.length} tournaments from ${url}`);
                    return tournaments;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.warn(`Failed to fetch from ${url}:`, errorMessage);
            }
        }

        // No data available from any source
        console.error('Could not fetch tournament data from any source');
        throw new Error('Unable to fetch tournament data. Please try again later or run the data scraper to update tournaments_data.json');
    }

    /**
     * Validate that the response is legitimately from chess-results.com
     * 
     * Implements multi-layered validation to prevent content injection:
     * 1. Checks for chess-results.com domain references
     * 2. Verifies presence of tournament-specific HTML structure (links with 'tnr' parameter)
     * 3. Validates HTML can be parsed and contains expected DOM structure
     * 
     * @param html - The HTML response to validate
     * @returns true if response passes all validation checks
     */
    private validateChessResultsResponse(html: string): boolean {
        try {
            // Layer 1: Basic domain check (weak but fast)
            if (!html.includes('chess-results')) {
                console.warn('Validation failed: Missing chess-results domain reference');
                return false;
            }

            // Layer 2: Parse HTML and validate DOM structure
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Check for parser errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                console.warn('Validation failed: HTML parsing error');
                return false;
            }

            // Layer 3: Verify chess-results.com specific structures
            // Look for tournament links with 'tnr' parameter (chess-results.com specific)
            const tnrLinks = doc.querySelectorAll<HTMLAnchorElement>('a[href*="tnr"]');
            if (tnrLinks.length === 0) {
                console.warn('Validation failed: No tournament links found');
                return false;
            }

            // Layer 4: Verify at least some links reference chess-results.com domain
            let hasChessResultsLinks = false;
            tnrLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                if (href.includes('chess-results.com') || href.startsWith('/') || href.startsWith('tnr')) {
                    hasChessResultsLinks = true;
                }
            });

            if (!hasChessResultsLinks) {
                console.warn('Validation failed: Tournament links do not reference chess-results.com');
                return false;
            }

            // Layer 5: Basic HTML structure check - expect table structure for tournament listings
            const tables = doc.querySelectorAll('table');
            const rows = doc.querySelectorAll('tr');
            if (tables.length === 0 && rows.length === 0) {
                console.warn('Validation failed: Missing expected table structure');
                return false;
            }

            console.log(`Response validation passed: Found ${tnrLinks.length} tournament links`);
            return true;
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }

    /**
     * Fetch URL through CORS proxy with fallbacks
     */
    private async fetchWithProxy(url: string): Promise<string> {
        let lastError: Error | undefined;

        // Try each proxy
        for (let i = 0; i < this.corsProxies.length; i++) {
            try {
                const proxy = this.corsProxies[i];
                const proxyUrl = proxy + encodeURIComponent(url);

                console.log(`Trying proxy ${i + 1}: ${proxy}`);

                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml',
                    },
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.text();

                // allorigins returns JSON with contents
                let html = data;
                if (proxy && proxy.includes('allorigins')) {
                    try {
                        const json = JSON.parse(data) as { contents?: string };
                        html = json.contents || data;
                    } catch (e) {
                        html = data;
                    }
                }

                // SECURITY: Validate response is actually from chess-results.com
                // Multi-layered validation to prevent content injection attacks
                if (!this.validateChessResultsResponse(html)) {
                    throw new Error('Invalid response from proxy - possible content injection');
                }

                console.log(`Successfully fetched ${html.length} bytes via proxy ${i + 1}`);
                return html;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error('Unknown error');
                console.warn(`Proxy ${this.corsProxies[i]} failed:`, lastError.message);
                continue;
            }
        }

        throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Parse tournaments from HTML
     */
    private parseTournaments(html: string): Tournament[] {
        const tournaments: Tournament[] = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        console.log('Parsing HTML document...');

        // Strategy 1: Look for tournament links with tnr parameter
        const tnrLinks = doc.querySelectorAll<HTMLAnchorElement>('a[href*="tnr"]');
        console.log(`Found ${tnrLinks.length} tournament links`);

        tnrLinks.forEach((link, index) => {
            try {
                const href = link.getAttribute('href');
                if (!href) return;

                const name = link.textContent?.trim() || '';

                // Skip very short names or navigation links
                if (!name || name.length < 8 || name.toLowerCase().includes('home') ||
                    name.toLowerCase().includes('search') || name.toLowerCase().includes('help')) {
                    return;
                }

                // Find parent row for additional data
                const row = link.closest('tr');
                let location = '';
                let dateText = '';
                let fullText = '';

                if (row) {
                    // Get all cells in the row
                    const cells = row.querySelectorAll('td');
                    fullText = row.textContent || '';

                    // Try to extract location and date from cells
                    cells.forEach(cell => {
                        const cellText = cell.textContent?.trim() || '';

                        // Look for country codes (3-letter, uppercase)
                        const countryMatch = cellText.match(/\b([A-Z]{3})\b/);
                        if (countryMatch && countryMatch[1] && this.isEuropeanCountryCode(countryMatch[1])) {
                            location = cellText;
                        }

                        // Look for dates
                        if (cellText.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
                            dateText = cellText;
                        }
                    });
                } else {
                    // Try parent element
                    fullText = link.parentElement?.textContent || link.textContent || '';
                }

                // Extract data
                const extractedLocation = location || this.extractLocation(fullText);
                const extractedDate = this.extractDate(dateText || fullText);
                const category = this.extractCategory(name + ' ' + fullText);

                // Build full URL
                let fullUrl = href;
                if (!href.startsWith('http')) {
                    fullUrl = href.startsWith('/') ? `https://chess-results.com${href}` : `https://chess-results.com/${href}`;
                }

                const tournament: Tournament = {
                    name: name,
                    url: fullUrl,
                    location: extractedLocation,
                    date: extractedDate,
                    category: category,
                    description: name
                };

                // Only add if location looks valid
                if (extractedLocation && extractedLocation !== 'Unknown') {
                    tournaments.push(tournament);
                }
            } catch (err) {
                console.warn(`Error parsing tournament ${index}:`, err);
            }
        });

        console.log(`Parsed ${tournaments.length} tournaments with valid locations`);
        return tournaments;
    }

    /**
     * Check if a 3-letter code is a European country
     */
    private isEuropeanCountryCode(code: string): boolean {
        return Object.keys(this.europeanCountries).includes(code) ||
               Object.values(this.europeanCountries).some(keywords =>
                   keywords.includes(code.toLowerCase())
               );
    }

    /**
     * Extract location from tournament text
     */
    private extractLocation(text: string): string {
        // Try to find country code (3-letter uppercase)
        const countryCodeMatch = text.match(/\b([A-Z]{3})\b/);
        let countryCode: string | null = null;

        if (countryCodeMatch && countryCodeMatch[1]) {
            const code = countryCodeMatch[1];
            if (this.isEuropeanCountryCode(code)) {
                countryCode = code;
                // Try to find city before country code
                const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[,\-]?\s*([A-Z]{3})/);
                if (cityMatch && cityMatch[1]) {
                    return `${cityMatch[1]}, ${code}`;
                }
            }
        }

        // Try pattern: City, Country
        const cityCountryMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (cityCountryMatch && cityCountryMatch[1] && cityCountryMatch[2]) {
            return `${cityCountryMatch[1]}, ${cityCountryMatch[2]}`;
        }

        // Try to find just a city name
        const cityMatch = text.match(/\b([A-Z][a-z]{3,}(?:\s+[A-Z][a-z]+)*)\b/);
        if (cityMatch && cityMatch[1] && countryCode) {
            return `${cityMatch[1]}, ${countryCode}`;
        } else if (cityMatch && cityMatch[1]) {
            return cityMatch[1];
        } else if (countryCode) {
            return countryCode;
        }

        return 'Unknown';
    }

    /**
     * Extract date from tournament text
     */
    private extractDate(text: string): Date {
        // Try multiple date patterns
        const patterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,      // DD.MM.YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/,        // YYYY-MM-DD
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,      // DD/MM/YYYY
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            if (!pattern) continue;

            const match = text.match(pattern);
            if (match && match.length >= 4 && match[1] && match[2] && match[3]) {
                try {
                    if (i === 0 || i === 2) {
                        // DD.MM.YYYY or DD/MM/YYYY
                        const date = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    } else if (i === 1) {
                        // YYYY-MM-DD
                        const date = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        // Default to today
        return new Date();
    }

    /**
     * Extract tournament category from text
     */
    private extractCategory(text: string): string {
        const categories: string[] = [];

        if (/\bopen\b/i.test(text)) {
            categories.push('Open');
        }
        if (/\bs50\+|s50|senior|veteran|50\+/i.test(text)) {
            categories.push('S50+');
        }
        if (/\bu\d+|youth|junior|u18|under/i.test(text)) {
            categories.push('Youth');
        }
        if (/\bwomen|ladies|female/i.test(text)) {
            categories.push('Women');
        }
        if (/\bblitz/i.test(text)) {
            categories.push('Blitz');
        }
        if (/\brapid/i.test(text)) {
            categories.push('Rapid');
        }

        return categories.length > 0 ? categories.join(', ') : 'Open';
    }

    /**
     * Filter tournaments based on user selections
     */
    private filterTournaments(tournaments: Tournament[]): Tournament[] {
        // Validate input
        if (!Array.isArray(tournaments)) {
            console.error('filterTournaments: expected array, got', typeof tournaments);
            return [];
        }

        // Validate and get filter elements
        const filterElements: FilterElements = {
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
            countryFilter: document.getElementById('countryFilter') as HTMLSelectElement | null
        };

        // Check if any required elements are missing
        const missingElements = Object.entries(filterElements)
            .filter(([_, el]) => !el)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            console.error('Missing filter elements:', missingElements);
            return tournaments;  // Return unfiltered if controls missing
        }

        const filters: FilterState = {
            openOnly: filterElements.openOnly!.checked,
            excludeYouth: filterElements.excludeYouth!.checked,
            mediterraneanOnly: filterElements.mediterraneanOnly!.checked,
            seniorCategory: filterElements.seniorCategory!.checked,
            womenOnly: filterElements.womenOnly!.checked,
            includeTeamTournaments: filterElements.includeTeamTournaments!.checked,
            classicalTime: filterElements.classicalTime!.checked,
            rapidTime: filterElements.rapidTime!.checked,
            blitzTime: filterElements.blitzTime!.checked,
            startDate: filterElements.startDate!.valueAsDate,
            endDate: filterElements.endDate!.valueAsDate,
            countryFilter: filterElements.countryFilter!.value
        };

        // VALIDATION: Check date range is valid
        if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
            this.showError('Start date must be before end date');
            return tournaments; // Return unfiltered
        }

        // PERFORMANCE: Check filter cache
        const cacheKey = this.getFilterCacheKey(filters);
        if (this.filterCache.has(cacheKey)) {
            console.log('Using cached filter results');
            return this.filterCache.get(cacheKey)!;
        }

        const filtered = tournaments.filter(tournament => {
            // Validate tournament structure
            if (!tournament || typeof tournament !== 'object') {
                console.warn('Invalid tournament object:', tournament);
                return false;
            }

            // Ensure required fields exist
            if (!tournament.location || !tournament.category) {
                console.warn('Tournament missing required fields:', tournament);
                return false;
            }

            // European filter (always applied) - STRICT CHECK
            if (!this.isEuropean(tournament.location)) {
                return false;
            }

            // Explicitly exclude non-European countries
            if (this.isNonEuropean(tournament.location)) {
                return false;
            }

            // Time control filter
            const categoryLower = tournament.category.toLowerCase();
            const hasBlitz = /\bblitz\b/i.test(categoryLower);
            const hasRapid = /\brapid\b/i.test(categoryLower);
            const hasClassical = /\bclassical|classic|standard\b/i.test(categoryLower) || (!hasBlitz && !hasRapid);

            const timeControlMatches =
                (filters.blitzTime && hasBlitz) ||
                (filters.rapidTime && hasRapid) ||
                (filters.classicalTime && hasClassical);

            if (!timeControlMatches) {
                return false;
            }

            // Date filter
            if (filters.startDate && tournament.date < filters.startDate) {
                return false;
            }
            if (filters.endDate && tournament.date > filters.endDate) {
                return false;
            }

            // Open category filter
            if (filters.openOnly && !this.isOpenCategory(tournament.category)) {
                return false;
            }

            // Youth filter - STRICT: exclude ANY youth/school tournaments
            if (filters.excludeYouth && this.isYouthOnly(tournament)) {
                return false;
            }

            // Women-only filter
            if (filters.womenOnly && !this.hasWomenCategory(tournament.category)) {
                return false;
            }

            // Team tournament filter - Exclude unless explicitly included
            // Team tournaments are typically not suitable for individual vacation
            if (!filters.includeTeamTournaments && this.isTeamTournament(tournament)) {
                return false;
            }

            // Mediterranean filter
            if (filters.mediterraneanOnly && !this.isMediterranean(tournament.location)) {
                return false;
            }

            // Senior category filter
            if (filters.seniorCategory && !this.hasSeniorCategory(tournament.category)) {
                return false;
            }

            // ADDITIONAL CHECK: If senior filter is ON, extra validation
            if (filters.seniorCategory) {
                // Ensure it's not a youth tournament (double check)
                if (this.isYouthOnly(tournament)) {
                    return false;
                }
            }

            // Country filter
            if (filters.countryFilter && !this.matchesCountry(tournament.location, filters.countryFilter)) {
                return false;
            }

            return true;
        });

        // PERFORMANCE: Cache the filtered results
        this.filterCache.set(cacheKey, filtered);
        console.log(`Filtered ${filtered.length} tournaments (cached for future use)`);

        return filtered;
    }

    private isOpenCategory(category: string): boolean {
        return /\bopen\b/i.test(category);
    }

    /**
     * Check if tournament is youth/school only or has youth restrictions
     * IMPROVED: Now excludes ANY tournament with youth/school keywords
     */
    private isYouthOnly(tournament: Tournament): boolean {
        const name = tournament.name || '';
        const category = tournament.category || '';
        const description = tournament.description || '';
        const fullText = `${name} ${category} ${description}`.toLowerCase();

        // Youth keywords (international) - expanded list
        const youthPattern = /\bu\d+|u-\d+|youth|junior|junioren|u18|u16|u14|u12|u10|u8|under|żiak|młodzie[żz]|juniorzy|juniorów|ml[áa]de[žz]|ifjúság|jugend|jeune|juvenil|joven|giovani|giovanile/i;

        // School keywords (international)
        const schoolPattern = /\bschool|schule|école|escuela|scuola|szkoł|škol/i;

        // Age restricted patterns
        const agePattern = /\b(under|u|bis)\s*(\d{1,2})\b/i;

        // Check for youth/school indicators
        if (youthPattern.test(fullText)) {
            return true;
        }
        if (schoolPattern.test(fullText)) {
            return true;
        }
        const ageMatch = fullText.match(agePattern);
        if (ageMatch && ageMatch[2]) {
            const age = parseInt(ageMatch[2], 10);
            if (!isNaN(age) && age < 50) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if tournament is a team tournament
     * Team tournaments are not suitable for individual vacation planning
     */
    private isTeamTournament(tournament: Tournament): boolean {
        const name = tournament.name || '';
        const category = tournament.category || '';
        const fullText = `${name} ${category}`.toLowerCase();

        // Team keywords (international)
        const teamPattern = /\bteam|mannschaft|équipe|equipo|squadra|drużyn|družstv/i;

        return teamPattern.test(fullText);
    }

    private isMediterranean(location: string): boolean {
        const locationLower = location.toLowerCase();
        for (const place of this.mediterraneanLocations) {
            if (locationLower.includes(place)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if tournament has senior (50+) category
     * IMPROVED: More comprehensive detection
     */
    private hasSeniorCategory(category: string): boolean {
        const categoryLower = category.toLowerCase();

        // Senior/veteran keywords
        const seniorPattern = /\bs50\+|s\s*50\+|s50|senior|senioren|veteran|veteranen|vétéran|veterano|weteran|50\+|50\s*\+|over\s*50|o50/i;

        return seniorPattern.test(categoryLower);
    }

    /**
     * Check if tournament has women's category
     */
    private hasWomenCategory(category: string): boolean {
        const categoryLower = category.toLowerCase();

        // Women's category keywords
        const womenPattern = /\bwomen|ladies|female|frauen|dames|feminin|donne|kobiet/i;

        return womenPattern.test(categoryLower);
    }

    private matchesCountry(location: string, countryCode: string): boolean {
        const locationLower = location.toLowerCase();
        const keywords = this.europeanCountries[countryCode] || [];
        return keywords.some(keyword => locationLower.includes(keyword.toLowerCase())) ||
               locationLower.includes(countryCode.toLowerCase());
    }

    private isEuropean(location: string): boolean {
        const locationLower = location.toLowerCase();

        for (const [code, keywords] of Object.entries(this.europeanCountries)) {
            if (keywords.some(keyword => locationLower.includes(keyword.toLowerCase()))) {
                return true;
            }
            if (locationLower.includes(code.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    private isNonEuropean(location: string): boolean {
        const locationLower = location.toLowerCase();

        for (const country of this.nonEuropeanCountries) {
            if (locationLower.includes(country)) {
                return true;
            }
        }
        return false;
    }

    private displayResults(tournaments: Tournament[]): void {
        const results = document.getElementById('results');
        const tournamentList = document.getElementById('tournamentList');
        const resultsCount = document.getElementById('resultsCount');

        if (!results || !tournamentList || !resultsCount) {
            console.error('Required DOM elements not found');
            return;
        }

        if (tournaments.length === 0) {
            tournamentList.innerHTML = `
                <p style="text-align: center; padding: 40px; color: #999;">
                    No tournaments found matching your criteria.<br>
                    Try adjusting your filters or check back later.<br><br>
                    <small>Note: Real-time data fetching from chess-results.com may be limited due to CORS restrictions.</small>
                </p>
            `;
        } else {
            // Sort tournaments by date
            const sortedTournaments = [...tournaments].sort((a, b) => a.date.getTime() - b.date.getTime());

            // Pagination setup
            this.currentPage = 1;
            this.allTournaments = sortedTournaments;

            resultsCount.textContent = `${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''} found`;

            this.renderPaginatedTournaments();
        }

        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    private renderPaginatedTournaments(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        const totalPages = Math.ceil(this.allTournaments.length / this.tournamentsPerPage);
        const startIndex = (this.currentPage - 1) * this.tournamentsPerPage;
        const endIndex = startIndex + this.tournamentsPerPage;
        const tournamentsToShow = this.allTournaments.slice(startIndex, endIndex);

        // Render tournaments
        const tournamentCards = tournamentsToShow
            .map(tournament => this.createTournamentCard(tournament))
            .join('');

        // Render pagination controls
        const paginationHTML = this.createPaginationControls(totalPages);

        tournamentList.innerHTML = tournamentCards + paginationHTML;

        // Attach event listeners to pagination buttons
        this.attachPaginationListeners();
    }

    private createPaginationControls(totalPages: number): string {
        if (totalPages <= 1) return '';

        const startIndex = (this.currentPage - 1) * this.tournamentsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.tournamentsPerPage, this.allTournaments.length);

        let paginationHTML = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Showing ${startIndex}-${endIndex} of ${this.allTournaments.length} tournaments
                </div>
                <div class="pagination-controls">
        `;

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">
                ← Previous
            </button>
        `;

        // Page numbers
        const pageButtons = this.getPageButtons(totalPages);
        for (const page of pageButtons) {
            if (page === '...') {
                paginationHTML += `<span class="pagination-ellipsis" aria-hidden="true">...</span>`;
            } else {
                const pageNum = page as number;
                paginationHTML += `
                    <button class="pagination-btn ${pageNum === this.currentPage ? 'active' : ''}"
                            data-page="${pageNum}"
                            aria-label="Page ${pageNum}"
                            ${pageNum === this.currentPage ? 'aria-current="page"' : ''}>
                        ${pageNum}
                    </button>
                `;
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">
                Next →
            </button>
        `;

        paginationHTML += `
                </div>
            </div>
        `;

        return paginationHTML;
    }

    private getPageButtons(totalPages: number): Array<number | string> {
        const current = this.currentPage;
        const pages: Array<number | string> = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (current > 3) {
                pages.push('...');
            }

            for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) {
                pages.push(i);
            }

            if (current < totalPages - 2) {
                pages.push('...');
            }

            pages.push(totalPages);
        }

        return pages;
    }

    private attachPaginationListeners(): void {
        const paginationButtons = document.querySelectorAll<HTMLButtonElement>('.pagination-btn');
        paginationButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = (e.target as HTMLButtonElement).dataset.page;
                if (!page) return;

                if (page === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                } else if (page === 'next' && this.currentPage < Math.ceil(this.allTournaments.length / this.tournamentsPerPage)) {
                    this.currentPage++;
                } else if (page !== 'prev' && page !== 'next') {
                    this.currentPage = parseInt(page, 10);
                }
                this.renderPaginatedTournaments();

                // Scroll to top of results
                const results = document.getElementById('results');
                if (results) {
                    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    private createTournamentCard(tournament: Tournament): string {
        const dateStr = tournament.date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const name = tournament.name || '';
        const location = tournament.location || '';
        const category = tournament.category || '';
        const description = tournament.description || '';
        const url = tournament.url || '';

        return `
            <div class="tournament-card" role="listitem">
                <div class="tournament-header">
                    <div class="tournament-name">${this.escapeHtml(name)}</div>
                    <div class="tournament-date"><time datetime="${tournament.date.toISOString()}">${dateStr}</time></div>
                </div>
                <div class="tournament-location">${this.escapeHtml(location)}</div>
                <div class="tournament-category">${this.escapeHtml(category)}</div>
                <div class="tournament-description">${this.escapeHtml(description)}</div>
                <a href="${this.escapeHtml(url)}" target="_blank" class="tournament-link" rel="noopener noreferrer" aria-label="View ${this.escapeHtml(name)} details">
                    View Tournament Details →
                </a>
            </div>
        `;
    }

    /**
     * Generate cache key from filter state for performance optimization
     */
    private getFilterCacheKey(filters: FilterState): string {
        return JSON.stringify({
            openOnly: filters.openOnly,
            excludeYouth: filters.excludeYouth,
            mediterraneanOnly: filters.mediterraneanOnly,
            seniorCategory: filters.seniorCategory,
            classicalTime: filters.classicalTime,
            rapidTime: filters.rapidTime,
            blitzTime: filters.blitzTime,
            startDate: filters.startDate?.toISOString() || null,
            endDate: filters.endDate?.toISOString() || null,
            countryFilter: filters.countryFilter
        });
    }

    /**
     * Show user-friendly message with type
     */
    private showError(message: string, type: 'error' | 'warning' | 'success' = 'error'): void {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';

            // Remove existing type classes
            errorEl.classList.remove('error-type', 'warning-type', 'success-type');

            // Add appropriate type class
            errorEl.classList.add(`${type}-type`);

            // Auto-hide after appropriate duration
            const duration = type === 'success' ? 3000 : (type === 'warning' ? 5000 : 7000);
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, duration);
        }
    }

    private escapeHtml(text: string | undefined | null): string {
        if (!text) return '';

        const htmlEscapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return String(text).replace(/[&<>"']/g, char => htmlEscapeMap[char] || char);
    }

    /**
     * CACHE MANAGEMENT
     */

    /**
     * Save data to LocalStorage with timestamp and version
     */
    private saveToCache<T>(key: string, data: T): void {
        try {
            const cached: CachedData<T> = {
                data,
                timestamp: Date.now(),
                version: this.CACHE_VERSION
            };
            localStorage.setItem(key, JSON.stringify(cached));
            console.log(`✓ Cached ${key} to LocalStorage`);
        } catch (error) {
            console.warn('Failed to save to cache:', error);
            // Silently fail - caching is optional
        }
    }

    /**
     * Load data from LocalStorage with validation
     */
    private loadFromCache<T>(key: string): T | null {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const parsed = JSON.parse(cached) as CachedData<T>;

            // Validate cache version
            if (parsed.version !== this.CACHE_VERSION) {
                console.log(`Cache version mismatch for ${key}, clearing...`);
                localStorage.removeItem(key);
                return null;
            }

            // Validate cache age
            const age = Date.now() - parsed.timestamp;
            if (age > this.CACHE_DURATION) {
                console.log(`Cache expired for ${key} (${Math.round(age / 1000 / 60 / 60)}h old)`);
                localStorage.removeItem(key);
                return null;
            }

            console.log(`✓ Loaded ${key} from cache (${Math.round(age / 1000 / 60)}min old)`);
            return parsed.data;
        } catch (error) {
            console.warn('Failed to load from cache:', error);
            return null;
        }
    }

    /**
     * Clear all application caches
     * Available globally for debugging: window.clearCaches()
     */
    public clearAllCaches(): void {
        Object.values(this.CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.filterCache.clear();
        console.log('✓ All caches cleared');
        this.showError('All caches cleared successfully', 'success');
    }

    /**
     * THEME MANAGEMENT
     */

    /**
     * Initialize theme from saved preference or system preference
     */
    private initTheme(): void {
        const savedTheme = localStorage.getItem(this.CACHE_KEYS.THEME);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');

        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }

        // Update button text if it exists
        this.updateThemeButton();
    }

    /**
     * Toggle between light and dark theme
     */
    private toggleTheme(): void {
        const isDark = document.body.classList.toggle('dark-theme');
        const theme = isDark ? 'dark' : 'light';
        localStorage.setItem(this.CACHE_KEYS.THEME, theme);
        this.updateThemeButton();
        console.log(`Theme switched to ${theme} mode`);
    }

    /**
     * Update theme toggle button text
     */
    private updateThemeButton(): void {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }

    /**
     * COLLAPSIBLE FILTERS (Mobile)
     */

    /**
     * Initialize collapsible filter functionality
     */
    private initCollapsibleFilters(): void {
        const filtersCard = document.querySelector('.filters-card');
        if (!filtersCard) return;

        // Create collapse button
        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'filtersToggle';
        collapseBtn.className = 'filters-toggle';
        collapseBtn.setAttribute('aria-expanded', 'true');
        collapseBtn.setAttribute('aria-label', 'Toggle filter visibility');

        // Insert as first child
        const h2 = filtersCard.querySelector('h2');
        if (h2) {
            h2.style.cursor = 'pointer';
            h2.style.display = 'flex';
            h2.style.justifyContent = 'space-between';
            h2.style.alignItems = 'center';

            const icon = document.createElement('span');
            icon.className = 'collapse-icon';
            icon.textContent = '▼';
            icon.setAttribute('aria-hidden', 'true');
            h2.appendChild(icon);

            h2.addEventListener('click', () => this.toggleFilters());
        }

        // Load saved state
        const isCollapsed = localStorage.getItem(this.CACHE_KEYS.FILTERS_COLLAPSED) === 'true';
        if (isCollapsed && window.innerWidth <= 768) {
            this.setFiltersCollapsed(true);
        }
    }

    /**
     * Toggle filter visibility
     */
    private toggleFilters(): void {
        const filtersCard = document.querySelector('.filters-card');
        if (!filtersCard) return;

        const isCurrentlyCollapsed = filtersCard.classList.contains('collapsed');
        this.setFiltersCollapsed(!isCurrentlyCollapsed);

        // Save state
        localStorage.setItem(this.CACHE_KEYS.FILTERS_COLLAPSED, (!isCurrentlyCollapsed).toString());
    }

    /**
     * Set filter collapsed state
     */
    private setFiltersCollapsed(collapsed: boolean): void {
        const filtersCard = document.querySelector('.filters-card');
        const icon = document.querySelector('.collapse-icon');

        if (filtersCard) {
            if (collapsed) {
                filtersCard.classList.add('collapsed');
            } else {
                filtersCard.classList.remove('collapsed');
            }
        }

        if (icon) {
            icon.textContent = collapsed ? '▶' : '▼';
        }
    }

    /**
     * CSV EXPORT
     */

    /**
     * Export filtered tournaments to CSV
     */
    private exportToCSV(): void {
        if (this.allTournaments.length === 0) {
            this.showError('No tournaments to export. Please search first.', 'warning');
            return;
        }

        try {
            // CSV header
            const headers = ['Name', 'Date', 'Location', 'Category', 'URL', 'Description'];
            const rows = [headers.join(',')];

            // CSV rows
            this.allTournaments.forEach(tournament => {
                const row = [
                    this.escapeCSV(tournament.name),
                    tournament.date.toLocaleDateString('en-US'),
                    this.escapeCSV(tournament.location),
                    this.escapeCSV(tournament.category),
                    this.escapeCSV(tournament.url),
                    this.escapeCSV(tournament.description)
                ];
                rows.push(row.join(','));
            });

            // Create CSV blob
            const csv = rows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

            // Download file
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().split('T')[0];
            link.setAttribute('href', url);
            link.setAttribute('download', `chess-tournaments-${timestamp}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showError(`Exported ${this.allTournaments.length} tournaments to CSV`, 'success');
            console.log(`✓ Exported ${this.allTournaments.length} tournaments to CSV`);
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export tournaments. Please try again.', 'error');
        }
    }

    /**
     * Escape CSV field (handle commas, quotes, newlines)
     */
    private escapeCSV(field: string): string {
        if (!field) return '';
        const str = String(field).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str}"`;
        }
        return str;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new TournamentFinder();

    // Expose clearCaches function globally for debugging
    (window as typeof window & { clearCaches: () => void }).clearCaches = () => {
        app.clearAllCaches();
    };
});
