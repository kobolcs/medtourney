import { CountryFilterPart } from './CountryFilterPart';
import { clearCountries } from '../utils/countrySelection';
export class EmptyStatePart extends CountryFilterPart {
    buildEmptyStateRelaxations() {
        const base = this.getFilterState();
        const filtered = (partial = {}) => this.filterService.filterTournaments(this.allTournaments, { ...base, ...partial }, this.mediterraneanLocations);
        const countWith = (partial) => this.narrowForDisplay(filtered(partial)).length;
        const relaxations = [];
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
                label: 'Re-enable "Open to all"',
                count: countWith({ openOnly: true }),
                apply: () => this.setCheckbox('openOnly', true)
            });
        }
        if (base.countryFilter.length > 0) {
            relaxations.push({
                label: `Clear the country filter (${base.countryFilter.length} selected)`,
                count: countWith({ countryFilter: [] }),
                apply: () => {
                    clearCountries();
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
                    const endDateEl = document.getElementById('endDate');
                    if (endDateEl)
                        endDateEl.valueAsDate = extended;
                }
            });
        }
        return relaxations
            .filter(r => r.count > 0)
            .sort((a, b) => Number(b.lead ?? false) - Number(a.lead ?? false) || b.count - a.count)
            .slice(0, 4);
    }
    clearQuickSearch() {
        this.currentQuickSearch = '';
        const input = document.getElementById('quickSearch');
        if (input)
            input.value = '';
    }
    setShortlistOnly(on) {
        this.showShortlistOnly = on;
        const toggle = document.getElementById('showShortlistOnly');
        if (toggle)
            toggle.checked = on;
    }
    initEmptyStateRelaxationDelegation() {
        const tournamentList = document.getElementById('tournamentList');
        if (!tournamentList)
            return;
        tournamentList.addEventListener('click', (e) => {
            const btn = e.target.closest('.empty-state-relaxation-btn');
            if (!btn)
                return;
            const index = Number(btn.dataset.relaxationIndex);
            const relaxation = this.lastEmptyStateRelaxations[index];
            if (!relaxation)
                return;
            relaxation.apply();
            this.handleFilterChange();
        });
    }
}
//# sourceMappingURL=EmptyStatePart.js.map