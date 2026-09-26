/**
 * TournamentFinder, part: DataFreshnessPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder.
 *
 * As of 2026-09-26 the page no longer shows when the data was last updated
 * (header, footer) or a public "data is N days old" banner: the site is
 * expected to be current, and a failed update is the owner's problem, not
 * the visitor's. Failures now open a GitHub issue instead
 * (.github/workflows/update-tournaments.yml, data-health.yml).
 */
import { ThemeHelpPart } from './ThemeHelpPart';

/** Header live status: "N European tournaments". */
export abstract class DataFreshnessPart extends ThemeHelpPart {
    /** Refresh the header's "N European tournaments" line after each load. */
    protected updateHeaderLiveStatus(): void {
        const countEl = document.getElementById('headerTournamentCount');
        if (!countEl || this.allTournaments.length === 0) return;

        const count = this.allTournaments.length.toLocaleString('en-GB');
        countEl.textContent = `${count} European tournaments`;
    }
}
