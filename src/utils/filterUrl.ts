/**
 * FilterState <-> URLSearchParams, so a filtered view is a shareable link,
 * e.g. "Senior seaside weeks in October" -> ?med=1&senior=1&dur=7.
 *
 * Pure functions with no DOM/app dependency - app.ts's syncFilterStateToURL()
 * and loadFilterPreferences() call these and own the actual history/DOM work.
 */

import { FilterState } from '../types';
import { isDefaultSeas, parseSeas } from './seas';

export const FILTER_PARAM_KEYS = [
    'open', 'excludeYouth', 'med', 'senior', 'senior60', 'women',
    'team', 'long', 'tc', 'country', 'dur', 'youthAge', 'rating', 'sea'
] as const;

/**
 * Encode the parts of filter state worth sharing as a link into query
 * params. Only non-default values are written, so the common case (no
 * filters narrowed) keeps a clean URL. Date range is deliberately left out -
 * the default window shifts with "today" on every visit, so there's no
 * stable "default" to diff against, and the deep-link ?t= param already
 * covers sharing a single tournament.
 */
export function filterStateToSearchParams(state: FilterState): URLSearchParams {
    const params = new URLSearchParams();

    if (!state.openOnly) params.set('open', '0');
    if (!state.excludeYouth) params.set('excludeYouth', '0');
    if (state.mediterraneanOnly) params.set('med', '1');
    if (state.mediterraneanOnly && state.seas && !isDefaultSeas(state.seas)) params.set('sea', state.seas.join(','));
    if (state.seniorCategory) params.set('senior', '1');
    if (state.seniorS60) params.set('senior60', '1');
    if (state.womenOnly) params.set('women', '1');
    if (state.includeTeamTournaments) params.set('team', '1');
    if (state.includeLongEvents) params.set('long', '1');

    const tcEnabled = [
        state.classicalTime && 'classical',
        state.rapidTime && 'rapid',
        state.blitzTime && 'blitz',
    ].filter((v): v is string => Boolean(v));
    if (tcEnabled.length !== 3) params.set('tc', tcEnabled.join(','));

    if (state.countryFilter.length > 0) params.set('country', state.countryFilter.join(','));
    if (state.minDays !== 0) params.set('dur', String(state.minDays));
    if (state.youthCategory) params.set('youthAge', state.youthCategory);
    if (state.ratingCategory) params.set('rating', state.ratingCategory);

    return params;
}

/** Inverse of filterStateToSearchParams(). Returns null when the URL carries no filter params at all. */
export function filterStateFromSearchParams(params: URLSearchParams): Partial<FilterState> | null {
    if (!FILTER_PARAM_KEYS.some(key => params.has(key))) return null;

    const preferences: Partial<FilterState> = {};

    if (params.has('open')) preferences.openOnly = params.get('open') !== '0';
    if (params.has('excludeYouth')) preferences.excludeYouth = params.get('excludeYouth') !== '0';
    if (params.has('med')) preferences.mediterraneanOnly = params.get('med') === '1';
    if (params.has('sea')) {
        const seas = parseSeas(params.get('sea')!);
        if (seas.length > 0) preferences.seas = seas;
    }
    if (params.has('senior')) preferences.seniorCategory = params.get('senior') === '1';
    if (params.has('senior60')) preferences.seniorS60 = params.get('senior60') === '1';
    if (params.has('women')) preferences.womenOnly = params.get('women') === '1';
    if (params.has('team')) preferences.includeTeamTournaments = params.get('team') === '1';
    if (params.has('long')) preferences.includeLongEvents = params.get('long') === '1';

    if (params.has('tc')) {
        const enabled = new Set(params.get('tc')!.split(',').filter(Boolean));
        preferences.classicalTime = enabled.has('classical');
        preferences.rapidTime = enabled.has('rapid');
        preferences.blitzTime = enabled.has('blitz');
    }

    if (params.has('country')) {
        preferences.countryFilter = params.get('country')!.split(',').filter(Boolean);
    }

    if (params.has('dur')) {
        const raw = params.get('dur')!;
        preferences.minDays = (raw === 'weekend' || raw === 'just-weekend') ? raw : Number(raw);
    }

    if (params.has('youthAge')) preferences.youthCategory = params.get('youthAge')!;
    if (params.has('rating')) preferences.ratingCategory = params.get('rating')!;

    return preferences;
}
