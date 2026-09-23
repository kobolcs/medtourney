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

import { Tournament } from '../types';
import { formatLocation } from '../utils/countries';

export class UIManager {
    private currentPage = 1;
    private itemsPerPage = 10;
    private filteredTournaments: Tournament[] = [];
    private shortlistedUrls: Set<string> = new Set();
    private emptyStateContext: { totalCount: number; suggestions: string[] } | null = null;

    /** Called before displayTournaments when the result set will be empty. */
    prepareEmptyState(totalCount: number, suggestions: string[]): void {
        this.emptyStateContext = { totalCount, suggestions };
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
     * Display tournaments
     */
    displayTournaments(tournaments: Tournament[]): void {
        this.filteredTournaments = tournaments;
        this.currentPage = 1;
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
        this.renderPaginatedTournaments(tournamentList);
    }

    /**
     * Render paginated tournament list
     */
    private renderPaginatedTournaments(container: HTMLElement): void {
        container.innerHTML = '';

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredTournaments.length);
        const pageTournaments = this.filteredTournaments.slice(startIndex, endIndex);

        pageTournaments.forEach(tournament => {
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

    /** Day number + 3-letter month for the card's left-hand date badge. */
    private formatDateBadge(date: Date): { day: string; month: string } {
        const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
        // en-GB renders September as "Sept" (4 chars) - slice to a consistent 3.
        const month = date.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3);
        return { day, month };
    }

    /**
     * Condense a verbose time control into "base'+increment"" (e.g. "90 minutes
     * with 30 second increment from move 1" -> 90'+30"). Values that are
     * already short (bare "N+M" format like "8+3") are left unchanged.
     */
    private condenseTimeControl(tc: string): string {
        if (/^\d+\s*['"]?\s*\+\s*\d+\s*['"]?$/.test(tc)) return tc;

        const lower = tc.toLowerCase();
        const baseMatch = lower.match(/(\d+)\s*(h(?:our)?s?|min(?:ute)?s?)/);
        if (!baseMatch) return tc;

        const value = parseInt(baseMatch[1]!, 10);
        const baseMinutes = baseMatch[2]!.startsWith('h') ? value * 60 : value;
        const incMatch = lower.match(/(\d+)\s*sec(?:ond)?s?/);
        const increment = incMatch ? parseInt(incMatch[1]!, 10) : 0;

        return `${baseMinutes}'+${increment}"`;
    }

    /** Inclusive day count when dateTo is present and later than the start date. */
    private tournamentDurationDays(tournament: Tournament): number | null {
        if (!tournament.dateTo) return null;
        const to = new Date(tournament.dateTo);
        if (isNaN(to.getTime())) return null;
        const days = Math.round((to.getTime() - tournament.date.getTime()) / 86400000) + 1;
        return days > 1 ? days : null;
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
        container.innerHTML = `
            <div class="featured-card" role="region" aria-label="Tournament of the Week">
                <div class="featured-label">Tournament of the Week</div>
                <h3 class="featured-name">
                    <a href="${tournament.url}" target="_blank" rel="noopener noreferrer"
                       class="featured-name-link"
                       aria-label="View details for ${this.escapeHTML(tournament.name)}">
                        ${this.escapeHTML(tournament.name)}
                    </a>
                </h3>
                <div class="featured-location">${this.escapeHTML(tournament.location)}</div>
                <div class="featured-meta">
                    <span class="featured-date">${dateStr}</span>
                    <span class="featured-category">${this.escapeHTML(tournament.category)}</span>
                </div>
                <div class="tournament-actions">
                    <a href="${tournament.url}" target="_blank" rel="noopener noreferrer"
                       class="tournament-link"
                       aria-label="View details for ${this.escapeHTML(tournament.name)}">
                        View Tournament
                    </a>
                    <button class="calendar-export-btn"
                            data-tournament-url="${this.escapeHTML(tournament.url)}"
                            aria-label="Add ${this.escapeHTML(tournament.name)} to calendar">
                        📅 Add to Calendar
                    </button>
                </div>
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

        const { day, month } = this.formatDateBadge(tournament.date);
        const dateStr = this.formatDateRange(tournament.date, tournament.dateTo);

        const isShortlisted = this.shortlistedUrls.has(tournament.url);
        const tags = tournament.travelTags ?? [];

        const GEOGRAPHIC_TAGS = new Set(['Mediterranean', 'Seaside', 'Senior-friendly', "Women's"]);
        const meaningfulTags = tags.filter(t => GEOGRAPHIC_TAGS.has(t));
        const travelTagsHTML = meaningfulTags.length > 0
            ? `<div class="travel-tags">${meaningfulTags.map(t => `<span class="travel-tag">${this.escapeHTML(t)}</span>`).join('')}</div>`
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
        const timeControlHTML = tc && !TC_CLASS_LABELS.has(tc.toLowerCase())
            ? `<span class="time-control-badge" title="${this.escapeHTML(tc)}">${this.escapeHTML(this.condenseTimeControl(tc))}</span>`
            : '';

        const durationDays = this.tournamentDurationDays(tournament);
        const durationHTML = durationDays !== null
            ? `<span class="duration-pill">${durationDays} days</span>`
            : '';

        card.innerHTML = `
            <div class="tournament-date-badge" aria-hidden="true">
                <span class="tournament-date-badge-day">${day}</span>
                <span class="tournament-date-badge-month">${month}</span>
            </div>
            <div class="tournament-body">
                <div class="tournament-header">
                    <h3 class="tournament-name">
                        <a href="${tournament.url}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="tournament-link"
                           aria-label="View details for ${this.escapeHTML(tournament.name)}">
                            ${this.escapeHTML(tournament.name)}
                        </a>
                    </h3>
                    <div class="tournament-header-right">
                        <span class="tournament-date">${dateStr}</span>
                        <button class="shortlist-btn${isShortlisted ? ' shortlisted' : ''}"
                                data-tournament-url="${this.escapeHTML(tournament.url)}"
                                data-tournament-name="${this.escapeHTML(tournament.name)}"
                                aria-pressed="${isShortlisted}"
                                aria-label="${isShortlisted ? 'Remove from' : 'Add to'} shortlist: ${this.escapeHTML(tournament.name)}">
                            <span class="shortlist-star">${isShortlisted ? '★' : '☆'}</span>
                        </button>
                    </div>
                </div>
                <div class="tournament-location">${this.escapeHTML(formatLocation(tournament.location))}</div>
                <div class="tournament-meta">
                    <span class="tournament-category">${this.escapeHTML(tournament.category)}</span>
                    ${timeControlHTML}
                    ${durationHTML}
                </div>
                ${travelTagsHTML}
                <div class="tournament-actions">
                    <button class="calendar-export-btn"
                            data-tournament-url="${this.escapeHTML(tournament.url)}"
                            aria-label="Add ${this.escapeHTML(tournament.name)} to calendar">
                        <span aria-hidden="true">📅</span> Add to Calendar
                    </button>
                    <button class="copy-link-btn"
                            data-tournament-url="${this.escapeHTML(tournament.url)}"
                            aria-label="Copy share link for ${this.escapeHTML(tournament.name)}">
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

        const suggestions = ctx?.suggestions.length
            ? ctx.suggestions
            : ['Expand the date range', 'Remove some filter criteria', 'Try a different country or location'];

        const suggestionItems = suggestions
            .map(s => `<li>${this.escapeHTML(s)}</li>`)
            .join('');

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">🔍</div>
                <h3 class="empty-state-title">No Tournaments Found</h3>
                ${countLine}
                <div class="empty-state-suggestions">
                    <h4>Try adjusting your filters:</h4>
                    <ul>${suggestionItems}</ul>
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
    showError(message: string, type: 'error' | 'warning' | 'success' = 'error'): void {
        const error = document.getElementById('error');
        if (!error) return;

        error.textContent = message;
        error.className = `error-message ${type}-type`;
        error.style.display = 'block';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                error.style.display = 'none';
            }, 5000);
        }
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
     * Update last updated timestamp
     */
    updateLastUpdatedTimestamp(): void {
        const timestampEl = document.getElementById('lastUpdatedTime');
        if (timestampEl) {
            const now = new Date();
            const formattedDate = now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            });
            timestampEl.textContent = formattedDate;
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
     * Escape HTML to prevent XSS
     */
    private escapeHTML(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode(): void {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }

    /**
     * Set dark mode state
     */
    setDarkMode(enabled: boolean): void {
        if (enabled) {
            document.body.classList.add('dark-theme');
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.textContent = '☀️ Light Mode';
                themeToggle.setAttribute('aria-label', 'Switch to light mode');
            }
        } else {
            document.body.classList.remove('dark-theme');
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.textContent = '🌙 Dark Mode';
                themeToggle.setAttribute('aria-label', 'Switch to dark mode');
            }
        }
    }

    /**
     * On phones, the fixed-position Search button is pinned to
     * `window.innerHeight` (the layout viewport), which Chrome for Android
     * sizes as if its toolbar were hidden even while it's showing. That
     * leaves the button positioned below the actually-visible visual
     * viewport by the toolbar's height. Track the gap via the
     * visualViewport API and expose it as a CSS custom property so
     * `.search-button`'s `bottom` offset can compensate; see styles.css.
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
