import { ActiveFilterChipsPart } from './ActiveFilterChipsPart';
import { checkedCountryCodes, setCountryChecked, syncCountryCopies } from '../utils/countrySelection';
export class CountryFilterPart extends ActiveFilterChipsPart {
    updateAvailableCountries() {
        if (this.allTournaments.length === 0)
            return;
        const stateNoCountry = { ...this.getFilterState(), countryFilter: [] };
        const pool = this.filterService.filterTournaments(this.allTournaments, stateNoCountry, this.mediterraneanLocations);
        const available = new Set();
        for (const t of pool) {
            const parts = t.location.split(',');
            const last = parts[parts.length - 1];
            if (last)
                available.add(last.trim().toUpperCase());
        }
        document.querySelectorAll('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code)
                return;
            const cb = item.querySelector('input[type="checkbox"]');
            if (!cb)
                return;
            const unavailable = !cb.checked && !available.has(code);
            item.dataset.unavailable = unavailable ? 'true' : 'false';
        });
        this.applyCountrySearchFilter();
    }
    applyCountrySearchFilter() {
        const query = this.countrySearchQuery.trim().toLowerCase();
        let anyVisible = false;
        document.querySelectorAll('.country-item').forEach(item => {
            const unavailable = item.dataset.unavailable === 'true';
            const label = item.textContent?.toLowerCase() ?? '';
            const matchesQuery = !query || label.includes(query);
            const visible = !unavailable && matchesQuery;
            item.style.display = visible ? '' : 'none';
            if (visible)
                anyVisible = true;
        });
        this.syncCountryGroupToggles();
        document.querySelectorAll('.country-group-label').forEach(label => {
            const grid = label.nextElementSibling;
            const hasVisible = !!grid && Array.from(grid.querySelectorAll('.country-item'))
                .some(item => item.style.display !== 'none');
            label.style.display = hasVisible ? '' : 'none';
        });
        const countryList = document.getElementById('countryList');
        const noCountriesMessage = document.getElementById('noCountriesMessage');
        if (countryList)
            countryList.style.display = anyVisible ? '' : 'none';
        if (noCountriesMessage) {
            noCountriesMessage.hidden = anyVisible;
            noCountriesMessage.textContent = query
                ? `No countries match "${this.countrySearchQuery.trim()}".`
                : 'No countries match your other filters.';
        }
    }
    computeMediterraneanCountries() {
        const result = new Set();
        for (const t of this.allTournaments) {
            if (this.filterService.isSeaside(t, this.mediterraneanLocations, this.getFilterState().seas)) {
                const parts = t.location.split(',');
                const last = parts[parts.length - 1];
                const code = last ? last.trim().toUpperCase() : '';
                if (code)
                    result.add(code);
            }
        }
        return result;
    }
    updateFilterCompatibility() {
        this.updateCountryFilterSummary();
        if (this.allTournaments.length === 0)
            return;
        const medCheckbox = document.getElementById('mediterraneanOnly');
        if (!medCheckbox)
            return;
        const medChecked = medCheckbox.checked;
        document.querySelectorAll('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code)
                return;
            const hasMed = this.mediterraneanCountries.has(code);
            if (medChecked && !hasMed) {
                item.style.display = 'none';
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb?.checked)
                    cb.checked = false;
            }
            else {
                item.style.display = '';
            }
        });
        const selectedCodes = checkedCountryCodes().map(code => code.toUpperCase());
        const medCompatible = selectedCodes.length === 0 ||
            selectedCodes.some(code => this.mediterraneanCountries.has(code));
        medCheckbox.disabled = !medCompatible;
        if (!medCompatible && medChecked)
            medCheckbox.checked = false;
        document.querySelectorAll('.mode-switch-btn[data-mode="seaside"], .mode-switch-btn[data-mode="both"]').forEach(btn => {
            btn.disabled = !medCompatible;
            btn.title = medCompatible ? '' : 'No Mediterranean tournaments in the selected countries';
        });
        const elements = this.getFilterElements();
        const youthSelect = elements.youthCategory;
        const youthSelected = (youthSelect?.value ?? '') !== '';
        if (youthSelect) {
            const excludeYouth = elements.excludeYouth?.checked ?? false;
            const isSenior = (elements.seniorCategory?.checked ?? false) || (elements.seniorS60?.checked ?? false);
            const shouldDisable = excludeYouth || isSenior;
            youthSelect.disabled = shouldDisable;
            const youthGroup = youthSelect.closest('.filter-group');
            if (youthGroup)
                youthGroup.style.opacity = shouldDisable ? '0.4' : '';
            if (shouldDisable && youthSelect.value !== '') {
                youthSelect.value = '';
            }
        }
        const seniorFields = [elements.seniorCategory, elements.seniorS60];
        for (const cb of seniorFields) {
            if (!cb)
                continue;
            cb.disabled = youthSelected;
            const grp = cb.closest('label');
            if (grp)
                grp.style.opacity = youthSelected ? '0.4' : '';
            if (youthSelected && cb.checked)
                cb.checked = false;
        }
    }
    countryGroupCheckboxes(toggle) {
        const grid = toggle.closest('.country-group-label')?.nextElementSibling;
        if (!grid)
            return [];
        return Array.from(grid.querySelectorAll('.country-item'))
            .filter(item => item.style.display !== 'none')
            .map(item => item.querySelector('input[name="countryFilter"]'))
            .filter((cb) => cb !== null);
    }
    onCountryListChange(target) {
        if (target.classList.contains('country-group-toggle')) {
            this.applyCountryGroupToggle(target);
        }
        else if (target.name === 'countryFilter') {
            syncCountryCopies(target);
        }
    }
    applyCountryGroupToggle(toggle) {
        this.countryGroupCheckboxes(toggle).forEach(cb => setCountryChecked(cb.value, toggle.checked));
        this.updateCountryFilterSummary();
        this.trackEvent('Country Group Toggle', { checked: toggle.checked });
    }
    syncCountryGroupToggles() {
        document.querySelectorAll('.country-group-toggle').forEach(toggle => {
            const boxes = this.countryGroupCheckboxes(toggle);
            const checkedCount = boxes.filter(cb => cb.checked).length;
            toggle.checked = boxes.length > 0 && checkedCount === boxes.length;
            toggle.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
        });
    }
    updateCountryFilterSummary() {
        const summary = document.getElementById('countryFilterSummary');
        const clearBtn = document.getElementById('clearCountriesBtn');
        if (!summary)
            return;
        const codes = checkedCountryCodes();
        if (codes.length === 0) {
            summary.textContent = 'All';
            if (clearBtn)
                clearBtn.hidden = true;
        }
        else if (codes.length <= 2) {
            summary.textContent = codes.join(', ');
            if (clearBtn)
                clearBtn.hidden = false;
        }
        else {
            summary.textContent = `${codes.length} countries`;
            if (clearBtn)
                clearBtn.hidden = false;
        }
    }
}
//# sourceMappingURL=CountryFilterPart.js.map