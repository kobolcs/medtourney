import { FilterFormPart } from './FilterFormPart';
export class ResultsViewPart extends FilterFormPart {
    handleSortChange(sortBy) {
        this.currentSort = sortBy;
        if (this.filteredTournaments.length > 0) {
            this.filteredTournaments = this.filterService.sortTournaments(this.filteredTournaments, sortBy);
            this.applyDisplayFilters();
        }
    }
    narrowForDisplay(list, search = this.currentQuickSearch, shortlistOnly = this.showShortlistOnly) {
        let out = list;
        if (shortlistOnly)
            out = out.filter(t => this.shortlist.has(t.url));
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter(t => t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q));
        }
        return out;
    }
    applyDisplayFilters() {
        const toDisplay = this.narrowForDisplay(this.filteredTournaments);
        this.displayedTournaments = toDisplay;
        this.uiManager.setShortlistedUrls(this.shortlist);
        if (toDisplay.length === 0) {
            if (this.showShortlistOnly && this.shortlist.size > 0) {
                const n = this.shortlist.size;
                const matched = this.filteredTournaments.filter(t => this.shortlist.has(t.url)).length;
                const msg = `${matched} of ${n} saved tournament${n === 1 ? '' : 's'} match your current filters.`
                    + (matched === 0 ? ' Uncheck "Show saved only" to see all results.' : '');
                this.uiManager.prepareEmptyState(0, [], msg);
            }
            else {
                this.lastEmptyStateRelaxations = this.buildEmptyStateRelaxations();
                this.uiManager.prepareEmptyState(this.allTournaments.length, this.lastEmptyStateRelaxations.map(({ label, count }) => ({ label, count })));
            }
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
            setTimeout(() => {
                this.uiManager.highlightTournament(target);
                const shared = this.allTournaments.find(t => t.url === target);
                if (shared)
                    this.openTournamentDetail(shared);
            }, 100);
        }
    }
    async setView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            const active = btn.dataset.view === view;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        this.syncMapVisibility();
        if (view === 'list')
            return;
        const canvas = document.getElementById('mapCanvas');
        if (!canvas)
            return;
        try {
            if (!this.mapView) {
                const { MapView } = await import('../services/MapView');
                this.mapView ?? (this.mapView = new MapView(canvas, document.getElementById('mapNote'), url => {
                    void this.setView('list');
                    this.uiManager.showTournamentInList(url);
                }));
            }
            await this.mapView.show(this.displayedTournaments);
            this.trackEvent('Map View');
        }
        catch {
            this.uiManager.showError("The map couldn't be loaded - showing the list instead.", 'warning');
            void this.setView('list');
        }
    }
    syncMapVisibility() {
        const showMap = this.currentView === 'map' && this.displayedTournaments.length > 0;
        const mapView = document.getElementById('mapView');
        const list = document.getElementById('tournamentList');
        if (mapView)
            mapView.hidden = !showMap;
        if (list)
            list.hidden = showMap;
    }
    exportToCSV() {
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
            this.uiManager.showError(`Exported ${count} tournament${count !== 1 ? 's' : ''} to CSV`, 'success');
        }
        catch (error) {
            this.logger.error('CSV export failed', error, {
                tournamentCount: this.displayedTournaments.length
            });
            this.uiManager.showError('Failed to export CSV. Please try again.');
        }
    }
}
//# sourceMappingURL=ResultsViewPart.js.map