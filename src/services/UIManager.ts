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
import { escapeHTML } from '../utils/html';
import { StatusViewsPart } from './ui/StatusViewsPart';

export class UIManager extends StatusViewsPart {
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
    protected renderResults(): void {
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
    protected monthKey(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth()}`;
    }

    /** Total tournaments per month across the whole filtered list (not just the current page). */
    protected computeMonthCounts(): void {
        this.monthCounts = new Map();
        if (!this.groupByDate) return;
        for (const t of this.filteredTournaments) {
            const key = this.monthKey(t.date);
            this.monthCounts.set(key, (this.monthCounts.get(key) ?? 0) + 1);
        }
    }

    protected createMonthDivider(date: Date, count: number): HTMLElement {
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
    protected renderPaginatedTournaments(container: HTMLElement): void {
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
