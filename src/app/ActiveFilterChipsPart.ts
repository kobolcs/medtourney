/**
 * TournamentFinder, part: ActiveFilterChipsPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { FilterState } from '../types';
import { escapeHTML } from '../utils/html';
import { FilterPreferencesPart } from './FilterPreferencesPart';

/** Active-filter chips and the "More filters" count. */
export abstract class ActiveFilterChipsPart extends FilterPreferencesPart {
    protected minDaysChipLabel(minDays: FilterState['minDays']): string {
        switch (minDays) {
            case 'just-weekend': return 'Weekend only';
            case 'weekend': return 'Long weekend';
            case 5: return '5+ days';
            case 7: return '1+ week';
            case 14: return '2+ weeks';
            default: return `${minDays}+ days`;
        }
    }

    /** Build removable active-filter chip descriptors from the current filter state. */
    protected buildActiveFilterChips(): { label: string; clear: () => void }[] {
        const s = this.getFilterState();
        const chips: { label: string; clear: () => void }[] = [];

        if (s.mediterraneanOnly) chips.push({ label: '🌊 Seaside', clear: () => this.setCheckbox('mediterraneanOnly', false) });
        if (s.seniorCategory) chips.push({ label: 'Senior 50+', clear: () => this.setCheckbox('seniorCategory', false) });
        if (s.seniorS60) chips.push({ label: 'Senior 60+', clear: () => this.setCheckbox('seniorS60', false) });
        if (s.womenOnly) chips.push({ label: "Women's", clear: () => this.setCheckbox('womenOnly', false) });
        if (s.includeTeamTournaments) chips.push({ label: 'Team tournaments', clear: () => this.setCheckbox('includeTeamTournaments', false) });
        if (!s.openOnly) chips.push({ label: 'Open category off', clear: () => this.setCheckbox('openOnly', true) });
        if (!s.excludeYouth) chips.push({ label: 'Youth-only included', clear: () => this.setCheckbox('excludeYouth', true) });

        const tcOff = [!s.classicalTime && 'Classical', !s.rapidTime && 'Rapid', !s.blitzTime && 'Blitz']
            .filter((v): v is string => Boolean(v));
        if (tcOff.length > 0) {
            chips.push({
                label: `${tcOff.join('/')} off`,
                clear: () => {
                    this.setCheckbox('classicalTime', true);
                    this.setCheckbox('rapidTime', true);
                    this.setCheckbox('blitzTime', true);
                }
            });
        }

        if (s.countryFilter.length > 0) {
            const count = s.countryFilter.length;
            chips.push({
                label: `${count} ${count === 1 ? 'country' : 'countries'}`,
                clear: () => {
                    document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
                        .forEach(cb => { cb.checked = false; });
                    this.updateCountryFilterSummary();
                }
            });
        }

        if (s.minDays !== 0) {
            chips.push({ label: this.minDaysChipLabel(s.minDays), clear: () => this.setSelectValue('minDays', '0') });
        }
        if (s.youthCategory) chips.push({ label: s.youthCategory, clear: () => this.setSelectValue('youthCategory', '') });
        if (s.ratingCategory) chips.push({ label: s.ratingCategory, clear: () => this.setSelectValue('ratingCategory', '') });

        return chips;
    }

    /** Render (or hide) the active-filter chip row above the results, wiring each chip's one-tap removal. */
    protected renderActiveFilterChips(): void {
        const container = document.getElementById('activeFilterChips');
        if (!container) return;

        const chips = this.buildActiveFilterChips();
        this.filterSheet?.setCount(chips.length);
        if (chips.length === 0) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = chips.map((chip, i) => `
            <button type="button" class="active-filter-chip" data-chip-index="${i}">
                ${escapeHTML(chip.label)}
                <span aria-hidden="true">&times;</span>
                <span class="sr-only">Remove filter: ${escapeHTML(chip.label)}</span>
            </button>
        `).join('') + '<button type="button" class="active-filter-clear-all">Clear all</button>';

        container.querySelectorAll<HTMLButtonElement>('.active-filter-chip').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                chips[i]!.clear();
                this.handleFilterChange();
            });
        });
        container.querySelector('.active-filter-clear-all')?.addEventListener('click', () => this.resetFilters());
    }

    /**
     * Count the "More filters" drawer controls that differ from their
     * defaults, show it in the summary badge, and auto-open the drawer when
     * the count is > 0 so an active advanced filter never narrows the
     * results invisibly behind a collapsed disclosure.
     */
    protected updateAdvancedFilterCount(): void {
        const el = this.getFilterElements();
        let count = 0;

        // openOnly and excludeYouth ship checked, so "active" means unchecked.
        if (el.openOnly && !el.openOnly.checked) count++;
        if (el.excludeYouth && !el.excludeYouth.checked) count++;
        if (el.womenOnly?.checked) count++;
        if (el.includeTeamTournaments?.checked) count++;
        if (el.seniorCategory?.checked) count++;
        if (el.seniorS60?.checked) count++;
        if (el.ratingCategory?.value) count++;
        if (el.youthCategory?.value) count++;
        if (el.minDays && el.minDays.value !== '0') count++;
        if (document.querySelectorAll('input[name="countryFilter"]:checked').length > 0) count++;

        const badge = document.getElementById('advancedFilterCount');
        if (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
        }

        const details = document.getElementById('advancedFilters') as HTMLDetailsElement | null;
        if (details && count > 0) {
            details.open = true;
        }
    }

    protected activeFilterSummary(): string {
        const s = this.getFilterState();
        const parts: string[] = [];
        if (s.mediterraneanOnly) parts.push('mediterranean');
        if (s.seniorCategory) parts.push('senior50');
        if (s.seniorS60) parts.push('senior60');
        if (s.womenOnly) parts.push('women');
        if (s.youthCategory) parts.push(`youth_${s.youthCategory}`);
        if (s.countryFilter.length > 0) parts.push(`country_${s.countryFilter.join('+')}`);
        if (s.minDays !== 0) parts.push(`duration_${String(s.minDays)}`);
        return parts.join(',') || 'none';
    }
}
