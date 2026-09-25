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

/** Tournament card actions: calendar, copy link, card click. */
export abstract class CardActionsPart extends ShortlistPart {
    /**
     * Calendar button on a card: opens a small menu - "Google Calendar" (a
     * link, nothing to install) or "Download .ics" (Outlook, Apple Calendar,
     * Thunderbird). Delegated once for all pages: each button carries its
     * tournament's stable URL key (data-tournament-url), not a position.
     */
    protected initCalendarExportDelegation(): void {
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
     * Delegated click handler for copy-link buttons on tournament cards.
     * Copies a deep-link URL (?t=<encoded>) to the clipboard and shows brief feedback.
     */
    protected initCopyLinkDelegation(): void {
        document.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest('.copy-link-btn');
            if (!btn) return;
            e.preventDefault();

            const url = (btn as HTMLElement).dataset.tournamentUrl;
            if (!url) return;

            const shareUrl = `${location.origin}${location.pathname}?t=${encodeURIComponent(url)}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.uiManager.showCopyLinkFeedback(btn as HTMLElement);
                this.trackEvent('Share Link Copied');
            }).catch(() => {
                this.uiManager.showError('Could not copy to clipboard. Please copy the URL manually.', 'warning');
            });
        });
    }

    /**
     * Delegated click handler that makes the whole tournament card open the
     * tournament's chess-results.com page in a new tab, not just the name
     * text. Ignores clicks on any link/button inside the card (the name
     * link, shortlist star, calendar export, copy link) so those keep their
     * own behavior instead of also triggering this.
     */
    protected initTournamentCardClickDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            if ((e.target as Element).closest('a, button')) return;

            const card = (e.target as Element).closest<HTMLElement>('.tournament-card');
            const url = card?.dataset.tournamentUrl;
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    }
}
