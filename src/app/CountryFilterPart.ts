/**
 * TournamentFinder, part: CountryFilterPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { ActiveFilterChipsPart } from './ActiveFilterChipsPart';

/** Country checklist: available countries, search, region ticks, compatibility with Seaside. */
export abstract class CountryFilterPart extends ActiveFilterChipsPart {
    /**
     * After a search, grey out / re-enable country checkboxes based on whether
     * any tournaments pass all current filters when that country is the only
     * country filter active.  Countries with zero results become visually muted
     * and their checkboxes are disabled so users cannot pick dead-end combos.
     *
     * Unchecked-but-disabled countries are shown so users can see what exists;
     * already-checked countries are never disabled (the user may want to widen).
     */
    protected updateAvailableCountries(): void {
        if (this.allTournaments.length === 0) return;

        // Filter with no country restriction to get the "available" pool
        const stateNoCountry = { ...this.getFilterState(), countryFilter: [] };
        const pool = this.filterService.filterTournaments(
            this.allTournaments,
            stateNoCountry,
            this.mediterraneanLocations
        );

        // Build set of country codes that appear in the pool
        const available = new Set<string>();
        for (const t of pool) {
            const parts = t.location.split(',');
            const last = parts[parts.length - 1];
            if (last) available.add(last.trim().toUpperCase());
        }

        // Record availability as a data flag rather than setting style.display
        // directly - applyCountrySearchFilter() is the single place that turns
        // this (plus the type-to-filter query) into final visibility, so the
        // two mechanisms narrow together instead of one clobbering the other.
        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code) return;
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (!cb) return;
            // Always keep checked countries available, even with 0 results
            // under the current filters - unchecking is the user's call.
            const unavailable = !cb.checked && !available.has(code);
            item.dataset.unavailable = unavailable ? 'true' : 'false';
        });

        this.applyCountrySearchFilter();
    }

    /**
     * Final country-checkbox visibility: hidden if updateAvailableCountries()
     * flagged it unavailable, OR it doesn't match the type-to-filter query.
     * Called after updateAvailableCountries() (filters changed) and directly
     * from the search input's own listener (only the query changed).
     */
    protected applyCountrySearchFilter(): void {
        const query = this.countrySearchQuery.trim().toLowerCase();
        let anyVisible = false;

        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const unavailable = item.dataset.unavailable === 'true';
            const label = item.textContent?.toLowerCase() ?? '';
            const matchesQuery = !query || label.includes(query);
            const visible = !unavailable && matchesQuery;
            item.style.display = visible ? '' : 'none';
            if (visible) anyVisible = true;
        });

        this.syncCountryGroupToggles();

        // Hide a region heading when every country under it is hidden.
        document.querySelectorAll<HTMLElement>('.country-group-label').forEach(label => {
            const grid = label.nextElementSibling;
            const hasVisible = !!grid && Array.from(grid.querySelectorAll<HTMLElement>('.country-item'))
                .some(item => item.style.display !== 'none');
            label.style.display = hasVisible ? '' : 'none';
        });

        // Every other filter can already narrow results to zero on its own
        // (an empty results list explains itself below); an empty country
        // checklist with no message of its own just looks broken.
        const countryList = document.getElementById('countryList');
        const noCountriesMessage = document.getElementById('noCountriesMessage');
        if (countryList) countryList.style.display = anyVisible ? '' : 'none';
        if (noCountriesMessage) {
            noCountriesMessage.hidden = anyVisible;
            noCountriesMessage.textContent = query
                ? `No countries match "${this.countrySearchQuery.trim()}".`
                : 'No countries match your other filters.';
        }
    }

    /**
     * Compute which country codes (from the dropdown) have at least one
     * Mediterranean tournament in the current dataset.
     */
    protected computeMediterraneanCountries(): Set<string> {
        const result = new Set<string>();
        for (const t of this.allTournaments) {
            if (this.filterService.isSeaside(t, this.mediterraneanLocations)) {
                const parts = t.location.split(',');
                const last = parts[parts.length - 1];
                const code = last ? last.trim().toUpperCase() : '';
                if (code) result.add(code);
            }
        }
        return result;
    }

    /**
     * Keep the country dropdown and the Mediterranean checkbox in sync so the
     * user cannot select a combination that will always return 0 results:
     *
     * - Country selected with no Med tournaments → disable Mediterranean checkbox.
     * - Mediterranean checked → disable country options that have no Med tournaments.
     */
    protected updateFilterCompatibility(): void {
        this.updateCountryFilterSummary();
        if (this.allTournaments.length === 0) return;

        const medCheckbox = document.getElementById('mediterraneanOnly') as HTMLInputElement | null;
        if (!medCheckbox) return;

        const medChecked = medCheckbox.checked;

        // --- Direction 1: Med checked → remove countries with no Med tournaments ---
        document.querySelectorAll<HTMLElement>('.country-item').forEach(item => {
            const code = item.dataset.country?.toUpperCase();
            if (!code) return;
            const hasMed = this.mediterraneanCountries.has(code);
            if (medChecked && !hasMed) {
                item.style.display = 'none';
                const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
                if (cb?.checked) cb.checked = false;
            } else {
                item.style.display = '';
            }
        });

        // --- Direction 2: country selection → Mediterranean ---
        const selectedCodes = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
        ).map(cb => cb.value.toUpperCase());

        // Med is compatible when no countries are selected, or at least one has Med tournaments
        const medCompatible = selectedCodes.length === 0 ||
            selectedCodes.some(code => this.mediterraneanCountries.has(code));

        medCheckbox.disabled = !medCompatible;
        if (!medCompatible && medChecked) medCheckbox.checked = false;

        // The checkbox itself is hidden - the mode switch's Seaside/Both
        // buttons are its visible control, so they carry the disabled state.
        document.querySelectorAll<HTMLButtonElement>(
            '.mode-switch-btn[data-mode="seaside"], .mode-switch-btn[data-mode="both"]'
        ).forEach(btn => {
            btn.disabled = !medCompatible;
            btn.title = medCompatible ? '' : 'No Mediterranean tournaments in the selected countries';
        });

        // --- Youth / Senior mutual exclusion ---
        const elements = this.getFilterElements();
        const youthSelect = elements.youthCategory;
        const youthSelected = (youthSelect?.value ?? '') !== '';

        // Youth selector: disable when exclude-youth or any senior filter is active
        if (youthSelect) {
            const excludeYouth = elements.excludeYouth?.checked ?? false;
            const isSenior = (elements.seniorCategory?.checked ?? false) || (elements.seniorS60?.checked ?? false);
            const shouldDisable = excludeYouth || isSenior;
            youthSelect.disabled = shouldDisable;
            const youthGroup = youthSelect.closest('.filter-group') as HTMLElement | null;
            if (youthGroup) youthGroup.style.opacity = shouldDisable ? '0.4' : '';
            if (shouldDisable && youthSelect.value !== '') {
                youthSelect.value = '';
            }
        }

        // Senior checkboxes: disable when a youth age group is selected
        const seniorFields = [elements.seniorCategory, elements.seniorS60];
        for (const cb of seniorFields) {
            if (!cb) continue;
            cb.disabled = youthSelected;
            const grp = cb.closest('label') as HTMLElement | null;
            if (grp) grp.style.opacity = youthSelected ? '0.4' : '';
            if (youthSelected && cb.checked) cb.checked = false;
        }
    }

    /** Visible country checkboxes in the region grid that follows a group label. */
    protected countryGroupCheckboxes(toggle: HTMLInputElement): HTMLInputElement[] {
        const grid = toggle.closest('.country-group-label')?.nextElementSibling;
        if (!grid) return [];
        return Array.from(grid.querySelectorAll<HTMLElement>('.country-item'))
            .filter(item => item.style.display !== 'none')
            .map(item => item.querySelector<HTMLInputElement>('input[name="countryFilter"]'))
            .filter((cb): cb is HTMLInputElement => cb !== null);
    }

    /**
     * A region's "select all" tick: (un)check every country currently shown
     * in that region. Countries hidden by the type-to-filter box or by having
     * no results under the other filters are left alone.
     */
    protected applyCountryGroupToggle(toggle: HTMLInputElement): void {
        this.countryGroupCheckboxes(toggle).forEach(cb => { cb.checked = toggle.checked; });
        this.updateCountryFilterSummary();
        this.trackEvent('Country Group Toggle', { checked: toggle.checked });
    }

    /** Reflect each region's shown countries in its tick: all, none, or some (indeterminate). */
    protected syncCountryGroupToggles(): void {
        document.querySelectorAll<HTMLInputElement>('.country-group-toggle').forEach(toggle => {
            const boxes = this.countryGroupCheckboxes(toggle);
            const checkedCount = boxes.filter(cb => cb.checked).length;
            toggle.checked = boxes.length > 0 && checkedCount === boxes.length;
            toggle.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
        });
    }

    protected updateCountryFilterSummary(): void {
        const summary = document.getElementById('countryFilterSummary');
        const clearBtn = document.getElementById('clearCountriesBtn') as HTMLButtonElement | null;
        if (!summary) return;
        const checked = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="countryFilter"]:checked')
        );
        if (checked.length === 0) {
            summary.textContent = 'All';
            if (clearBtn) clearBtn.hidden = true;
        } else if (checked.length <= 2) {
            summary.textContent = checked.map(cb => cb.value).join(', ');
            if (clearBtn) clearBtn.hidden = false;
        } else {
            summary.textContent = `${checked.length} countries`;
            if (clearBtn) clearBtn.hidden = false;
        }
    }
}
