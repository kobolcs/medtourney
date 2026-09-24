/**
 * UIManager - Handles all DOM manipulation and UI rendering
 *
 * Provides:
 * - Tournament list rendering
 * - Loading states (spinner, skeletons)
 * - Error/success messages
 * - Pagination
 * - Empty states
 * - Dark mode
 */

import { Tournament, SortOption } from '../types';
import { formatLocation } from '../utils/countries';
import { formatTimeControl } from '../utils/timeControl';
import { formatDurationLabel } from '../utils/durationLabel';
import { escapeHTML } from '../utils/html';

export class UIManager {
    private currentPage = 1;
    private itemsPerPage = 10;
    private filteredTournaments: Tournament[] = [];
    private shortlistedUrls: Set<string> = new Set();
    private emptyStateContext: { totalCount: number; relaxations: { label: string; count: number }[] } | null = null;
    private groupByDate = false;
    private monthCounts: Map<string, number> = new Map();

    /**
     * Called before displayTournaments when the result set will be empty.
     * relaxations are one-tap "relax this filter" options with the result
     * count each would produce - app.ts computes them (it owns FilterState
     * and FilterService) and keeps the matching apply() callbacks itself,
     * wiring clicks via its own delegated listener since these buttons are
     * rendered fresh into the DOM each time showEmptyState() runs.
     */
    prepareEmptyState(totalCount: number, relaxations: { label: string; count: number }[]): void {
        this.emptyStateContext = { totalCount, relaxations };
    }

    setShortlistedUrls(urls: Set<string>): void {
        this.shortlistedUrls = new Set(urls);
    }

    refreshShortlistButtons(shortlistedUrls: Set<string>): void {
        this.shortlistedUrls = new Set(shortlistedUrls);
        document.querySelectorAll<HTMLElement>('.shortlist-btn').forEach(btn => {
            const url = btn.dataset.tournamentUrl;
            if (!url) return;
            const isShortlisted = shortlistedUrls.has(url);
            btn.classList.toggle('shortlisted', isShortlisted);
            btn.setAttribute('aria-pressed', String(isShortlisted));
            const star = btn.querySelector('.shortlist-star');
            if (star) star.textContent = isShortlisted ? '★' : '☆';
            btn.setAttribute('aria-label',
                `${isShortlisted ? 'Remove from' : 'Add to'} shortlist: ${btn.dataset.tournamentName ?? ''}`);
        });
    }

    updateShortlistCount(count: number): void {
        const badge = document.getElementById('shortlistCount');
        if (badge) {
            badge.textContent = String(count);
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
        const exportShortlistBtn = document.getElementById('exportShortlistBtn') as HTMLButtonElement | null;
        if (exportShortlistBtn) {
            exportShortlistBtn.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    /**
     * Show loading spinner
     */
    showLoading(): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    /**
     * Hide loading spinner
     */
    hideLoading(): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Display loading skeletons while fetching data
     */
    showLoadingSkeletons(): void {
        const tournamentList = document.getElementById('tournamentList');
        const results = document.getElementById('results');

        if (!tournamentList || !results) return;

        // Show results container
        results.style.display = 'block';

        // Clear existing content
        tournamentList.innerHTML = '';

        // Create 6 skeleton cards
        for (let i = 0; i < 6; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.setAttribute('data-skeleton', 'true');

            skeleton.innerHTML = `
                <div class="skeleton-title"></div>
                <div class="skeleton-location"></div>
                <div class="skeleton-date"></div>
                <div class="skeleton-category"></div>
            `;

            tournamentList.appendChild(skeleton);
        }

        // Update results count
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = 'Loading tournaments...';
            resultsCount.setAttribute('aria-live', 'polite');
        }

        // Hide export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.style.display = 'none';
        }
    }

    /**
     * Display tournaments. Pass the active sort option so month dividers only
     * appear when the list is actually ordered by date - grouping by month
     * would be misleading (and the counts wrong-looking) under any other sort.
     */
    displayTournaments(tournaments: Tournament[], sortOption?: SortOption): void {
        this.filteredTournaments = tournaments;
        this.currentPage = 1;
        this.groupByDate = sortOption === 'date-asc' || sortOption === 'date-desc';
        this.renderResults();
    }

    /**
     * Update displayed tournaments (after filter/sort)
     */
    updateDisplayedTournaments(tournaments: Tournament[]): void {
        this.filteredTournaments = tournaments;
        this.currentPage = 1;
        this.renderResults();
    }

    /**
     * Render results with pagination
     */
    private renderResults(): void {
        const results = document.getElementById('results');
        const tournamentList = document.getElementById('tournamentList');
        const resultsCount = document.getElementById('resultsCount');
        const exportBtn = document.getElementById('exportBtn');

        if (!results || !tournamentList || !resultsCount) return;

        // Show results container
        results.style.display = 'block';

        // Update results count
        resultsCount.textContent = `${this.filteredTournaments.length} tournament${this.filteredTournaments.length !== 1 ? 's' : ''} found`;
        resultsCount.setAttribute('aria-live', 'polite');

        // Show/hide export button
        if (exportBtn) {
            exportBtn.style.display = this.filteredTournaments.length > 0 ? 'inline-flex' : 'none';
        }

        // Handle empty state
        if (this.filteredTournaments.length === 0) {
            this.showEmptyState(tournamentList);
            return;
        }

        // Render paginated tournaments
        this.computeMonthCounts();
        this.renderPaginatedTournaments(tournamentList);
    }

    /** Year-month key used to detect a month boundary between two dates. */
    private monthKey(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth()}`;
    }

    /** Total tournaments per month across the whole filtered list (not just the current page). */
    private computeMonthCounts(): void {
        this.monthCounts = new Map();
        if (!this.groupByDate) return;
        for (const t of this.filteredTournaments) {
            const key = this.monthKey(t.date);
            this.monthCounts.set(key, (this.monthCounts.get(key) ?? 0) + 1);
        }
    }

    private createMonthDivider(date: Date, count: number): HTMLElement {
        const divider = document.createElement('div');
        divider.className = 'month-divider';
        const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        divider.innerHTML = `
            <span class="month-divider-label">${escapeHTML(label)}</span>
            <span class="month-divider-count">${count}</span>
        `;
        return divider;
    }

    /**
     * Render paginated tournament list
     */
    private renderPaginatedTournaments(container: HTMLElement): void {
        container.innerHTML = '';

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredTournaments.length);
        const pageTournaments = this.filteredTournaments.slice(startIndex, endIndex);

        // Seed with the previous page's last month so a divider isn't
        // repeated mid-month right after a pagination boundary.
        let lastMonthKey = startIndex > 0
            ? this.monthKey(this.filteredTournaments[startIndex - 1]!.date)
            : null;

        pageTournaments.forEach(tournament => {
            if (this.groupByDate) {
                const key = this.monthKey(tournament.date);
                if (key !== lastMonthKey) {
                    container.appendChild(this.createMonthDivider(tournament.date, this.monthCounts.get(key) ?? 0));
                    lastMonthKey = key;
                }
            }
            const card = this.createTournamentCard(tournament);
            container.appendChild(card);
        });

        // Render pagination if needed
        if (this.filteredTournaments.length > this.itemsPerPage) {
            this.renderPagination(container);
        }
    }

    /**
     * Create tournament card element
     */
    private formatDateRange(dateFrom: Date, dateTo?: string): string {
        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        if (!dateTo) return dateFrom.toLocaleDateString('en-GB', opts);

        const to = new Date(dateTo);
        if (isNaN(to.getTime()) || to.getTime() <= dateFrom.getTime()) {
            return dateFrom.toLocaleDateString('en-GB', opts);
        }

        const sameYear = dateFrom.getFullYear() === to.getFullYear();
        const sameMonth = sameYear && dateFrom.getMonth() === to.getMonth();

        if (sameMonth) {
            const fromDay = dateFrom.toLocaleDateString('en-GB', { day: 'numeric' });
            const toFull = to.toLocaleDateString('en-GB', opts);
            return `${fromDay}–${toFull}`;
        }
        if (sameYear) {
            const fromShort = dateFrom.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const toFull = to.toLocaleDateString('en-GB', opts);
            return `${fromShort}–${toFull}`;
        }
        return `${dateFrom.toLocaleDateString('en-GB', opts)}–${to.toLocaleDateString('en-GB', opts)}`;
    }

    /**
     * The card's left-hand date badge: day, 3-letter month, an end line for
     * multi-day events ("→ 27", or "→ 6 Nov" across months) and the year
     * when it isn't this year (list sorts other than date have no month
     * headers to show it). It is the card's only visible date.
     */
    private formatDateBadge(date: Date, dateTo?: string): { day: string; month: string; end: string; year: string } {
        const month3 = (d: Date): string =>
            // en-GB renders September as "Sept" (4 chars) - slice to a consistent 3.
            d.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3);
        const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
        const month = month3(date);

        let end = '';
        const to = dateTo ? new Date(dateTo) : null;
        if (to && !isNaN(to.getTime()) && to.getTime() > date.getTime()) {
            const toDay = to.toLocaleDateString('en-GB', { day: 'numeric' });
            const sameMonth = to.getMonth() === date.getMonth() && to.getFullYear() === date.getFullYear();
            end = sameMonth ? `→ ${toDay}` : `→ ${toDay} ${month3(to)}`;
        }
        const year = date.getFullYear() !== new Date().getFullYear() ? String(date.getFullYear()) : '';
        return { day, month, end, year };
    }

    /**
     * Colored pill for the tournament's time-control class (Classical/Rapid/
     * Blitz), derived from FilterService.annotate()'s classificationReasons
     * rather than re-parsing the category string, so it agrees with the
     * checkboxes that actually filtered this tournament in. Priority favors
     * the more specific/faster format when a multi-format event's category
     * mentions more than one (e.g. "Standard & Blitz").
     */
    private timeControlClassHTML(tournament: Tournament): string {
        const reasons = tournament.classificationReasons ?? [];
        const cls = reasons.includes('Blitz') ? 'blitz'
            : reasons.includes('Rapid') ? 'rapid'
            : reasons.includes('Classical') ? 'classical'
            : null;
        if (!cls) return '';
        const label = cls.charAt(0).toUpperCase() + cls.slice(1);
        return `<span class="time-control-class time-control-class--${cls}">${label}</span>`;
    }

    /**
     * Remaining category tokens (Open, Youth, U18…) as separate chips, once
     * the time-control words have their own colored pill above — avoids
     * repeating "Blitz" in both a colored pill and a plain string.
     */
    private categoryTagsHTML(tournament: Tournament): string {
        const TIME_WORDS = /^(classical|standard|rapid|blitz)$/i;
        const tokens = tournament.category
            .split(',')
            .map(t => t.trim())
            .filter(t => t && !TIME_WORDS.test(t));
        return tokens.map(t => `<span class="category-tag">${escapeHTML(t)}</span>`).join('');
    }

    /**
     * Travel context on the location line: nearest airport with scheduled
     * flights, as travellers search for it (IATA code), with the full name in
     * the tooltip / for screen readers. Distance is straight-line, and says so.
     */
    private airportHintHTML(tournament: Tournament): string {
        const a = tournament.airport;
        if (!a) return '';
        const full = `Nearest airport with scheduled flights: ${a.name} (${a.iata}), about ${a.km} km in a straight line`;
        return `<span class="airport-hint" title="${escapeHTML(full)}"><span aria-hidden="true">✈ ${escapeHTML(a.iata)} · ${a.km} km</span><span class="sr-only">${escapeHTML(full)}</span></span>`;
    }

    /**
     * Render (or hide) the featured "Tournament of the Week" card.
     */
    renderFeaturedTournament(tournament: Tournament | null): void {
        const container = document.getElementById('featuredTournament');
        if (!container) return;

        if (!tournament) {
            container.style.display = 'none';
            return;
        }

        const dateStr = this.formatDateRange(tournament.date, tournament.dateTo);

        container.style.display = 'block';
        // A slim one-line banner (it used to be the tallest thing on the page
        // and pushed the first result off a phone screen): the name is the
        // link, plus where and when, and a compact calendar button.
        const beach = tournament.seaM !== undefined;
        container.innerHTML = `
            <div class="featured-card" role="region" aria-label="Tournament of the Week">
                <span class="featured-label">${beach ? '<span aria-hidden="true">🏖</span> ' : ''}Tournament of the Week</span>
                <h3 class="featured-name">
                    <a href="${escapeHTML(tournament.url)}" target="_blank" rel="noopener noreferrer"
                       class="featured-name-link">${escapeHTML(tournament.name)}</a>
                </h3>
                <span class="featured-where">${formatLocation(tournament.location, tournament.town)} · <span class="featured-date">${dateStr}</span></span>
                <button type="button" class="calendar-export-btn featured-calendar-btn"
                        data-tournament-url="${escapeHTML(tournament.url)}"
                        aria-label="Add ${escapeHTML(tournament.name)} to calendar"
                        title="Add to calendar"><span aria-hidden="true">📅</span></button>
            </div>
        `;
    }

    showStalenessBanner(message: string): void {
        const banner = document.getElementById('staleness-banner');
        if (banner) {
            banner.textContent = message;
            banner.style.display = 'block';
        }
    }

    private createTournamentCard(tournament: Tournament): HTMLElement {
        const card = document.createElement('article');
        card.className = 'tournament-card';
        card.setAttribute('aria-label', tournament.name);
        card.dataset.tournamentUrl = tournament.url;

        const { day, month, end, year } = this.formatDateBadge(tournament.date, tournament.dateTo);
        const dateStr = this.formatDateRange(tournament.date, tournament.dateTo);

        const isShortlisted = this.shortlistedUrls.has(tournament.url);
        const tags = tournament.travelTags ?? [];

        const GEOGRAPHIC_TAGS = new Set(['Mediterranean', 'Seaside', 'Senior-friendly', "Women's"]);
        const meaningfulTags = tags.filter(t => GEOGRAPHIC_TAGS.has(t));
        const travelTagsHTML = meaningfulTags.length > 0
            ? `<div class="travel-tags">${meaningfulTags.map(t => `<span class="travel-tag">${escapeHTML(t)}</span>`).join('')}</div>`
            : '';

        // Card accent color encodes category — Mediterranean/seaside takes
        // priority over senior when a tournament carries both tags.
        if (tags.includes('Mediterranean') || tags.includes('Seaside')) {
            card.classList.add('tournament-card--mediterranean');
        } else if (tags.includes('Senior-friendly')) {
            card.classList.add('tournament-card--senior');
        }

        // Show raw time control only when it adds info beyond the class label
        const tc = (tournament.timeControl ?? '').trim();
        const TC_CLASS_LABELS = new Set(['classical', 'rapid', 'blitz', '']);
        const tcDisplay = TC_CLASS_LABELS.has(tc.toLowerCase()) ? '' : formatTimeControl(tc);
        const timeControlHTML = tcDisplay
            ? `<span class="time-control-badge" title="${escapeHTML(tc)}">${escapeHTML(tcDisplay)}</span>`
            : '';

        const timeControlClassHTML = this.timeControlClassHTML(tournament);
        const categoryTagsHTML = this.categoryTagsHTML(tournament);

        // Featured seaside: the venue itself is within 500 m of the sea
        const beachfrontHTML = tournament.seaM !== undefined
            ? `<span class="beachfront-pill" title="The venue is about ${tournament.seaM} m from the sea (OpenStreetMap coastline)"><span aria-hidden="true">🏖</span> Beachfront · ${tournament.seaM} m from the sea</span>`
            : '';
        if (tournament.seaM !== undefined) card.classList.add('tournament-card--beachfront');

        const durationLabel = formatDurationLabel(tournament.date, tournament.dateTo);
        const durationHTML = durationLabel
            ? `<span class="duration-pill">${escapeHTML(durationLabel)}</span>`
            : '';

        card.innerHTML = `
            <div class="tournament-date-badge" title="${escapeHTML(dateStr)}">
                <span class="sr-only">${escapeHTML(dateStr)}</span>
                <span class="tournament-date-badge-day" aria-hidden="true">${day}</span>
                <span class="tournament-date-badge-month" aria-hidden="true">${month}</span>
                ${end ? `<span class="tournament-date-badge-end" aria-hidden="true">${escapeHTML(end)}</span>` : ''}
                ${year ? `<span class="tournament-date-badge-year" aria-hidden="true">${year}</span>` : ''}
            </div>
            <div class="tournament-body">
                <div class="tournament-header">
                    <h3 class="tournament-name">
                        <a href="${tournament.url}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="tournament-link"
                           aria-label="View details for ${escapeHTML(tournament.name)}">
                            ${escapeHTML(tournament.name)}
                        </a>
                    </h3>
                    <div class="tournament-header-right">
                        <button class="shortlist-btn${isShortlisted ? ' shortlisted' : ''}"
                                data-tournament-url="${escapeHTML(tournament.url)}"
                                data-tournament-name="${escapeHTML(tournament.name)}"
                                aria-pressed="${isShortlisted}"
                                aria-label="${isShortlisted ? 'Remove from' : 'Add to'} shortlist: ${escapeHTML(tournament.name)}">
                            <span class="shortlist-star">${isShortlisted ? '★' : '☆'}</span>
                        </button>
                    </div>
                </div>
                <div class="tournament-location"><span class="tournament-place"${tournament.town ? ` title="${escapeHTML(tournament.location.replace(/,\s*[A-Z]{3}$/, ''))}"` : ''}>${formatLocation(tournament.location, tournament.town)}${this.airportHintHTML(tournament)}</span></div>
                <div class="tournament-meta">
                    ${beachfrontHTML}
                    ${timeControlClassHTML}
                    ${timeControlHTML}
                    ${categoryTagsHTML}
                    ${durationHTML}
                </div>
                ${travelTagsHTML}
                <div class="tournament-actions">
                    <button class="calendar-export-btn"
                            data-tournament-url="${escapeHTML(tournament.url)}"
                            aria-label="Add ${escapeHTML(tournament.name)} to calendar">
                        <span aria-hidden="true">📅</span> Add to Calendar
                    </button>
                    <button class="copy-link-btn"
                            data-tournament-url="${escapeHTML(tournament.url)}"
                            aria-label="Copy share link for ${escapeHTML(tournament.name)}">
                        Copy link
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    /**
     * Render pagination controls
     */
    private renderPagination(container: HTMLElement): void {
        const totalPages = Math.ceil(this.filteredTournaments.length / this.itemsPerPage);

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination-container';

        // Pagination info
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredTournaments.length);

        paginationDiv.innerHTML = `
            <div class="pagination-info" aria-live="polite" aria-atomic="true">
                Showing ${startIndex}-${endIndex} of ${this.filteredTournaments.length} tournaments
            </div>
            <div class="pagination-controls" role="navigation" aria-label="Tournament pagination">
                <button class="pagination-btn"
                        data-page="prev"
                        ${this.currentPage === 1 ? 'disabled' : ''}
                        aria-label="Previous page">
                    ← Previous
                </button>
                ${this.generatePageButtons(totalPages)}
                <button class="pagination-btn"
                        data-page="next"
                        ${this.currentPage === totalPages ? 'disabled' : ''}
                        aria-label="Next page">
                    Next →
                </button>
            </div>
        `;

        container.appendChild(paginationDiv);

        // Add event listeners
        this.attachPaginationListeners(paginationDiv, totalPages);
    }

    /**
     * Generate page number buttons
     */
    private generatePageButtons(totalPages: number): string {
        const buttons: string[] = [];
        const maxButtons = 7;

        if (totalPages <= maxButtons) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                buttons.push(this.createPageButton(i));
            }
        } else {
            // Show first, last, current, and nearby pages
            buttons.push(this.createPageButton(1));

            if (this.currentPage > 3) {
                buttons.push('<span class="pagination-ellipsis">...</span>');
            }

            const start = Math.max(2, this.currentPage - 1);
            const end = Math.min(totalPages - 1, this.currentPage + 1);

            for (let i = start; i <= end; i++) {
                buttons.push(this.createPageButton(i));
            }

            if (this.currentPage < totalPages - 2) {
                buttons.push('<span class="pagination-ellipsis">...</span>');
            }

            buttons.push(this.createPageButton(totalPages));
        }

        return buttons.join('');
    }

    /**
     * Create page button HTML
     */
    private createPageButton(page: number): string {
        const isActive = page === this.currentPage;
        return `
            <button class="pagination-btn ${isActive ? 'active' : ''}"
                    data-page="${page}"
                    ${isActive ? 'aria-current="page"' : ''}
                    aria-label="Page ${page}">
                ${page}
            </button>
        `;
    }

    /**
     * Attach pagination event listeners
     */
    private attachPaginationListeners(container: HTMLElement, totalPages: number): void {
        const buttons = container.querySelectorAll('.pagination-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const page = target.getAttribute('data-page');

                if (page === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                    this.renderResults();
                } else if (page === 'next' && this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderResults();
                } else if (page && !isNaN(parseInt(page))) {
                    this.currentPage = parseInt(page);
                    this.renderResults();
                }

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    /**
     * Show empty state, using any context set by prepareEmptyState().
     */
    private showEmptyState(container: HTMLElement): void {
        const ctx = this.emptyStateContext;
        this.emptyStateContext = null;

        const countLine = ctx && ctx.totalCount > 0
            ? `<p class="empty-state-message empty-state-count">0 of ${ctx.totalCount.toLocaleString()} tournaments match your filters.</p>`
            : `<p class="empty-state-message">We couldn't find any tournaments matching your current filters.</p>`;

        const relaxations = ctx?.relaxations ?? [];

        const relaxationItems = relaxations.length > 0
            ? relaxations.map((r, i) => `
                <li>
                    <button type="button" class="empty-state-relaxation-btn" data-relaxation-index="${i}">
                        ${escapeHTML(r.label)} <span class="empty-state-relaxation-count">(${r.count.toLocaleString()})</span>
                    </button>
                </li>
            `).join('')
            : ['Expand the date range', 'Remove some filter criteria', 'Try a different country or location']
                .map(s => `<li>${escapeHTML(s)}</li>`)
                .join('');

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">🔍</div>
                <h3 class="empty-state-title">No Tournaments Found</h3>
                ${countLine}
                <div class="empty-state-suggestions">
                    <h4>${relaxations.length > 0 ? 'One-tap fixes:' : 'Try adjusting your filters:'}</h4>
                    <ul>${relaxationItems}</ul>
                </div>
                <div class="empty-state-actions">
                    <button class="reset-filters-btn" id="resetFiltersBtn">
                        <span aria-hidden="true">🔄</span> Reset All Filters
                    </button>
                </div>
                <p class="empty-state-info">
                    <small>Tournament data is updated daily from chess-results.com</small>
                </p>
            </div>
        `;
    }

    /**
     * Show error message
     */
    showError(message: string, type: 'error' | 'warning' | 'success' = 'error', onRetry?: () => void): void {
        const error = document.getElementById('error');
        if (!error) return;

        error.textContent = message;
        error.className = `error-message ${type}-type`;
        error.style.display = 'block';

        // With live filtering there's no Search button to press again, so a
        // failed load offers its own retry.
        if (onRetry) {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'error-retry-btn';
            retry.textContent = 'Try again';
            retry.addEventListener('click', () => {
                error.style.display = 'none';
                onRetry();
            });
            error.append(' ', retry);
        }

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                error.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Keep the "Show N tournaments" jump button's label in step with the
     * live result count (the button itself is only displayed below 1024px,
     * where the filters sit above the results - see styles.css).
     */
    updateShowResultsButton(count: number): void {
        const btn = document.getElementById('showResultsBtn');
        if (!btn) return;
        btn.textContent = count === 0
            ? 'No matches – see suggestions ↓'
            : `Show ${count.toLocaleString('en-GB')} tournament${count === 1 ? '' : 's'} ↓`;
    }

    /** Scroll the results into view and move focus to their heading. */
    scrollToResults(): void {
        const heading = document.getElementById('resultsHeading');
        if (!heading) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        heading.focus({ preventScroll: true });
    }

    /**
     * Show brief "Copied!" feedback on a copy-link button.
     */
    showCopyLinkFeedback(btn: HTMLElement): void {
        const original = btn.textContent ?? 'Copy link';
        btn.textContent = 'Copied!';
        btn.classList.add('copy-link-btn--copied');
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copy-link-btn--copied');
        }, 2000);
    }

    /**
     * Scroll to and briefly highlight the tournament card matching the given URL.
     * Called after a deep-link search (?t= param) completes rendering.
     */
    /**
     * Go to the results page that holds this tournament, then highlight its
     * card (used by the map's "Show in list"). No-op if it isn't in the list.
     */
    showTournamentInList(url: string): void {
        const index = this.filteredTournaments.findIndex(t => t.url === url);
        if (index < 0) return;
        this.currentPage = Math.floor(index / this.itemsPerPage) + 1;
        this.renderResults();
        this.highlightTournament(url);
    }

    highlightTournament(url: string): void {
        // Find the card that contains a .tournament-link pointing to this URL
        const link = document.querySelector<HTMLAnchorElement>(
            `.tournament-link[href="${CSS.escape(url)}"]`
        ) ?? document.querySelector<HTMLAnchorElement>(
            `.tournament-link[href*="${CSS.escape(encodeURIComponent(url))}"]`
        );
        const target = link?.closest<HTMLElement>('.tournament-card') ?? null;
        if (!target) return;

        target.classList.add('highlighted');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => target.classList.remove('highlighted'), 3000);
    }

    /**
     * Hide error message
     */
    hideError(): void {
        const error = document.getElementById('error');
        if (error) {
            error.style.display = 'none';
        }
    }

    /**
     * Get filtered tournaments for export
     */
    getFilteredTournaments(): Tournament[] {
        return this.filteredTournaments;
    }

    /**
     * Get tournament by its stable URL key (for calendar export from a card
     * button). Resolves against the currently displayed set, so it works
     * correctly regardless of pagination.
     */
    getTournamentByUrl(url: string): Tournament | null {
        return this.filteredTournaments.find(t => t.url === url) ?? null;
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode(): void {
        this.setDarkMode(!document.body.classList.contains('dark-theme'));
    }

    /**
     * Set dark mode state. Only the accessible name changes here - the
     * button's visible icon (#themeToggleIcon) is app.ts's
     * updateThemeButtonText(); replacing the button's textContent would
     * wipe that icon markup and leave "Light Mode" text spilling out of the
     * round icon button.
     */
    setDarkMode(enabled: boolean): void {
        document.body.classList.toggle('dark-theme', enabled);
        document.getElementById('themeToggle')
            ?.setAttribute('aria-label', enabled ? 'Switch to light mode' : 'Switch to dark mode');
    }

    /**
     * On phones, the fixed-position "Show N tournaments" button is pinned to
     * `window.innerHeight` (the layout viewport), which Chrome for Android
     * sizes as if its toolbar were hidden even while it's showing. That
     * leaves the button positioned below the actually-visible visual
     * viewport by the toolbar's height. Track the gap via the
     * visualViewport API and expose it as a CSS custom property so
     * `.show-results-btn`'s `bottom` offset can compensate; see styles.css.
     */
    initViewportOffsetFix(): void {
        const viewport = window.visualViewport;
        if (!viewport) return;

        const update = (): void => {
            const gap = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
            document.documentElement.style.setProperty('--viewport-toolbar-gap', `${gap}px`);
        };

        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        window.addEventListener('resize', update);
        // window.innerHeight itself is unreliable immediately after
        // navigation (observed ~800ms of drift before it reflects Chrome's
        // real toolbar-adjusted value, with no resize/visualViewport event
        // marking the change) — re-measure once the page has settled.
        window.addEventListener('load', update);
        update();
    }
}
