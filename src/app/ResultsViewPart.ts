/**
 * TournamentFinder, part: ResultsViewPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { Tournament } from '../types';
import type { SortOption } from './AppState';
import { FilterFormPart } from './FilterFormPart';

/** Results view: sort, quick search / shortlist narrowing, list/map view, CSV export. */
export abstract class ResultsViewPart extends FilterFormPart {
    /**
     * Handle sort dropdown change
     */
    protected handleSortChange(sortBy: SortOption): void {
        this.currentSort = sortBy;

        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(
                this.filteredTournaments,
                sortBy
            );
            this.applyDisplayFilters();
        }
    }

    /**
     * Apply shortlist-only and quick-search display filters on top of filteredTournaments.
     * Always call this instead of uiManager.updateDisplayedTournaments directly.
     */
    /**
     * The results' own narrowing on top of the filters: "Shortlist only" and
     * the "Filter results..." text. Shared with the empty state's counts so a
     * suggested fix never promises results the list would then hide.
     */
    protected narrowForDisplay(
        list: Tournament[],
        search = this.currentQuickSearch,
        shortlistOnly = this.showShortlistOnly
    ): Tournament[] {
        let out = list;
        if (shortlistOnly) out = out.filter(t => this.shortlist.has(t.url));
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter(t => t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q));
        }
        return out;
    }

    protected applyDisplayFilters(): void {
        const toDisplay = this.narrowForDisplay(this.filteredTournaments);
        this.displayedTournaments = toDisplay;
        this.uiManager.setShortlistedUrls(this.shortlist);

        if (toDisplay.length === 0) {
            this.lastEmptyStateRelaxations = this.buildEmptyStateRelaxations();
            this.uiManager.prepareEmptyState(
                this.allTournaments.length,
                this.lastEmptyStateRelaxations.map(({ label, count }) => ({ label, count }))
            );
        }

        this.uiManager.displayTournaments(toDisplay, this.currentSort);
        this.uiManager.updateShowResultsButton(toDisplay.length);
        this.filterSheet?.setResultCount(toDisplay.length);
        if (this.currentView === 'map') {
            this.syncMapVisibility();
            this.mapView?.update(toDisplay);
        }

        if (this.deepLinkUrl) {
            const target = this.deepLinkUrl;
            this.deepLinkUrl = null;
            // Defer so the DOM has been painted before we scroll; then show
            // the shared tournament's details (a shared link's reader is new here)
            setTimeout(() => {
                this.uiManager.highlightTournament(target);
                const shared = this.allTournaments.find(t => t.url === target);
                if (shared) this.openTournamentDetail(shared);
            }, 100);
        }
    }

    /**
     * List/Map toggle. The map shows every tournament in the current results
     * (all pages); MapView loads Leaflet on first use. With zero results the
     * list's empty state (and its one-tap relaxations) stays on screen.
     */
    protected async setView(view: 'list' | 'map'): Promise<void> {
        this.currentView = view;
        document.querySelectorAll<HTMLButtonElement>('.view-toggle-btn').forEach(btn => {
            const active = btn.dataset.view === view;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        this.syncMapVisibility();
        if (view === 'list') return;

        const canvas = document.getElementById('mapCanvas');
        if (!canvas) return;
        try {
            // The map module (and Leaflet behind it) is only fetched on first use
            if (!this.mapView) {
                const { MapView } = await import('../services/MapView');
                this.mapView ??= new MapView(canvas, document.getElementById('mapNote'), url => {
                    void this.setView('list');
                    this.uiManager.showTournamentInList(url);
                });
            }
            await this.mapView.show(this.displayedTournaments);
            this.trackEvent('Map View');
        } catch {
            this.uiManager.showError("The map couldn't be loaded - showing the list instead.", 'warning');
            void this.setView('list');
        }
    }

    protected syncMapVisibility(): void {
        const showMap = this.currentView === 'map' && this.displayedTournaments.length > 0;
        const mapView = document.getElementById('mapView');
        const list = document.getElementById('tournamentList');
        if (mapView) mapView.hidden = !showMap;
        if (list) list.hidden = showMap;
    }

    /**
     * Export the currently displayed tournaments to CSV.
     * Exports exactly what the user sees — i.e. after the shortlist-only
     * toggle and quick-search have been applied — not the hidden superset.
     */
    protected exportToCSV(): void {
        if (this.displayedTournaments.length === 0) {
            this.uiManager.showError('No tournaments to export. Adjust your filters or search first.', 'warning');
            return;
        }

        try {
            this.exportService.exportToCSV(this.displayedTournaments);
            this.logger.info('CSV export successful', {
                tournamentCount: this.displayedTournaments.length
            });
            const count = this.displayedTournaments.length;
            this.trackEvent('CSV Export', { count });
            this.uiManager.showError(
                `Exported ${count} tournament${count !== 1 ? 's' : ''} to CSV`,
                'success'
            );
        } catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.displayedTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
    }
}
