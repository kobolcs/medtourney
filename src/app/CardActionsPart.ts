/**
 * TournamentFinder, part: CardActionsPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { ShortlistPart } from './ShortlistPart';
import type { Tournament } from '../types';
import { closeCalendarMenu, closeCalendarMenuOnScroll, openCalendarMenu } from '../utils/calendarMenu';
import { initDetailPanel, openDetailPanel } from '../utils/detailPanel';
import { initSearchShare } from '../utils/shareSearch';

/** Tournament card actions: calendar, copy link, card click -> detail panel. */
export abstract class CardActionsPart extends ShortlistPart {
    /**
     * Calendar button on a card: opens a small menu - "Google Calendar" (a
     * link, nothing to install) or "Download .ics" (Outlook, Apple Calendar,
     * Thunderbird). Delegated once for all pages: each button carries its
     * tournament's stable URL key (data-tournament-url), not a position.
     */
    protected initCalendarExportDelegation(): void {
        initSearchShare();
        document.addEventListener('click', (e) => {
            const target = e.target as Element;
            const item = target.closest<HTMLElement>('.calendar-menu-item');
            if (item) {
                this.onCalendarMenuItem(item);
                return;
            }
            const btn = target.closest<HTMLElement>('.calendar-export-btn');
            if (!btn) {
                if (!target.closest('.calendar-menu')) closeCalendarMenu();
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
            if (e.key === 'Escape') closeCalendarMenu(true);
        });
        window.addEventListener('scroll', closeCalendarMenuOnScroll, { passive: true });
    }

    private findTournamentByUrl(url: string | undefined): Tournament | undefined {
        if (!url) return undefined;
        return this.displayedTournaments.find(t => t.url === url) ??
            this.filteredTournaments.find(t => t.url === url) ??
            this.allTournaments.find(t => t.url === url);
    }

    private onCalendarMenuItem(item: HTMLElement): void {
        const tournament = this.findTournamentByUrl(item.closest<HTMLElement>('.calendar-menu')?.dataset.tournamentUrl);
        closeCalendarMenu(true);
        if (!tournament) return;
        if (item.dataset.action === 'google') {
            this.trackEvent('Calendar', { type: 'google' });
            return; // the item is a link: the browser opens Google Calendar
        }
        try {
            this.exportService.exportToCalendar(tournament);
            this.trackEvent('ICS Export', { type: 'single' });
            this.uiManager.showError(`Calendar event created for "${tournament.name}"`, 'success');
        } catch (error) {
            this.logger.error('Calendar export failed', error);
            this.uiManager.showError('Failed to create calendar event. Please try again.');
        }
    }

    /**
     * A click on a card - or a plain left click on its name - opens the
     * detail panel. The name's href is a ?t= deep-link, so ctrl/middle-click
     * opens MedTourney with the panel pre-loaded. Buttons in the card keep
     * their own behavior.
     */
    protected initTournamentCardClickDelegation(): void {
        initDetailPanel();
        const tournamentList = document.getElementById('tournamentList');
        tournamentList?.addEventListener('click', (e) => {
            const target = e.target as Element;
            if (target.closest('button')) return;
            const link = target.closest('a');
            if (link && !link.classList.contains('tournament-link')) return;
            if (link && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
            const card = target.closest<HTMLElement>('.tournament-card');
            const tournament = this.findTournamentByUrl(card?.dataset.tournamentUrl);
            if (!tournament) return;
            e.preventDefault();
            this.openTournamentDetail(tournament);
        });

        document.getElementById('featuredTournament')?.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest<HTMLElement>('.featured-name-btn');
            if (!btn) return;
            const tournament = this.findTournamentByUrl(btn.dataset.tournamentUrl);
            if (!tournament) return;
            this.openTournamentDetail(tournament);
        });
    }

    /** Open the detail panel for one tournament (cards, map popups, shared ?t= links). */
    protected openTournamentDetail(tournament: Tournament): void {
        openDetailPanel(tournament, this.shortlist.has(tournament.url), url => this.toggleShortlist(url));
        this.trackEvent('Detail Panel');
    }
}
