import { filterStateToSearchParams, filterStateFromSearchParams, FILTER_PARAM_KEYS } from '../utils/filterUrl';
import { DataFreshnessPart } from './DataFreshnessPart';
import { setCountryChecked } from '../utils/countrySelection';
import { setCheckedSeas } from '../utils/seaPicker';
export class FilterPreferencesPart extends DataFreshnessPart {
    loadFilterPreferences() {
        const fromUrl = filterStateFromSearchParams(new URLSearchParams(location.search));
        if (fromUrl) {
            this.applyFilterPreferences(fromUrl);
            return;
        }
        const preferences = this.cacheManager.loadPreference(this.cacheManager.CACHE_KEYS.FILTER_PREFERENCES);
        if (!preferences)
            return;
        this.applyFilterPreferences(preferences);
    }
    applyFilterPreferences(preferences) {
        const filterElements = this.getFilterElements();
        if (preferences.openOnly !== undefined && filterElements.openOnly) {
            filterElements.openOnly.checked = preferences.openOnly;
        }
        if (preferences.excludeYouth !== undefined && filterElements.excludeYouth) {
            filterElements.excludeYouth.checked = preferences.excludeYouth;
        }
        if (Array.isArray(preferences.seas) && preferences.seas.length > 0)
            setCheckedSeas(preferences.seas);
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
            preferences.countryFilter.forEach((code) => setCountryChecked(code, true));
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
    syncFilterStateToURL() {
        const filterParams = filterStateToSearchParams(this.getFilterState());
        const url = new URL(location.href);
        FILTER_PARAM_KEYS.forEach(key => url.searchParams.delete(key));
        filterParams.forEach((value, key) => url.searchParams.set(key, value));
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
}
//# sourceMappingURL=FilterPreferencesPart.js.map