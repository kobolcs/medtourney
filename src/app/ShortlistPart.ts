/**
 * TournamentFinder, part: ShortlistPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { EmptyStatePart } from './EmptyStatePart';

/** Shortlist: persistence, toggling and the shortlist calendar export. */
export abstract class ShortlistPart extends EmptyStatePart {
    /**
     * Load shortlist from localStorage (URLs, no TTL — persists indefinitely)
     */
    protected loadShortlist(): void {
        try {
            const saved = localStorage.getItem(this.SHORTLIST_KEY);
            if (saved) {
                const urls: string[] = JSON.parse(saved);
                this.shortlist = new Set(urls);
            }
        } catch {
            this.shortlist = new Set();
        }
    }

    protected saveShortlist(): void {
        try {
            localStorage.setItem(this.SHORTLIST_KEY, JSON.stringify([...this.shortlist]));
        } catch {
            // Storage full or unavailable — silently ignore
        }
    }

    protected toggleShortlist(url: string): void {
        if (this.shortlist.has(url)) {
            this.shortlist.delete(url);
        } else {
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

    /**
     * Delegated shortlist toggle listener — one listener handles all cards/pages
     */
    protected initShortlistDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.shortlist-btn');
            if (!btn) return;
            e.preventDefault();
            const url = (btn as HTMLElement).dataset.tournamentUrl;
            if (url) {
                this.toggleShortlist(url);
            }
        });
    }

    /**
     * Export all shortlisted tournaments to a single .ics file.
     *
     * Handles the post-reload case honestly: if the user has saved shortlist
     * items but tournament data has not loaded yet, we load it first instead of
     * falsely telling them to "star tournaments first".
     */
    protected async exportShortlistToCalendar(): Promise<void> {
        // Genuinely empty shortlist — this is the only case where the
        // "star tournaments first" guidance is correct.
        if (this.shortlist.size === 0) {
            this.uiManager.showError('Star tournaments to add them to your shortlist first', 'warning');
            return;
        }

        // The user has shortlist items but data may not be loaded yet
        // (e.g. straight after a page reload). Load it before resolving URLs.
        if (this.allTournaments.length === 0) {
            await this.preloadTournamentData();
        }

        if (this.allTournaments.length === 0) {
            this.uiManager.showError(
                'Could not load tournament data. Please run a search first, then export your shortlist.',
                'warning'
            );
            return;
        }

        const shortlisted = this.allTournaments.filter(t => this.shortlist.has(t.url));

        if (shortlisted.length === 0) {
            this.uiManager.showError(
                'Your shortlisted tournaments are not in the current data set (they may have passed or been removed).',
                'warning'
            );
            return;
        }

        try {
            this.exportService.exportMultipleToCalendar(shortlisted);
            this.trackEvent('ICS Export', { type: 'shortlist', count: shortlisted.length });
            this.uiManager.showError(
                `Exported ${shortlisted.length} shortlisted tournament${shortlisted.length !== 1 ? 's' : ''} to calendar`,
                'success'
            );
        } catch (error) {
            this.logger.error('Shortlist calendar export failed', error);
            this.uiManager.showError('Failed to export shortlist. Please try again.');
        }
    }
}
