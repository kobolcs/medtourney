import { ShortlistPart } from './ShortlistPart';
import { closeCalendarMenu, closeCalendarMenuOnScroll, openCalendarMenu } from '../utils/calendarMenu';
import { initDetailPanel, openDetailPanel } from '../utils/detailPanel';
export class CardActionsPart extends ShortlistPart {
    initCalendarExportDelegation() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            const item = target.closest('.calendar-menu-item');
            if (item) {
                this.onCalendarMenuItem(item);
                return;
            }
            const btn = target.closest('.calendar-export-btn');
            if (!btn) {
                if (!target.closest('.calendar-menu'))
                    closeCalendarMenu();
                return;
            }
            e.preventDefault();
            const tournament = this.findTournamentByUrl(btn.dataset.tournamentUrl);
            if (!tournament) {
                this.uiManager.showError('Could not find that tournament to export.', 'warning');
                return;
            }
            openCalendarMenu(btn, tournament);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape')
                closeCalendarMenu(true);
        });
        window.addEventListener('scroll', closeCalendarMenuOnScroll, { passive: true });
    }
    findTournamentByUrl(url) {
        if (!url)
            return undefined;
        return this.displayedTournaments.find(t => t.url === url) ??
            this.filteredTournaments.find(t => t.url === url) ??
            this.allTournaments.find(t => t.url === url);
    }
    onCalendarMenuItem(item) {
        const tournament = this.findTournamentByUrl(item.closest('.calendar-menu')?.dataset.tournamentUrl);
        closeCalendarMenu(true);
        if (!tournament)
            return;
        if (item.dataset.action === 'google') {
            this.trackEvent('Calendar', { type: 'google' });
            return;
        }
        try {
            this.exportService.exportToCalendar(tournament);
            this.trackEvent('ICS Export', { type: 'single' });
            this.uiManager.showError(`Calendar event created for "${tournament.name}"`, 'success');
        }
        catch (error) {
            this.logger.error('Calendar export failed', error);
            this.uiManager.showError('Failed to create calendar event. Please try again.');
        }
    }
    initTournamentCardClickDelegation() {
        initDetailPanel();
        const tournamentList = document.getElementById('tournamentList');
        tournamentList?.addEventListener('click', (e) => {
            const target = e.target;
            if (target.closest('button'))
                return;
            const link = target.closest('a');
            if (link && !link.classList.contains('tournament-link'))
                return;
            if (link && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey))
                return;
            const card = target.closest('.tournament-card');
            const tournament = this.findTournamentByUrl(card?.dataset.tournamentUrl);
            if (!tournament)
                return;
            e.preventDefault();
            this.openTournamentDetail(tournament);
        });
        document.getElementById('featuredTournament')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.featured-name-btn');
            if (!btn)
                return;
            const tournament = this.findTournamentByUrl(btn.dataset.tournamentUrl);
            if (!tournament)
                return;
            this.openTournamentDetail(tournament);
        });
    }
    openTournamentDetail(tournament) {
        openDetailPanel(tournament, this.shortlist.has(tournament.url), url => this.toggleShortlist(url));
        this.trackEvent('Detail Panel');
    }
}
//# sourceMappingURL=CardActionsPart.js.map