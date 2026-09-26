/**
 * TournamentFinder, part: FilterPreferencesPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { FilterState } from '../types';
import { filterStateToSearchParams, filterStateFromSearchParams, FILTER_PARAM_KEYS } from '../utils/filterUrl';
import { DataFreshnessPart } from './DataFreshnessPart';
import { setCountryChecked } from '../utils/countrySelection';
import { setCheckedSeas } from '../utils/seaPicker';

/** Saved filter preferences and the filter state in the URL. */
export abstract class FilterPreferencesPart extends DataFreshnessPart {
    /**
     * Load saved filter preferences: a URL carrying filter params (a shared
     * link) takes priority over the localStorage prefs from a previous visit,
     * since a shared link is an explicit request for that exact view.
     */
    protected loadFilterPreferences(): void {
        const fromUrl = filterStateFromSearchParams(new URLSearchParams(location.search));
        if (fromUrl) {
            this.applyFilterPreferences(fromUrl);
            return;
        }

        const preferences = this.cacheManager.loadPreference<Partial<FilterState>>(
            this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES
        );

        if (!preferences) return;
        this.applyFilterPreferences(preferences);
    }

    /**
     * Apply a partial filter state (from localStorage or the URL) to the
     * actual filter DOM elements, which are what getFilterState() reads back.
     */
    protected applyFilterPreferences(preferences: Partial<FilterState>): void {
        const filterElements = this.getFilterElements();

        if (preferences.openOnly !== undefined && filterElements.openOnly) {
            filterElements.openOnly.checked = preferences.openOnly;
        }
        if (preferences.excludeYouth !== undefined && filterElements.excludeYouth) {
            filterElements.excludeYouth.checked = preferences.excludeYouth;
        }
        if (Array.isArray(preferences.seas) && preferences.seas.length > 0) setCheckedSeas(preferences.seas);
        if (preferences.mediterraneanOnly !== undefined && filterElements.mediterraneanOnly) {
            filterElements.mediterraneanOnly.checked = preferences.mediterraneanOnly;
        }
        if (preferences.seniorCategory !== undefined && filterElements.seniorCategory) {
            filterElements.seniorCategory.checked = preferences.seniorCategory;
        }
        if (preferences.womenOnly !== undefined && filterElements.womenOnly) {
            filterElements.womenOnly.checked = preferences.womenOnly;
        }
        if (preferences.includeLongEvents !== undefined && filterElements.includeLongEvents) {
            filterElements.includeLongEvents.checked = preferences.includeLongEvents;
        }
        if (preferences.includeTeamTournaments !== undefined && filterElements.includeTeamTournaments) {
            filterElements.includeTeamTournaments.checked = preferences.includeTeamTournaments;
        }
        if (preferences.classicalTime !== undefined && filterElements.classicalTime) {
            filterElements.classicalTime.checked = preferences.classicalTime;
        }
        if (preferences.rapidTime !== undefined && filterElements.rapidTime) {
            filterElements.rapidTime.checked = preferences.rapidTime;
        }
        if (preferences.blitzTime !== undefined && filterElements.blitzTime) {
            filterElements.blitzTime.checked = preferences.blitzTime;
        }
        if (Array.isArray(preferences.countryFilter) && preferences.countryFilter.length > 0) {
            preferences.countryFilter.forEach((code: string) => setCountryChecked(code, true));
            this.updateCountryFilterSummary();
        }
        if (preferences.minDays !== undefined && filterElements.minDays) {
            filterElements.minDays.value = String(preferences.minDays);
        }
        if (preferences.seniorS60 !== undefined && filterElements.seniorS60) {
            filterElements.seniorS60.checked = preferences.seniorS60;
        }
        if (preferences.youthCategory !== undefined && filterElements.youthCategory) {
            filterElements.youthCategory.value = preferences.youthCategory;
        }
        if (preferences.ratingCategory !== undefined && filterElements.ratingCategory) {
            filterElements.ratingCategory.value = preferences.ratingCategory;
        }
    }

    /**
     * Mirror the current filter state into the URL (replacing history, not
     * pushing - every checkbox click shouldn't add a back-button stop) so the
     * current view can be shared or bookmarked. Preserves unrelated params
     * (like the ?t= deep link) untouched.
     */
    protected syncFilterStateToURL(): void {
        const filterParams = filterStateToSearchParams(this.getFilterState());

        const url = new URL(location.href);
        FILTER_PARAM_KEYS.forEach(key => url.searchParams.delete(key));
        filterParams.forEach((value, key) => url.searchParams.set(key, value));

        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
}
