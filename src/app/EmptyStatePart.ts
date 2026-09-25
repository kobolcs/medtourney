/**
 * TournamentFinder, part: EmptyStatePart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { Tournament, FilterState } from '../types';
import { CountryFilterPart } from './CountryFilterPart';

/** Empty state: one-tap relaxations with real result counts. */
export abstract class EmptyStatePart extends CountryFilterPart {
    /**
     * Build one-tap "relax this filter" options for the empty state, each
     * with the actual result count that relaxation would produce (computed
     * by re-running FilterService against the full unfiltered set, never the
     * live UI) - "show 3+ days (12)" beats a plain "reduce minimum duration"
     * tip because the number tells you whether it's worth tapping at all.
     * Sorted biggest-win first and capped so the list stays scannable.
     */
    protected buildEmptyStateRelaxations(): { label: string; count: number; apply: () => void; lead?: boolean }[] {
        const base = this.getFilterState();
        const filtered = (partial: Partial<FilterState> = {}): Tournament[] =>
            this.filterService.filterTournaments(this.allTournaments, { ...base, ...partial }, this.mediterraneanLocations);
        // Counts include the search box and "Shortlist only", exactly as the list would
        const countWith = (partial: Partial<FilterState>): number => this.narrowForDisplay(filtered(partial)).length;

        const relaxations: { label: string; count: number; apply: () => void; lead?: boolean }[] = [];

        // When the search text or "Shortlist only" is what empties the list,
        // undoing that is the obvious first fix
        const search = this.currentQuickSearch.trim();
        if (search) {
            relaxations.push({
                label: `Clear search "${search}"`,
                count: this.narrowForDisplay(filtered(), '').length,
                apply: () => this.clearQuickSearch(),
                lead: true,
            });
        }
        if (this.showShortlistOnly) {
            relaxations.push({
                label: 'Show all, not just the shortlist',
                count: this.narrowForDisplay(filtered(), this.currentQuickSearch, false).length,
                apply: () => this.setShortlistOnly(false),
                lead: true,
            });
        }

        if (base.mediterraneanOnly) {
            relaxations.push({
                label: 'Show all of Europe, not just seaside',
                count: countWith({ mediterraneanOnly: false }),
                apply: () => this.setCheckbox('mediterraneanOnly', false)
            });
        }
        if (base.seniorCategory) {
            relaxations.push({
                label: 'Include non-senior tournaments',
                count: countWith({ seniorCategory: false }),
                apply: () => this.setCheckbox('seniorCategory', false)
            });
        }
        if (base.seniorS60) {
            relaxations.push({
                label: 'Include S50+ as well as S60+',
                count: countWith({ seniorS60: false }),
                apply: () => this.setCheckbox('seniorS60', false)
            });
        }
        if (base.womenOnly) {
            relaxations.push({
                label: "Include all tournaments, not just women's",
                count: countWith({ womenOnly: false }),
                apply: () => this.setCheckbox('womenOnly', false)
            });
        }
        if (!base.openOnly) {
            relaxations.push({
                label: 'Re-enable Open Category Only',
                count: countWith({ openOnly: true }),
                apply: () => this.setCheckbox('openOnly', true)
            });
        }
        if (base.countryFilter.length > 0) {
            relaxations.push({
                label: `Clear the country filter (${base.countryFilter.length} selected)`,
                count: countWith({ countryFilter: [] }),
                apply: () => {
                    document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
                        .forEach(cb => { cb.checked = false; });
                    this.updateCountryFilterSummary();
                }
            });
        }
        if (base.ratingCategory) {
            relaxations.push({
                label: `Remove the ${base.ratingCategory} rating ceiling`,
                count: countWith({ ratingCategory: '' }),
                apply: () => this.setSelectValue('ratingCategory', '')
            });
        }
        if (base.youthCategory) {
            relaxations.push({
                label: `Remove the ${base.youthCategory} youth age filter`,
                count: countWith({ youthCategory: '' }),
                apply: () => this.setSelectValue('youthCategory', '')
            });
        }
        if (!base.classicalTime || !base.rapidTime || !base.blitzTime) {
            relaxations.push({
                label: 'Include all time controls',
                count: countWith({ classicalTime: true, rapidTime: true, blitzTime: true }),
                apply: () => {
                    this.setCheckbox('classicalTime', true);
                    this.setCheckbox('rapidTime', true);
                    this.setCheckbox('blitzTime', true);
                }
            });
        }
        if (base.minDays !== 0) {
            relaxations.push({
                label: 'Remove the minimum-duration filter',
                count: countWith({ minDays: 0 }),
                apply: () => this.setSelectValue('minDays', '0')
            });
        }
        if (base.endDate) {
            const extended = new Date(base.endDate);
            extended.setMonth(extended.getMonth() + 1);
            relaxations.push({
                label: 'Extend the date range by a month',
                count: countWith({ endDate: extended }),
                apply: () => {
                    const endDateEl = document.getElementById('endDate') as HTMLInputElement | null;
                    if (endDateEl) endDateEl.valueAsDate = extended;
                }
            });
        }

        return relaxations
            .filter(r => r.count > 0)
            .sort((a, b) => Number(b.lead ?? false) - Number(a.lead ?? false) || b.count - a.count)
            .slice(0, 4);
    }

    protected clearQuickSearch(): void {
        this.currentQuickSearch = '';
        const input = document.getElementById('quickSearch') as HTMLInputElement | null;
        if (input) input.value = '';
    }

    protected setShortlistOnly(on: boolean): void {
        this.showShortlistOnly = on;
        const toggle = document.getElementById('showShortlistOnly') as HTMLInputElement | null;
        if (toggle) toggle.checked = on;
    }

    /**
     * Delegated click handler for the empty state's one-tap relaxation
     * buttons - #tournamentList is a stable container across re-renders, so
     * this is wired once rather than re-attached every time the empty state
     * itself is rebuilt.
     */
    protected initEmptyStateRelaxationDelegation(): void {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList) return;

        tournamentList.addEventListener('click', (e) => {
            const btn = (e.target as Element).closest<HTMLButtonElement>('.empty-state-relaxation-btn');
            if (!btn) return;
            const index = Number(btn.dataset.relaxationIndex);
            const relaxation = this.lastEmptyStateRelaxations[index];
            if (!relaxation) return;
            relaxation.apply();
            this.handleFilterChange();
        });
    }
}
