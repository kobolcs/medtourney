// Chess Tournament Finder - Main Application
// Fetches and displays tournaments from chess-results.com

class TournamentFinder {
    constructor() {
        // CORS proxy services (with fallbacks)
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
        ];

        this.currentProxyIndex = 0;

        // Will be loaded from config.json
        this.europeanCountries = null;
        this.nonEuropeanCountries = null;
        this.mediterraneanLocations = null;
        this.countryCodes = null;

        // Initialize after loading config
        this.initAsync();
    }

    async initAsync() {
        // Load configuration
        await this.loadConfig();

        // Set default dates (today to 3 months from now)
        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        document.getElementById('startDate').valueAsDate = today;
        document.getElementById('endDate').valueAsDate = threeMonthsLater;

        // Attach event listeners
        document.getElementById('searchBtn').addEventListener('click', () => this.searchTournaments());
    }

    async loadConfig() {
        try {
            const response = await fetch('./config.json', {
                cache: 'no-cache',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }

            const config = await response.json();

            // Convert to Sets for O(1) lookup performance
            this.nonEuropeanCountries = new Set(config.nonEuropeanCountries);
            this.mediterraneanLocations = new Set(config.mediterraneanLocations);

            // Convert countryCodes to the format used by the app
            this.europeanCountries = {};
            this.countryCodes = config.countryCodes;

            for (const [code, data] of Object.entries(config.countryCodes)) {
                this.europeanCountries[code] = data.keywords;
            }

            console.log(`Loaded config: ${Object.keys(this.europeanCountries).length} countries, ` +
                       `${this.nonEuropeanCountries.size} non-European countries, ` +
                       `${this.mediterraneanLocations.size} Mediterranean locations`);
        } catch (error) {
            console.error('Error loading config.json, using fallback defaults:', error);
            this.loadDefaultConfig();
        }
    }

    loadDefaultConfig() {
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
            'nice', 'cannes', 'monaco', 'marseille', 'montpellier',
            'genoa', 'genova', 'naples', 'napoli', 'sicily', 'sicilia', 'rome', 'roma',
            'athens', 'αθήνα', 'thessaloniki', 'θεσσαλονίκη',
            'split', 'dubrovnik', 'rijeka',
            'malta', 'valletta', 'sliema',
            'limassol', 'larnaca', 'cyprus'
        ]);
    }

    async searchTournaments() {
        const searchBtn = document.getElementById('searchBtn');
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
            console.error('Error fetching tournaments:', err);
            error.textContent = `Error: ${err.message}. The tool is using fallback data.`;
            error.style.display = 'block';

            // Still show results even on error
            const filtered = this.filterTournaments([]);
            this.displayResults(filtered);
        } finally {
            searchBtn.disabled = false;
            loading.style.display = 'none';
        }
    }

    async fetchTournaments() {
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
                const tournaments = await response.json();
                if (Array.isArray(tournaments) && tournaments.length > 0) {
                    console.log(`✓ Loaded ${tournaments.length} tournaments from local data file`);
                    // Convert date strings to Date objects
                    return tournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            }
        } catch (err) {
            console.warn('Could not load local data file:', err.message);
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
                console.warn(`Failed to fetch from ${url}:`, err.message);
            }
        }

        // No data available from any source
        console.error('Could not fetch tournament data from any source');
        throw new Error('Unable to fetch tournament data. Please try again later or run the data scraper to update tournaments_data.json');
    }

    async fetchWithProxy(url) {
        let lastError;

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
                if (proxy.includes('allorigins')) {
                    try {
                        const json = JSON.parse(data);
                        html = json.contents || data;
                    } catch (e) {
                        html = data;
                    }
                }

                console.log(`Successfully fetched ${html.length} bytes via proxy ${i + 1}`);
                return html;
            } catch (err) {
                lastError = err;
                console.warn(`Proxy ${this.corsProxies[i]} failed:`, err.message);
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

        // Strategy 1: Look for tournament links with tnr parameter
        const tnrLinks = doc.querySelectorAll('a[href*="tnr"]');
        console.log(`Found ${tnrLinks.length} tournament links`);

        tnrLinks.forEach((link, index) => {
            try {
                const href = link.getAttribute('href');
                const name = link.textContent.trim();

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
                    fullText = row.textContent;

                    // Try to extract location and date from cells
                    cells.forEach(cell => {
                        const cellText = cell.textContent.trim();

                        // Look for country codes (3-letter, uppercase)
                        const countryMatch = cellText.match(/\b([A-Z]{3})\b/);
                        if (countryMatch && this.isEuropeanCountryCode(countryMatch[1])) {
                            location = cellText;
                        }

                        // Look for dates
                        if (cellText.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
                            dateText = cellText;
                        }
                    });
                } else {
                    // Try parent element
                    fullText = link.parentElement?.textContent || link.textContent;
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

                const tournament = {
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

    isEuropeanCountryCode(code) {
        // Check if 3-letter code matches any European country
        return Object.keys(this.europeanCountries).includes(code) ||
               Object.values(this.europeanCountries).some(keywords =>
                   keywords.includes(code.toLowerCase())
               );
    }

    extractLocation(text) {
        // Try to find country code (3-letter uppercase)
        const countryCodeMatch = text.match(/\b([A-Z]{3})\b/);
        if (countryCodeMatch) {
            const code = countryCodeMatch[1];
            if (this.isEuropeanCountryCode(code)) {
                // Try to find city before country code
                const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[,\-]?\s*([A-Z]{3})/);
                if (cityMatch) {
                    return `${cityMatch[1]}, ${code}`;
                }
                return code;
            }
        }

        // Try pattern: City, Country
        const cityCountryMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (cityCountryMatch) {
            return `${cityCountryMatch[1]}, ${cityCountryMatch[2]}`;
        }

        // Try to find just a city name
        const cityMatch = text.match(/\b([A-Z][a-z]{3,}(?:\s+[A-Z][a-z]+)*)\b/);
        if (cityMatch) {
            return cityMatch[1];
        }

        return 'Unknown';
    }

    extractDate(text) {
        // Try multiple date patterns
        const patterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,      // DD.MM.YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/,        // YYYY-MM-DD
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,      // DD/MM/YYYY
            /(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/ // DD Month YYYY
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    if (pattern === patterns[0] || pattern === patterns[2]) {
                        // DD.MM.YYYY or DD/MM/YYYY
                        const date = new Date(match[3], match[2] - 1, match[1]);
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    } else if (pattern === patterns[1]) {
                        // YYYY-MM-DD
                        const date = new Date(match[1], match[2] - 1, match[3]);
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

    extractCategory(text) {
        const categories = [];
        const textLower = text.toLowerCase();

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
        // Validate input
        if (!Array.isArray(tournaments)) {
            console.error('filterTournaments: expected array, got', typeof tournaments);
            return [];
        }

        // Validate and get filter elements
        const filterElements = {
            openOnly: document.getElementById('openOnly'),
            excludeYouth: document.getElementById('excludeYouth'),
            mediterraneanOnly: document.getElementById('mediterraneanOnly'),
            seniorCategory: document.getElementById('seniorCategory'),
            classicalTime: document.getElementById('classicalTime'),
            rapidTime: document.getElementById('rapidTime'),
            blitzTime: document.getElementById('blitzTime'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            countryFilter: document.getElementById('countryFilter')
        };

        // Check if any required elements are missing
        const missingElements = Object.entries(filterElements)
            .filter(([name, el]) => !el)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            console.error('Missing filter elements:', missingElements);
            return tournaments;  // Return unfiltered if controls missing
        }

        const filters = {
            openOnly: filterElements.openOnly.checked,
            excludeYouth: filterElements.excludeYouth.checked,
            mediterraneanOnly: filterElements.mediterraneanOnly.checked,
            seniorCategory: filterElements.seniorCategory.checked,
            classicalTime: filterElements.classicalTime.checked,
            rapidTime: filterElements.rapidTime.checked,
            blitzTime: filterElements.blitzTime.checked,
            startDate: filterElements.startDate.valueAsDate,
            endDate: filterElements.endDate.valueAsDate,
            countryFilter: filterElements.countryFilter.value
        };

        return tournaments.filter(tournament => {
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

            // Youth filter
            if (filters.excludeYouth && this.isYouthOnly(tournament)) {
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

            // Country filter
            if (filters.countryFilter && !this.matchesCountry(tournament.location, filters.countryFilter)) {
                return false;
            }

            return true;
        });
    }

    isOpenCategory(category) {
        return /\bopen\b/i.test(category);
    }

    isYouthOnly(tournament) {
        // International youth keywords matching backend TournamentProcessor
        const youthPattern = /\bu\d+|youth|junior|u18|under|żiak|młodzie[żz]|juniorzy|juniorów|ml[áa]de[žz]|ifjúság|jugend|jeune|juvenil|joven|giovani|giovanile/i;
        return youthPattern.test(tournament.category) &&
               !/\bopen\b/i.test(tournament.category);
    }

    isMediterranean(location) {
        const locationLower = location.toLowerCase();
        // Use Set for O(1) lookup - iterate and check includes
        for (const place of this.mediterraneanLocations) {
            if (locationLower.includes(place)) {
                return true;
            }
        }
        return false;
    }

    hasSeniorCategory(category) {
        return /s50\+|s50|senior|veteran|50\+/i.test(category);
    }

    matchesCountry(location, countryCode) {
        const locationLower = location.toLowerCase();
        const keywords = this.europeanCountries[countryCode] || [];
        return keywords.some(keyword => locationLower.includes(keyword.toLowerCase())) ||
               locationLower.includes(countryCode.toLowerCase());
    }

    isEuropean(location) {
        const locationLower = location.toLowerCase();

        // Check against European country keywords
        for (const [code, keywords] of Object.entries(this.europeanCountries)) {
            if (keywords.some(keyword => locationLower.includes(keyword.toLowerCase()))) {
                return true;
            }
            // Also check the country code itself
            if (locationLower.includes(code.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    isNonEuropean(location) {
        const locationLower = location.toLowerCase();

        // Explicitly check for non-European countries using Set
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
            const sortedTournaments = tournaments.sort((a, b) => a.date - b.date);

            // Pagination setup
            this.currentPage = 1;
            this.tournamentsPerPage = 20;
            this.allTournaments = sortedTournaments;

            resultsCount.textContent = `${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''} found`;

            this.renderPaginatedTournaments();
        }

        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    renderPaginatedTournaments() {
        const tournamentList = document.getElementById('tournamentList');
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

    createPaginationControls(totalPages) {
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
            <button class="pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
                ← Previous
            </button>
        `;

        // Page numbers
        const pageButtons = this.getPageButtons(totalPages);
        for (const page of pageButtons) {
            if (page === '...') {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            } else {
                paginationHTML += `
                    <button class="pagination-btn ${page === this.currentPage ? 'active' : ''}"
                            data-page="${page}">
                        ${page}
                    </button>
                `;
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
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
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (current > 3) {
                pages.push('...');
            }

            // Show pages around current
            for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) {
                pages.push(i);
            }

            if (current < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    }

    attachPaginationListeners() {
        const paginationButtons = document.querySelectorAll('.pagination-btn');
        paginationButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                if (page === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                } else if (page === 'next' && this.currentPage < Math.ceil(this.allTournaments.length / this.tournamentsPerPage)) {
                    this.currentPage++;
                } else if (page !== 'prev' && page !== 'next') {
                    this.currentPage = parseInt(page);
                }
                this.renderPaginatedTournaments();
                // Scroll to top of results
                document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    createTournamentCard(tournament) {
        const dateStr = tournament.date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return `
            <div class="tournament-card">
                <div class="tournament-header">
                    <div class="tournament-name">${this.escapeHtml(tournament.name)}</div>
                    <div class="tournament-date">${dateStr}</div>
                </div>
                <div class="tournament-location">${this.escapeHtml(tournament.location)}</div>
                <div class="tournament-category">${this.escapeHtml(tournament.category)}</div>
                <div class="tournament-description">${this.escapeHtml(tournament.description)}</div>
                <a href="${this.escapeHtml(tournament.url)}" target="_blank" class="tournament-link" rel="noopener noreferrer">
                    View Tournament Details →
                </a>
            </div>
        `;
    }

    escapeHtml(text) {
        // Use regex for efficient HTML escaping without DOM creation
        if (!text) return '';

        const htmlEscapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return String(text).replace(/[&<>"']/g, char => htmlEscapeMap[char]);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TournamentFinder();
});
