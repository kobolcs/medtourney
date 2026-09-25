/**
 * Seas and the Seaside rule.
 *
 * geocode_tournaments.py tags a tournament within 10 km of the coast with the
 * sea it is by (`coast`). The Seaside mode shows tournaments by the seas
 * ticked in the sea picker - by default the Mediterranean and the Atlantic
 * (Spain, Portugal, France), which is what Seaside meant before the Black Sea
 * and the Caspian were added.
 */
import type { Sea, Tournament } from '../types';

export const SEAS: readonly Sea[] = ['med', 'atlantic', 'black', 'caspian'];
export const DEFAULT_SEAS: readonly Sea[] = ['med', 'atlantic'];

/** Card badge / picker label for each sea */
export const SEA_LABELS: Readonly<Record<Sea, string>> = {
    med: 'Mediterranean',
    atlantic: 'Atlantic',
    black: 'Black Sea',
    caspian: 'Caspian',
};

export function isSea(value: string): value is Sea {
    return (SEAS as readonly string[]).includes(value);
}

/** "med,black" (URL / saved preference) -> ['med', 'black']; unknown names dropped */
export function parseSeas(text: string): Sea[] {
    return SEAS.filter(sea => text.split(',').includes(sea));
}

export function isDefaultSeas(seas: readonly Sea[]): boolean {
    return seas.length === DEFAULT_SEAS.length && DEFAULT_SEAS.every(sea => seas.includes(sea));
}

/**
 * Does a location text name one of the listed Mediterranean towns?
 * Short names (<= 5 chars) need non-letter boundaries: "nice" is not in
 * "Tržnice" (ž is a letter), "bar" not in "Lubartow", "rome" not in "Promenada".
 */
export function isMediterraneanLocation(location: string, mediterraneanLocations: Set<string>): boolean {
    const loc = location.toLowerCase();
    for (const place of mediterraneanLocations) {
        if (place.length <= 5) {
            const re = new RegExp(`(?:^|\\P{L})${place}(?:\\P{L}|$)`, 'u');
            if (re.test(loc)) return true;
        } else if (loc.includes(place)) {
            return true;
        }
    }
    return false;
}

/**
 * The sea a tournament is by, or null. A placed tournament (lat/lng) is by
 * the sea only if its coordinates are (`coast`) - the town list must not
 * override that ("Tivoli (Rome)" is inland, "Chillout Bar" isn't Bar in
 * Montenegro). The town list (all Mediterranean) only helps tournaments that
 * couldn't be placed, and never via text in brackets.
 */
export function seaOf(tournament: Tournament, mediterraneanLocations: Set<string>): Sea | null {
    if (typeof tournament.lat === 'number' && typeof tournament.lng === 'number') {
        return tournament.coast ?? null;
    }
    const withoutBrackets = tournament.location.replace(/\([^)]*\)/g, ' ');
    return isMediterraneanLocation(withoutBrackets, mediterraneanLocations) ? 'med' : null;
}

/** By one of the given seas (all four when not given). */
export function isSeaside(
    tournament: Tournament,
    mediterraneanLocations: Set<string>,
    seas: readonly Sea[] = SEAS
): boolean {
    const sea = seaOf(tournament, mediterraneanLocations);
    return sea !== null && seas.includes(sea);
}
