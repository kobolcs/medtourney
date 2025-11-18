"use strict";
class TournamentFinder {
    constructor() {
        this.CACHE_VERSION = '2.3.0';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000;
        this.CACHE_KEYS = {
            TOURNAMENTS: 'medtourney_tournaments',
            CONFIG: 'medtourney_config',
            THEME: 'medtourney_theme',
            FILTERS_COLLAPSED: 'medtourney_filters_collapsed',
            FILTER_PREFERENCES: 'medtourney_filter_preferences'
        };
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
        ];
        this.currentPage = 1;
        this.tournamentsPerPage = 20;
        this.allTournaments = [];
        this.filterCache = new Map();
        this.europeanCountries = {};
        this.nonEuropeanCountries = new Set();
        this.mediterraneanLocations = new Set();
        void this.initAsync();
    }
    async initAsync() {
        try {
            this.initTheme();
            this.initCollapsibleFilters();
            await this.loadConfig();
            const today = new Date();
            const threeMonthsLater = new Date(today);
            threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
            const startDateElement = document.getElementById('startDate');
            const endDateElement = document.getElementById('endDate');
            if (startDateElement)
                startDateElement.valueAsDate = today;
            if (endDateElement)
                endDateElement.valueAsDate = threeMonthsLater;
            this.loadFilterPreferences();
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
            this.attachFilterChangeListeners();
        }
        catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application. Please refresh the page.', 'error');
        }
    }
    async loadConfig() {
        try {
            const cachedConfig = this.loadFromCache(this.CACHE_KEYS.CONFIG);
            if (cachedConfig) {
                this.applyConfig(cachedConfig);
                console.log('✓ Using cached configuration');
                return;
            }
            const response = await fetch('./config.json', {
                cache: 'no-cache',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }
            const rawConfig = await response.json();
            const config = this.validateConfig(rawConfig);
            this.saveToCache(this.CACHE_KEYS.CONFIG, config);
            this.applyConfig(config);
            console.log(`✓ Loaded config: ${Object.keys(this.europeanCountries).length} countries, ` +
                `${this.nonEuropeanCountries.size} non-European countries, ` +
                `${this.mediterraneanLocations.size} Mediterranean locations`);
        }
        catch (error) {
            console.error('Error loading config.json, using fallback defaults:', error);
            this.showError('Failed to load configuration. Using defaults.', 'warning');
            this.loadDefaultConfig();
        }
    }
    applyConfig(config) {
        this.nonEuropeanCountries = new Set(config.nonEuropeanCountries);
        this.mediterraneanLocations = new Set(config.mediterraneanLocations);
        this.europeanCountries = {};
        for (const [code, data] of Object.entries(config.countryCodes)) {
            this.europeanCountries[code] = data.keywords;
        }
    }
    loadDefaultConfig() {
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
    validateConfig(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid config structure: not an object');
        }
        const config = data;
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
        const countryCodes = config.countryCodes;
        for (const [code, value] of Object.entries(countryCodes)) {
            if (!value || typeof value !== 'object') {
                throw new Error(`Invalid countryCodes entry for ${code}`);
            }
            const countryData = value;
            if (!Array.isArray(countryData.keywords)) {
                throw new Error(`Invalid keywords for country ${code}`);
            }
        }
        return config;
    }
    async searchTournaments() {
        const searchBtn = document.getElementById('searchBtn');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const results = document.getElementById('results');
        if (!searchBtn || !loading || !error || !results) {
            console.error('Required DOM elements not found');
            return;
        }
        searchBtn.disabled = true;
        loading.style.display = 'block';
        error.style.display = 'none';
        results.style.display = 'none';
        try {
            const tournaments = await this.fetchTournaments();
            const filtered = this.filterTournaments(tournaments);
            this.displayResults(filtered);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Error fetching tournaments:', err);
            error.textContent = `Error: ${errorMessage}. The tool is using fallback data.`;
            error.style.display = 'block';
            const filtered = this.filterTournaments([]);
            this.displayResults(filtered);
        }
        finally {
            searchBtn.disabled = false;
            loading.style.display = 'none';
        }
    }
    async fetchTournaments() {
        const cachedTournaments = this.loadFromCache(this.CACHE_KEYS.TOURNAMENTS);
        if (cachedTournaments && cachedTournaments.length > 0) {
            console.log(`✓ Loaded ${cachedTournaments.length} tournaments from cache`);
            return cachedTournaments.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
        }
        try {
            console.log('Loading tournaments from local data file...');
            const response = await fetch('./tournaments_data.json', {
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const rawTournaments = await response.json();
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    console.log(`✓ Loaded ${rawTournaments.length} tournaments from local data file`);
                    this.saveToCache(this.CACHE_KEYS.TOURNAMENTS, rawTournaments);
                    return rawTournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.warn('Could not load local data file:', errorMessage);
        }
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
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.warn(`Failed to fetch from ${url}:`, errorMessage);
            }
        }
        console.error('Could not fetch tournament data from any source');
        throw new Error('Unable to fetch tournament data. Please try again later or run the data scraper to update tournaments_data.json');
    }
    validateChessResultsResponse(html) {
        try {
            if (!html.includes('chess-results')) {
                console.warn('Validation failed: Missing chess-results domain reference');
                return false;
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                console.warn('Validation failed: HTML parsing error');
                return false;
            }
            const tnrLinks = doc.querySelectorAll('a[href*="tnr"]');
            if (tnrLinks.length === 0) {
                console.warn('Validation failed: No tournament links found');
                return false;
            }
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
            const tables = doc.querySelectorAll('table');
            const rows = doc.querySelectorAll('tr');
            if (tables.length === 0 && rows.length === 0) {
                console.warn('Validation failed: Missing expected table structure');
                return false;
            }
            console.log(`Response validation passed: Found ${tnrLinks.length} tournament links`);
            return true;
        }
        catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }
    async fetchWithProxy(url) {
        let lastError;
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
                let html = data;
                if (proxy && proxy.includes('allorigins')) {
                    try {
                        const json = JSON.parse(data);
                        html = json.contents || data;
                    }
                    catch (e) {
                        html = data;
                    }
                }
                if (!this.validateChessResultsResponse(html)) {
                    throw new Error('Invalid response from proxy - possible content injection');
                }
                console.log(`Successfully fetched ${html.length} bytes via proxy ${i + 1}`);
                return html;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error('Unknown error');
                console.warn(`Proxy ${this.corsProxies[i]} failed:`, lastError.message);
                continue;
            }
        }
        throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    parseTournaments(html) {
        const tournaments = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        console.log('Parsing HTML document...');
        const tnrLinks = doc.querySelectorAll('a[href*="tnr"]');
        console.log(`Found ${tnrLinks.length} tournament links`);
        tnrLinks.forEach((link, index) => {
            try {
                const href = link.getAttribute('href');
                if (!href)
                    return;
                const name = link.textContent?.trim() || '';
                if (!name || name.length < 8 || name.toLowerCase().includes('home') ||
                    name.toLowerCase().includes('search') || name.toLowerCase().includes('help')) {
                    return;
                }
                const row = link.closest('tr');
                let location = '';
                let dateText = '';
                let fullText = '';
                if (row) {
                    const cells = row.querySelectorAll('td');
                    fullText = row.textContent || '';
                    cells.forEach(cell => {
                        const cellText = cell.textContent?.trim() || '';
                        const countryMatch = cellText.match(/\b([A-Z]{3})\b/);
                        if (countryMatch && countryMatch[1] && this.isEuropeanCountryCode(countryMatch[1])) {
                            location = cellText;
                        }
                        if (cellText.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
                            dateText = cellText;
                        }
                    });
                }
                else {
                    fullText = link.parentElement?.textContent || link.textContent || '';
                }
                const extractedLocation = location || this.extractLocation(fullText);
                const extractedDate = this.extractDate(dateText || fullText);
                const category = this.extractCategory(name + ' ' + fullText);
                let fullUrl = href;
                if (!href.startsWith('http')) {
                    fullUrl = href.startsWith('/') ? `https://chess-results.com${href}` : `https://chess-results.com/${href}`;
                }
                const tournament = {
                    name: name,
                    url: fullUrl,
                    location: extractedLocation,
                    date: extractedDate,
                    category: category,
                    description: name
                };
                if (extractedLocation && extractedLocation !== 'Unknown') {
                    tournaments.push(tournament);
                }
            }
            catch (err) {
                console.warn(`Error parsing tournament ${index}:`, err);
            }
        });
        console.log(`Parsed ${tournaments.length} tournaments with valid locations`);
        return tournaments;
    }
    isEuropeanCountryCode(code) {
        return Object.keys(this.europeanCountries).includes(code) ||
            Object.values(this.europeanCountries).some(keywords => keywords.includes(code.toLowerCase()));
    }
    extractLocation(text) {
        const countryCodeMatch = text.match(/\b([A-Z]{3})\b/);
        let countryCode = null;
        if (countryCodeMatch && countryCodeMatch[1]) {
            const code = countryCodeMatch[1];
            if (this.isEuropeanCountryCode(code)) {
                countryCode = code;
                const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[,\-]?\s*([A-Z]{3})/);
                if (cityMatch && cityMatch[1]) {
                    return `${cityMatch[1]}, ${code}`;
                }
            }
        }
        const cityCountryMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (cityCountryMatch && cityCountryMatch[1] && cityCountryMatch[2]) {
            return `${cityCountryMatch[1]}, ${cityCountryMatch[2]}`;
        }
        const cityMatch = text.match(/\b([A-Z][a-z]{3,}(?:\s+[A-Z][a-z]+)*)\b/);
        if (cityMatch && cityMatch[1] && countryCode) {
            return `${cityMatch[1]}, ${countryCode}`;
        }
        else if (cityMatch && cityMatch[1]) {
            return cityMatch[1];
        }
        else if (countryCode) {
            return countryCode;
        }
        return 'Unknown';
    }
    extractDate(text) {
        const patterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
            /(\d{4})-(\d{1,2})-(\d{1,2})/,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        ];
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            if (!pattern)
                continue;
            const match = text.match(pattern);
            if (match && match.length >= 4 && match[1] && match[2] && match[3]) {
                try {
                    if (i === 0 || i === 2) {
                        const date = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    }
                    else if (i === 1) {
                        const date = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    }
                }
                catch (e) {
                    continue;
                }
            }
        }
        return new Date();
    }
    extractCategory(text) {
        const categories = [];
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
    filterTournaments(tournaments) {
        if (!Array.isArray(tournaments)) {
            console.error('filterTournaments: expected array, got', typeof tournaments);
            return [];
        }
        const filterElements = {
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
            countryFilter: document.getElementById('countryFilter')
        };
        const missingElements = Object.entries(filterElements)
            .filter(([_, el]) => !el)
            .map(([name]) => name);
        if (missingElements.length > 0) {
            console.error('Missing filter elements:', missingElements);
            return tournaments;
        }
        const filters = {
            openOnly: filterElements.openOnly.checked,
            excludeYouth: filterElements.excludeYouth.checked,
            mediterraneanOnly: filterElements.mediterraneanOnly.checked,
            seniorCategory: filterElements.seniorCategory.checked,
            womenOnly: filterElements.womenOnly.checked,
            includeTeamTournaments: filterElements.includeTeamTournaments.checked,
            classicalTime: filterElements.classicalTime.checked,
            rapidTime: filterElements.rapidTime.checked,
            blitzTime: filterElements.blitzTime.checked,
            startDate: filterElements.startDate.valueAsDate,
            endDate: filterElements.endDate.valueAsDate,
            countryFilter: filterElements.countryFilter.value
        };
        if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
            this.showError('Start date must be before end date');
            return tournaments;
        }
        const cacheKey = this.getFilterCacheKey(filters);
        if (this.filterCache.has(cacheKey)) {
            console.log('Using cached filter results');
            return this.filterCache.get(cacheKey);
        }
        const filtered = tournaments.filter(tournament => {
            if (!tournament || typeof tournament !== 'object') {
                console.warn('Invalid tournament object:', tournament);
                return false;
            }
            if (!tournament.location || !tournament.category) {
                console.warn('Tournament missing required fields:', tournament);
                return false;
            }
            if (!this.isEuropean(tournament.location)) {
                return false;
            }
            if (this.isNonEuropean(tournament.location)) {
                return false;
            }
            const categoryLower = tournament.category.toLowerCase();
            const hasBlitz = /\bblitz\b/i.test(categoryLower);
            const hasRapid = /\brapid\b/i.test(categoryLower);
            const hasClassical = /\bclassical|classic|standard\b/i.test(categoryLower) || (!hasBlitz && !hasRapid);
            const timeControlMatches = (filters.blitzTime && hasBlitz) ||
                (filters.rapidTime && hasRapid) ||
                (filters.classicalTime && hasClassical);
            if (!timeControlMatches) {
                return false;
            }
            if (filters.startDate && tournament.date < filters.startDate) {
                return false;
            }
            if (filters.endDate && tournament.date > filters.endDate) {
                return false;
            }
            if (filters.openOnly && !this.isOpenCategory(tournament.category)) {
                return false;
            }
            if (filters.excludeYouth && this.isYouthOnly(tournament)) {
                return false;
            }
            if (filters.womenOnly && !this.hasWomenCategory(tournament.category)) {
                return false;
            }
            if (!filters.includeTeamTournaments && this.isTeamTournament(tournament)) {
                return false;
            }
            if (filters.mediterraneanOnly && !this.isMediterranean(tournament.location)) {
                return false;
            }
            if (filters.seniorCategory && !this.hasSeniorCategory(tournament.category)) {
                return false;
            }
            if (filters.seniorCategory) {
                if (this.isYouthOnly(tournament)) {
                    return false;
                }
            }
            if (filters.countryFilter && !this.matchesCountry(tournament.location, filters.countryFilter)) {
                return false;
            }
            return true;
        });
        this.filterCache.set(cacheKey, filtered);
        console.log(`Filtered ${filtered.length} tournaments (cached for future use)`);
        return filtered;
    }
    isOpenCategory(category) {
        return /\bopen\b/i.test(category);
    }
    isYouthOnly(tournament) {
        const name = tournament.name || '';
        const category = tournament.category || '';
        const description = tournament.description || '';
        const fullText = `${name} ${category} ${description}`.toLowerCase();
        const youthPattern = /\bu\d+|u-\d+|youth|junior|junioren|u18|u16|u14|u12|u10|u8|under|żiak|młodzie[żz]|juniorzy|juniorów|ml[áa]de[žz]|ifjúság|jugend|jeune|juvenil|joven|giovani|giovanile/i;
        const schoolPattern = /\bschool|schule|école|escuela|scuola|szkoł|škol/i;
        const agePattern = /\b(under|u|bis)\s*(\d{1,2})\b/i;
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
    isTeamTournament(tournament) {
        const name = tournament.name || '';
        const category = tournament.category || '';
        const fullText = `${name} ${category}`.toLowerCase();
        const teamPattern = /\bteam|mannschaft|équipe|equipo|squadra|drużyn|družstv/i;
        return teamPattern.test(fullText);
    }
    isMediterranean(location) {
        const locationLower = location.toLowerCase();
        for (const place of this.mediterraneanLocations) {
            if (locationLower.includes(place)) {
                return true;
            }
        }
        return false;
    }
    hasSeniorCategory(category) {
        const categoryLower = category.toLowerCase();
        const seniorPattern = /\bs50\+|s\s*50\+|s50|senior|senioren|veteran|veteranen|vétéran|veterano|weteran|50\+|50\s*\+|over\s*50|o50/i;
        return seniorPattern.test(categoryLower);
    }
    hasWomenCategory(category) {
        const categoryLower = category.toLowerCase();
        const womenPattern = /\bwomen|ladies|female|frauen|dames|feminin|donne|kobiet/i;
        return womenPattern.test(categoryLower);
    }
    matchesCountry(location, countryCode) {
        const locationLower = location.toLowerCase();
        const keywords = this.europeanCountries[countryCode] || [];
        return keywords.some(keyword => locationLower.includes(keyword.toLowerCase())) ||
            locationLower.includes(countryCode.toLowerCase());
    }
    isEuropean(location) {
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
    isNonEuropean(location) {
        const locationLower = location.toLowerCase();
        for (const country of this.nonEuropeanCountries) {
            if (locationLower.includes(country)) {
                return true;
            }
        }
        return false;
    }
    displayResults(tournaments) {
        const results = document.getElementById('results');
        const tournamentList = document.getElementById('tournamentList');
        const resultsCount = document.getElementById('resultsCount');
        if (!results || !tournamentList || !resultsCount) {
            console.error('Required DOM elements not found');
            return;
        }
        if (tournaments.length === 0) {
            const emptyStateHTML = this.createEmptyStateMessage();
            tournamentList.innerHTML = emptyStateHTML;
            const resetBtn = document.getElementById('resetFiltersBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetFilters());
            }
        }
        else {
            const sortedTournaments = [...tournaments].sort((a, b) => a.date.getTime() - b.date.getTime());
            this.currentPage = 1;
            this.allTournaments = sortedTournaments;
            resultsCount.textContent = `${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''} found`;
            this.renderPaginatedTournaments();
        }
        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    renderPaginatedTournaments() {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList)
            return;
        const totalPages = Math.ceil(this.allTournaments.length / this.tournamentsPerPage);
        const startIndex = (this.currentPage - 1) * this.tournamentsPerPage;
        const endIndex = startIndex + this.tournamentsPerPage;
        const tournamentsToShow = this.allTournaments.slice(startIndex, endIndex);
        const tournamentCards = tournamentsToShow
            .map(tournament => this.createTournamentCard(tournament))
            .join('');
        const paginationHTML = this.createPaginationControls(totalPages);
        tournamentList.innerHTML = tournamentCards + paginationHTML;
        this.attachPaginationListeners();
        this.attachCalendarExportListeners(tournamentsToShow);
    }
    createPaginationControls(totalPages) {
        if (totalPages <= 1)
            return '';
        const startIndex = (this.currentPage - 1) * this.tournamentsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.tournamentsPerPage, this.allTournaments.length);
        let paginationHTML = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Showing ${startIndex}-${endIndex} of ${this.allTournaments.length} tournaments
                </div>
                <div class="pagination-controls">
        `;
        paginationHTML += `
            <button class="pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">
                ← Previous
            </button>
        `;
        const pageButtons = this.getPageButtons(totalPages);
        for (const page of pageButtons) {
            if (page === '...') {
                paginationHTML += `<span class="pagination-ellipsis" aria-hidden="true">...</span>`;
            }
            else {
                const pageNum = page;
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
    getPageButtons(totalPages) {
        const current = this.currentPage;
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        }
        else {
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
    attachPaginationListeners() {
        const paginationButtons = document.querySelectorAll('.pagination-btn');
        paginationButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                if (!page)
                    return;
                if (page === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                }
                else if (page === 'next' && this.currentPage < Math.ceil(this.allTournaments.length / this.tournamentsPerPage)) {
                    this.currentPage++;
                }
                else if (page !== 'prev' && page !== 'next') {
                    this.currentPage = parseInt(page, 10);
                }
                this.renderPaginatedTournaments();
                const results = document.getElementById('results');
                if (results) {
                    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
    createTournamentCard(tournament) {
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
        const tournamentId = this.generateTournamentId(tournament);
        return `
            <div class="tournament-card" role="listitem" data-tournament-id="${tournamentId}">
                <div class="tournament-header">
                    <div class="tournament-name">${this.escapeHtml(name)}</div>
                    <div class="tournament-date"><time datetime="${tournament.date.toISOString()}">${dateStr}</time></div>
                </div>
                <div class="tournament-location">${this.escapeHtml(location)}</div>
                <div class="tournament-category">${this.escapeHtml(category)}</div>
                <div class="tournament-description">${this.escapeHtml(description)}</div>
                <div class="tournament-actions">
                    <a href="${this.escapeHtml(url)}" target="_blank" class="tournament-link" rel="noopener noreferrer" aria-label="View ${this.escapeHtml(name)} details">
                        View Tournament Details →
                    </a>
                    <button class="calendar-export-btn" data-tournament-id="${tournamentId}" aria-label="Add ${this.escapeHtml(name)} to calendar">
                        📅 Add to Calendar
                    </button>
                </div>
            </div>
        `;
    }
    createEmptyStateMessage() {
        const filterElements = {
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
            countryFilter: document.getElementById('countryFilter')
        };
        const suggestions = [];
        if (filterElements.mediterraneanOnly?.checked) {
            suggestions.push('Try unchecking "Mediterranean Seaside Only" to see more tournaments');
        }
        if (filterElements.seniorCategory?.checked) {
            suggestions.push('Try unchecking "S50+ (Senior) Category" for more options');
        }
        if (filterElements.womenOnly?.checked) {
            suggestions.push('Try unchecking "Women\'s Tournaments" to expand your search');
        }
        if (filterElements.countryFilter?.value) {
            suggestions.push('Try selecting "All European Countries" to see tournaments from all locations');
        }
        if (filterElements.startDate?.value || filterElements.endDate?.value) {
            suggestions.push('Try adjusting or clearing your date range');
        }
        if (!filterElements.classicalTime?.checked || !filterElements.rapidTime?.checked || !filterElements.blitzTime?.checked) {
            suggestions.push('Try enabling all time controls (Classical, Rapid, and Blitz)');
        }
        const lastUpdate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const suggestionsHTML = suggestions.length > 0
            ? `<div class="empty-state-suggestions">
                <h3>Try these suggestions:</h3>
                <ul>
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
               </div>`
            : '';
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h2 class="empty-state-title">No Tournaments Found</h2>
                <p class="empty-state-message">
                    We couldn't find any tournaments matching your current filter criteria.
                </p>
                ${suggestionsHTML}
                <div class="empty-state-actions">
                    <button id="resetFiltersBtn" class="reset-filters-btn" aria-label="Reset all filters to default values">
                        🔄 Reset All Filters
                    </button>
                </div>
                <div class="empty-state-info">
                    <small>
                        Data updated daily from chess-results.com<br>
                        Last checked: ${lastUpdate}
                    </small>
                </div>
            </div>
        `;
    }
    resetFilters() {
        const filterElements = {
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
            countryFilter: document.getElementById('countryFilter')
        };
        if (filterElements.openOnly)
            filterElements.openOnly.checked = true;
        if (filterElements.excludeYouth)
            filterElements.excludeYouth.checked = true;
        if (filterElements.mediterraneanOnly)
            filterElements.mediterraneanOnly.checked = false;
        if (filterElements.seniorCategory)
            filterElements.seniorCategory.checked = false;
        if (filterElements.womenOnly)
            filterElements.womenOnly.checked = false;
        if (filterElements.includeTeamTournaments)
            filterElements.includeTeamTournaments.checked = false;
        if (filterElements.classicalTime)
            filterElements.classicalTime.checked = true;
        if (filterElements.rapidTime)
            filterElements.rapidTime.checked = true;
        if (filterElements.blitzTime)
            filterElements.blitzTime.checked = true;
        if (filterElements.startDate)
            filterElements.startDate.value = '';
        if (filterElements.endDate)
            filterElements.endDate.value = '';
        if (filterElements.countryFilter)
            filterElements.countryFilter.value = '';
        this.showError('Filters have been reset to default values', 'success');
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.click();
        }
    }
    getFilterCacheKey(filters) {
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
    showError(message, type = 'error') {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            errorEl.classList.remove('error-type', 'warning-type', 'success-type');
            errorEl.classList.add(`${type}-type`);
            const duration = type === 'success' ? 3000 : (type === 'warning' ? 5000 : 7000);
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, duration);
        }
    }
    escapeHtml(text) {
        if (!text)
            return '';
        const htmlEscapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(text).replace(/[&<>"']/g, char => htmlEscapeMap[char] || char);
    }
    saveToCache(key, data) {
        try {
            const cached = {
                data,
                timestamp: Date.now(),
                version: this.CACHE_VERSION
            };
            localStorage.setItem(key, JSON.stringify(cached));
            console.log(`✓ Cached ${key} to LocalStorage`);
        }
        catch (error) {
            console.warn('Failed to save to cache:', error);
        }
    }
    loadFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached)
                return null;
            const parsed = JSON.parse(cached);
            if (parsed.version !== this.CACHE_VERSION) {
                console.log(`Cache version mismatch for ${key}, clearing...`);
                localStorage.removeItem(key);
                return null;
            }
            const age = Date.now() - parsed.timestamp;
            if (age > this.CACHE_DURATION) {
                console.log(`Cache expired for ${key} (${Math.round(age / 1000 / 60 / 60)}h old)`);
                localStorage.removeItem(key);
                return null;
            }
            console.log(`✓ Loaded ${key} from cache (${Math.round(age / 1000 / 60)}min old)`);
            return parsed.data;
        }
        catch (error) {
            console.warn('Failed to load from cache:', error);
            return null;
        }
    }
    clearAllCaches() {
        Object.values(this.CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.filterCache.clear();
        console.log('✓ All caches cleared');
        this.showError('All caches cleared successfully', 'success');
    }
    saveFilterPreferences() {
        try {
            const filterElements = {
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
                countryFilter: document.getElementById('countryFilter')
            };
            const preferences = {
                openOnly: filterElements.openOnly?.checked ?? true,
                excludeYouth: filterElements.excludeYouth?.checked ?? true,
                mediterraneanOnly: filterElements.mediterraneanOnly?.checked ?? false,
                seniorCategory: filterElements.seniorCategory?.checked ?? false,
                womenOnly: filterElements.womenOnly?.checked ?? false,
                includeTeamTournaments: filterElements.includeTeamTournaments?.checked ?? false,
                classicalTime: filterElements.classicalTime?.checked ?? true,
                rapidTime: filterElements.rapidTime?.checked ?? true,
                blitzTime: filterElements.blitzTime?.checked ?? true,
                startDate: filterElements.startDate?.valueAsDate ?? null,
                endDate: filterElements.endDate?.valueAsDate ?? null,
                countryFilter: filterElements.countryFilter?.value ?? ''
            };
            localStorage.setItem(this.CACHE_KEYS.FILTER_PREFERENCES, JSON.stringify(preferences));
            console.log('✓ Filter preferences saved');
        }
        catch (error) {
            console.warn('Failed to save filter preferences:', error);
        }
    }
    loadFilterPreferences() {
        try {
            const savedPrefs = localStorage.getItem(this.CACHE_KEYS.FILTER_PREFERENCES);
            if (!savedPrefs) {
                console.log('No saved filter preferences found');
                return;
            }
            const preferences = JSON.parse(savedPrefs);
            const filterElements = {
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
                countryFilter: document.getElementById('countryFilter')
            };
            if (filterElements.openOnly)
                filterElements.openOnly.checked = preferences.openOnly;
            if (filterElements.excludeYouth)
                filterElements.excludeYouth.checked = preferences.excludeYouth;
            if (filterElements.mediterraneanOnly)
                filterElements.mediterraneanOnly.checked = preferences.mediterraneanOnly;
            if (filterElements.seniorCategory)
                filterElements.seniorCategory.checked = preferences.seniorCategory;
            if (filterElements.womenOnly)
                filterElements.womenOnly.checked = preferences.womenOnly;
            if (filterElements.includeTeamTournaments)
                filterElements.includeTeamTournaments.checked = preferences.includeTeamTournaments;
            if (filterElements.classicalTime)
                filterElements.classicalTime.checked = preferences.classicalTime;
            if (filterElements.rapidTime)
                filterElements.rapidTime.checked = preferences.rapidTime;
            if (filterElements.blitzTime)
                filterElements.blitzTime.checked = preferences.blitzTime;
            if (filterElements.countryFilter)
                filterElements.countryFilter.value = preferences.countryFilter;
            console.log('✓ Filter preferences loaded');
            this.showError('Your filter preferences have been restored', 'success');
        }
        catch (error) {
            console.warn('Failed to load filter preferences:', error);
        }
    }
    attachFilterChangeListeners() {
        const filterIds = [
            'openOnly', 'excludeYouth', 'mediterraneanOnly', 'seniorCategory',
            'womenOnly', 'includeTeamTournaments', 'classicalTime', 'rapidTime',
            'blitzTime', 'startDate', 'endDate', 'countryFilter'
        ];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.saveFilterPreferences();
                });
            }
        });
        console.log('✓ Filter change listeners attached');
    }
    initTheme() {
        const savedTheme = localStorage.getItem(this.CACHE_KEYS.THEME);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        this.updateThemeButton();
    }
    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        const theme = isDark ? 'dark' : 'light';
        localStorage.setItem(this.CACHE_KEYS.THEME, theme);
        this.updateThemeButton();
        console.log(`Theme switched to ${theme} mode`);
    }
    updateThemeButton() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }
    initCollapsibleFilters() {
        const filtersCard = document.querySelector('.filters-card');
        if (!filtersCard)
            return;
        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'filtersToggle';
        collapseBtn.className = 'filters-toggle';
        collapseBtn.setAttribute('aria-expanded', 'true');
        collapseBtn.setAttribute('aria-label', 'Toggle filter visibility');
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
        const isCollapsed = localStorage.getItem(this.CACHE_KEYS.FILTERS_COLLAPSED) === 'true';
        if (isCollapsed && window.innerWidth <= 768) {
            this.setFiltersCollapsed(true);
        }
    }
    toggleFilters() {
        const filtersCard = document.querySelector('.filters-card');
        if (!filtersCard)
            return;
        const isCurrentlyCollapsed = filtersCard.classList.contains('collapsed');
        this.setFiltersCollapsed(!isCurrentlyCollapsed);
        localStorage.setItem(this.CACHE_KEYS.FILTERS_COLLAPSED, (!isCurrentlyCollapsed).toString());
    }
    setFiltersCollapsed(collapsed) {
        const filtersCard = document.querySelector('.filters-card');
        const icon = document.querySelector('.collapse-icon');
        if (filtersCard) {
            if (collapsed) {
                filtersCard.classList.add('collapsed');
            }
            else {
                filtersCard.classList.remove('collapsed');
            }
        }
        if (icon) {
            icon.textContent = collapsed ? '▶' : '▼';
        }
    }
    exportToCSV() {
        if (this.allTournaments.length === 0) {
            this.showError('No tournaments to export. Please search first.', 'warning');
            return;
        }
        try {
            const headers = ['Name', 'Date', 'Location', 'Category', 'URL', 'Description'];
            const rows = [headers.join(',')];
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
            const csv = rows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
        }
        catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export tournaments. Please try again.', 'error');
        }
    }
    escapeCSV(field) {
        if (!field)
            return '';
        const str = String(field).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str}"`;
        }
        return str;
    }
    generateTournamentId(tournament) {
        const str = `${tournament.name}-${tournament.date.toISOString()}-${tournament.location}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    exportToCalendar(tournament) {
        try {
            const formatICalDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}${month}${day}T090000Z`;
            };
            const formatICalEndDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}${month}${day}T180000Z`;
            };
            const now = new Date();
            const uid = this.generateTournamentId(tournament);
            const dtStart = formatICalDate(tournament.date);
            const dtEnd = formatICalEndDate(tournament.date);
            const dtStamp = formatICalDate(now);
            const cleanDescription = (tournament.description || '')
                .replace(/<[^>]*>/g, '')
                .replace(/\n/g, '\\n')
                .substring(0, 500);
            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//MedTourney//Chess Tournament Finder//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${uid}@medtourney.com`,
                `DTSTAMP:${dtStamp}`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                `SUMMARY:${tournament.name}`,
                `DESCRIPTION:${cleanDescription}\\n\\nCategory: ${tournament.category}\\n\\nMore info: ${tournament.url}`,
                `LOCATION:${tournament.location}`,
                `URL:${tournament.url}`,
                'STATUS:CONFIRMED',
                'SEQUENCE:0',
                'BEGIN:VALARM',
                'TRIGGER:-P1D',
                'ACTION:DISPLAY',
                `DESCRIPTION:Chess tournament tomorrow: ${tournament.name}`,
                'END:VALARM',
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const filename = tournament.name
                .replace(/[^a-z0-9]/gi, '-')
                .toLowerCase()
                .substring(0, 50);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.ics`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.showError(`Calendar event created for ${tournament.name}`, 'success');
            console.log(`✓ Exported tournament to calendar: ${tournament.name}`);
        }
        catch (error) {
            console.error('Calendar export error:', error);
            this.showError('Failed to create calendar event. Please try again.', 'error');
        }
    }
    attachCalendarExportListeners(tournaments) {
        const calendarButtons = document.querySelectorAll('.calendar-export-btn');
        calendarButtons.forEach(btn => {
            const tournamentId = btn.dataset.tournamentId;
            if (!tournamentId)
                return;
            const tournament = tournaments.find(t => this.generateTournamentId(t) === tournamentId);
            if (!tournament)
                return;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportToCalendar(tournament);
            });
        });
        console.log(`✓ Attached calendar export listeners to ${calendarButtons.length} buttons`);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const app = new TournamentFinder();
    window.clearCaches = () => {
        app.clearAllCaches();
    };
});
//# sourceMappingURL=app.js.map