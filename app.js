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

        // European countries mapping - STRICT list (Russia excluded per user request)
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

        // Non-European countries to explicitly exclude
        this.nonEuropeanCountries = [
            'malaysia', 'uae', 'dubai', 'qatar', 'saudi', 'china', 'india',
            'indonesia', 'singapore', 'thailand', 'vietnam', 'philippines',
            'japan', 'korea', 'australia', 'new zealand', 'usa', 'canada',
            'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia',
            'egypt', 'morocco', 'tunisia', 'algeria', 'south africa',
            'israel', 'jordan', 'lebanon', 'iran', 'iraq', 'turkey',
            'russia', 'moscow', 'petersburg', 'kazakhstan', 'uzbekistan'
        ];

        // Mediterranean locations
        this.mediterraneanLocations = [
            'barcelona', 'valencia', 'alicante', 'malaga', 'marbella',
            'nice', 'cannes', 'monaco', 'marseille', 'montpellier',
            'genoa', 'genova', 'naples', 'napoli', 'sicily', 'sicilia', 'rome', 'roma',
            'athens', 'αθήνα', 'thessaloniki', 'θεσσαλονίκη',
            'split', 'dubrovnik', 'rijeka',
            'malta', 'valletta', 'sliema',
            'limassol', 'larnaca', 'cyprus',
            'antalya', 'izmir'
        ];

        this.init();
    }

    init() {
        // Set default dates (today to 3 months from now)
        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        document.getElementById('startDate').valueAsDate = today;
        document.getElementById('endDate').valueAsDate = threeMonthsLater;

        // Attach event listeners
        document.getElementById('searchBtn').addEventListener('click', () => this.searchTournaments());
    }

    async searchTournaments() {
        const searchBtn = document.getElementById('searchBtn');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const results = document.getElementById('results');

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
        console.log('Fetching tournaments from chess-results.com...');

        // Try multiple pages on chess-results.com
        const urls = [
            'https://chess-results.com/',
            'https://chess-results.com/tnr_cal.aspx',
        ];

        for (const url of urls) {
            try {
                const html = await this.fetchWithProxy(url);
                const tournaments = this.parseTournaments(html);

                if (tournaments.length > 0) {
                    console.log(`Successfully parsed ${tournaments.length} tournaments from ${url}`);
                    return tournaments;
                }
            } catch (err) {
                console.warn(`Failed to fetch from ${url}:`, err);
            }
        }

        console.warn('Could not fetch real data, using fallback');
        throw new Error('Unable to fetch live data from chess-results.com');
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
        const filters = {
            openOnly: document.getElementById('openOnly').checked,
            excludeYouth: document.getElementById('excludeYouth').checked,
            mediterraneanOnly: document.getElementById('mediterraneanOnly').checked,
            seniorCategory: document.getElementById('seniorCategory').checked,
            startDate: document.getElementById('startDate').valueAsDate,
            endDate: document.getElementById('endDate').valueAsDate,
            countryFilter: document.getElementById('countryFilter').value
        };

        return tournaments.filter(tournament => {
            // European filter (always applied) - STRICT CHECK
            if (!this.isEuropean(tournament.location)) {
                return false;
            }

            // Explicitly exclude non-European countries
            if (this.isNonEuropean(tournament.location)) {
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
        return /\byouth\b/i.test(tournament.category) &&
               !/\bopen\b/i.test(tournament.category);
    }

    isMediterranean(location) {
        const locationLower = location.toLowerCase();
        return this.mediterraneanLocations.some(place =>
            locationLower.includes(place.toLowerCase())
        );
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

        // Explicitly check for non-European countries
        return this.nonEuropeanCountries.some(country =>
            locationLower.includes(country.toLowerCase())
        );
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
            resultsCount.textContent = `${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''} found`;

            tournamentList.innerHTML = tournaments
                .sort((a, b) => a.date - b.date)
                .map(tournament => this.createTournamentCard(tournament))
                .join('');
        }

        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TournamentFinder();
});
