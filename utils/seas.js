export const SEAS = ['med', 'atlantic', 'black', 'caspian'];
export const DEFAULT_SEAS = ['med', 'atlantic'];
export const SEA_LABELS = {
    med: 'Mediterranean',
    atlantic: 'Atlantic',
    black: 'Black Sea',
    caspian: 'Caspian',
};
export function isSea(value) {
    return SEAS.includes(value);
}
export function parseSeas(text) {
    return SEAS.filter(sea => text.split(',').includes(sea));
}
export function isDefaultSeas(seas) {
    return seas.length === DEFAULT_SEAS.length && DEFAULT_SEAS.every(sea => seas.includes(sea));
}
export function isMediterraneanLocation(location, mediterraneanLocations) {
    const loc = location.toLowerCase();
    for (const place of mediterraneanLocations) {
        if (place.length <= 5) {
            const re = new RegExp(`(?:^|\\P{L})${place}(?:\\P{L}|$)`, 'u');
            if (re.test(loc))
                return true;
        }
        else if (loc.includes(place)) {
            return true;
        }
    }
    return false;
}
export function seaOf(tournament, mediterraneanLocations) {
    if (typeof tournament.lat === 'number' && typeof tournament.lng === 'number') {
        return tournament.coast ?? null;
    }
    const withoutBrackets = tournament.location.replace(/\([^)]*\)/g, ' ');
    return isMediterraneanLocation(withoutBrackets, mediterraneanLocations) ? 'med' : null;
}
export function isSeaside(tournament, mediterraneanLocations, seas = SEAS) {
    const sea = seaOf(tournament, mediterraneanLocations);
    return sea !== null && seas.includes(sea);
}
//# sourceMappingURL=seas.js.map