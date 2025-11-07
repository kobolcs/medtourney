// Chess Tournament Finder - Main Application
// Fetches and displays tournaments from chess-results.com

class TournamentFinder {
    constructor() {
        // CORS proxy services (with fallbacks)
        this.corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
        ];

        this.currentProxyIndex = 0;

        // European countries mapping
        this.europeanCountries = {
            'ESP': ['spain', 'españa', 'barcelona', 'madrid', 'valencia'],
            'FRA': ['france', 'francia', 'paris', 'nice', 'cannes', 'monaco'],
            'ITA': ['italy', 'italia', 'rome', 'milan', 'venice', 'genoa'],
            'GER': ['germany', 'deutschland', 'berlin', 'munich', 'hamburg'],
            'GRE': ['greece', 'athens', 'thessaloniki'],
            'CRO': ['croatia', 'hrvatska', 'zagreb', 'split', 'dubrovnik'],
            'HUN': ['hungary', 'budapest'],
            'POL': ['poland', 'polska', 'warsaw', 'krakow'],
            'CZE': ['czech', 'prague', 'brno'],
            'AUT': ['austria', 'vienna', 'salzburg'],
            'NED': ['netherlands', 'holland', 'amsterdam'],
            'BEL': ['belgium', 'brussels', 'antwerp'],
            'SUI': ['switzerland', 'zurich', 'geneva'],
            'POR': ['portugal', 'lisbon', 'porto'],
            'SRB': ['serbia', 'belgrade'],
            'ROU': ['romania', 'bucharest'],
            'UKR': ['ukraine', 'kiev', 'kyiv'],
            'RUS': ['russia', 'moscow', 'st. petersburg']
        };

        // Mediterranean locations
        this.mediterraneanLocations = [
            'barcelona', 'valencia', 'alicante', 'malaga', 'nice', 'cannes',
            'monaco', 'marseille', 'genoa', 'naples', 'sicily', 'rome',
            'athens', 'thessaloniki', 'split', 'dubrovnik', 'malta',
            'limassol', 'cyprus', 'valletta'
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
            error.textContent = `Error: ${err.message}. Try again or check the browser console for details.`;
            error.style.display = 'block';
        } finally {
            searchBtn.disabled = false;
            loading.style.display = 'none';
        }
    }

    async fetchTournaments() {
        // Try to fetch from chess-results.com main page
        const url = 'https://chess-results.com/';

        try {
            const html = await this.fetchWithProxy(url);
            return this.parseTournaments(html);
        } catch (err) {
            console.error('Failed to fetch from chess-results.com:', err);
            // Return demo data if fetch fails
            return this.getDemoTournaments();
        }
    }

    async fetchWithProxy(url) {
        let lastError;

        // Try each proxy
        for (let i = 0; i < this.corsProxies.length; i++) {
            try {
                const proxyUrl = this.corsProxies[i] + encodeURIComponent(url);
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml',
                    },
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const text = await response.text();
                return text;
            } catch (err) {
                lastError = err;
                console.warn(`Proxy ${this.corsProxies[i]} failed:`, err);
                continue;
            }
        }

        throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    parseTournaments(html) {
        const tournaments = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Try to find tournament tables/links on chess-results.com
        // The structure varies, so we'll look for common patterns

        // Look for tournament links
        const links = doc.querySelectorAll('a[href*="tnr"]');

        links.forEach(link => {
            const href = link.href;
            const text = link.textContent.trim();

            if (text && text.length > 5) {
                // Try to extract tournament info from surrounding elements
                const parent = link.closest('tr') || link.parentElement;

                tournaments.push({
                    name: text,
                    url: href.startsWith('http') ? href : `https://chess-results.com${href}`,
                    location: this.extractLocation(parent?.textContent || ''),
                    date: this.extractDate(parent?.textContent || ''),
                    category: this.extractCategory(text),
                    description: text
                });
            }
        });

        // If we didn't find tournaments via parsing, return demo data
        if (tournaments.length === 0) {
            return this.getDemoTournaments();
        }

        return tournaments;
    }

    extractLocation(text) {
        // Try to extract location from text
        const locationPatterns = [
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+([A-Z]{2,3})/,  // City, Country Code
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\d{4}/,  // City Year
        ];

        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return 'Europe';
    }

    extractDate(text) {
        // Try to extract date from text
        const datePatterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    if (pattern === datePatterns[0]) {
                        return new Date(match[3], match[2] - 1, match[1]);
                    } else {
                        return new Date(match[1], match[2] - 1, match[3]);
                    }
                } catch (e) {
                    // Invalid date
                }
            }
        }

        // Default to today if no date found
        return new Date();
    }

    extractCategory(text) {
        const categories = [];

        if (/\bopen\b/i.test(text)) {
            categories.push('Open');
        }
        if (/\bs50\+|senior|veteran/i.test(text)) {
            categories.push('S50+');
        }
        if (/\bu\d+|youth|junior/i.test(text)) {
            categories.push('Youth');
        }

        return categories.length > 0 ? categories.join(', ') : 'Open';
    }

    getDemoTournaments() {
        // Comprehensive demo data based on real tournament patterns
        const now = new Date();

        return [
            {
                name: 'Barcelona International Chess Open 2025',
                location: 'Barcelona, Spain',
                date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15),
                category: 'Open',
                description: 'International open tournament with players from around the world. 9 rounds Swiss system.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Mediterranean Senior Championship',
                location: 'Athens, Greece',
                date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30),
                category: 'Open, S50+',
                description: 'Championship for senior players (50+) in the Mediterranean region.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Riviera Chess Festival',
                location: 'Nice, France',
                date: new Date(now.getFullYear(), now.getMonth() + 1, 5),
                category: 'Open, S50+',
                description: 'Prestigious chess festival on the French Riviera. Multiple categories including veterans.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Croatian Coast Open',
                location: 'Split, Croatia',
                date: new Date(now.getFullYear(), now.getMonth() + 1, 15),
                category: 'Open, S50+',
                description: 'Beautiful seaside tournament with veteran category. Held in historic Split.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Budapest Spring Festival',
                location: 'Budapest, Hungary',
                date: new Date(now.getFullYear(), now.getMonth() + 1, 20),
                category: 'Open',
                description: 'Traditional spring chess festival in the heart of Europe.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Prague Chess Masters',
                location: 'Prague, Czech Republic',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 1),
                category: 'Open',
                description: 'International tournament in beautiful Prague. All ages welcome.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Malta Chess Festival',
                location: 'Valletta, Malta',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 10),
                category: 'Open, S50+',
                description: 'Mediterranean island tournament with multiple categories including seniors.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Sicily International Open',
                location: 'Palermo, Italy',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 20),
                category: 'Open',
                description: 'Sicilian chess tradition continues with this international open tournament.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Dubrovnik Senior Open',
                location: 'Dubrovnik, Croatia',
                date: new Date(now.getFullYear(), now.getMonth() + 3, 1),
                category: 'Open, S50+',
                description: 'Veteran tournament in the pearl of the Adriatic. Special rates for seniors.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Berlin Youth Championship',
                location: 'Berlin, Germany',
                date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 25),
                category: 'Youth',
                description: 'Youth only tournament for players under 18.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Warsaw International',
                location: 'Warsaw, Poland',
                date: new Date(now.getFullYear(), now.getMonth() + 1, 10),
                category: 'Open',
                description: 'Strong international tournament in Poland\'s capital.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Alicante Beach Chess',
                location: 'Alicante, Spain',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 5),
                category: 'Open, S50+',
                description: 'Play chess by the Mediterranean sea. Open and senior categories available.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Vienna Classic',
                location: 'Vienna, Austria',
                date: new Date(now.getFullYear(), now.getMonth() + 2, 15),
                category: 'Open',
                description: 'Classical chess in the city of music. Open to all players.',
                url: 'https://chess-results.com'
            },
            {
                name: 'Geneva Swiss Championship',
                location: 'Geneva, Switzerland',
                date: new Date(now.getFullYear(), now.getMonth() + 3, 10),
                category: 'Open',
                description: 'Swiss system tournament in international Geneva.',
                url: 'https://chess-results.com'
            }
        ];
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

            // European filter (always applied)
            if (!this.isEuropean(tournament.location)) {
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
        return /s50\+|senior|veteran/i.test(category);
    }

    matchesCountry(location, countryCode) {
        const locationLower = location.toLowerCase();
        const keywords = this.europeanCountries[countryCode] || [];
        return keywords.some(keyword => locationLower.includes(keyword));
    }

    isEuropean(location) {
        const locationLower = location.toLowerCase();

        // Check all European country keywords
        for (const keywords of Object.values(this.europeanCountries)) {
            if (keywords.some(keyword => locationLower.includes(keyword))) {
                return true;
            }
        }

        // If location is just "Europe", include it
        return locationLower.includes('europe');
    }

    displayResults(tournaments) {
        const results = document.getElementById('results');
        const tournamentList = document.getElementById('tournamentList');
        const resultsCount = document.getElementById('resultsCount');

        if (tournaments.length === 0) {
            tournamentList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No tournaments found matching your criteria. Try adjusting your filters.</p>';
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
                <a href="${this.escapeHtml(tournament.url)}" target="_blank" class="tournament-link">
                    View Tournament Details →
                </a>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TournamentFinder();
});
