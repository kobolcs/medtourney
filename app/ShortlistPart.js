import { EmptyStatePart } from './EmptyStatePart';
export class ShortlistPart extends EmptyStatePart {
    loadShortlist() {
        try {
            const saved = localStorage.getItem(this.SHORTLIST_KEY);
            if (saved) {
                const urls = JSON.parse(saved);
                this.shortlist = new Set(urls);
            }
        }
        catch {
            this.shortlist = new Set();
        }
    }
    saveShortlist() {
        try {
            localStorage.setItem(this.SHORTLIST_KEY, JSON.stringify([...this.shortlist]));
        }
        catch {
        }
    }
    toggleShortlist(url) {
        if (this.shortlist.has(url)) {
            this.shortlist.delete(url);
        }
        else {
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
    initShortlistDelegation() {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList)
            return;
        tournamentList.addEventListener('click', (e) => {
            const btn = e.target.closest('.shortlist-btn');
            if (!btn)
                return;
            e.preventDefault();
            const url = btn.dataset.tournamentUrl;
            if (url) {
                this.toggleShortlist(url);
            }
        });
    }
    async exportShortlistToCalendar() {
        if (this.shortlist.size === 0) {
            this.uiManager.showError('Star tournaments to add them to your shortlist first', 'warning');
            return;
        }
        if (this.allTournaments.length === 0) {
            await this.preloadTournamentData();
        }
        if (this.allTournaments.length === 0) {
            this.uiManager.showError('Could not load tournament data. Please run a search first, then export your shortlist.', 'warning');
            return;
        }
        const shortlisted = this.allTournaments.filter(t => this.shortlist.has(t.url));
        if (shortlisted.length === 0) {
            this.uiManager.showError('Your shortlisted tournaments are not in the current data set (they may have passed or been removed).', 'warning');
            return;
        }
        try {
            this.exportService.exportMultipleToCalendar(shortlisted);
            this.trackEvent('ICS Export', { type: 'shortlist', count: shortlisted.length });
            this.uiManager.showError(`Exported ${shortlisted.length} shortlisted tournament${shortlisted.length !== 1 ? 's' : ''} to calendar`, 'success');
        }
        catch (error) {
            this.logger.error('Shortlist calendar export failed', error);
            this.uiManager.showError('Failed to export shortlist. Please try again.');
        }
    }
}
//# sourceMappingURL=ShortlistPart.js.map