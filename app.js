"use strict";
class TournamentFinder {
    constructor() {
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
        ];
        this.currentPage = 1;
        this.tournamentsPerPage = 20;
        this.allTournaments = [];
        this.europeanCountries = {};
        this.nonEuropeanCountries = new Set();
        this.mediterraneanLocations = new Set();
        void this.initAsync();
    }
    async initAsync() {
        try {
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
            const searchBtn = document.getElementById('searchBtn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => void this.searchTournaments());
            }
        }
        catch (error) {
            console.error('Initialization error:', error);
        }
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
            this.nonEuropeanCountries = new Set(config.nonEuropeanCountries);
            this.mediterraneanLocations = new Set(config.mediterraneanLocations);
            this.europeanCountries = {};
            for (const [code, data] of Object.entries(config.countryCodes)) {
                this.europeanCountries[code] = data.keywords;
            }
            console.log(`Loaded config: ${Object.keys(this.europeanCountries).length} countries, ` +
                `${this.nonEuropeanCountries.size} non-European countries, ` +
                `${this.mediterraneanLocations.size} Mediterranean locations`);
        }
        catch (error) {
            console.error('Error loading config.json, using fallback defaults:', error);
            this.loadDefaultConfig();
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
            classicalTime: filterElements.classicalTime.checked,
            rapidTime: filterElements.rapidTime.checked,
            blitzTime: filterElements.blitzTime.checked,
            startDate: filterElements.startDate.valueAsDate,
            endDate: filterElements.endDate.valueAsDate,
            countryFilter: filterElements.countryFilter.value
        };
        return tournaments.filter(tournament => {
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
            if (this.isTeamTournament(tournament)) {
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
            tournamentList.innerHTML = `
                <p style="text-align: center; padding: 40px; color: #999;">
                    No tournaments found matching your criteria.<br>
                    Try adjusting your filters or check back later.<br><br>
                    <small>Note: Real-time data fetching from chess-results.com may be limited due to CORS restrictions.</small>
                </p>
            `;
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
}
document.addEventListener('DOMContentLoaded', () => {
    new TournamentFinder();
});
//# sourceMappingURL=app.js.map