export function groupByPlace(tournaments) {
    const byKey = new Map();
    let unplaced = 0;
    for (const t of tournaments) {
        if (typeof t.lat !== 'number' || typeof t.lng !== 'number') {
            unplaced++;
            continue;
        }
        const key = `${t.lat},${t.lng}`;
        const place = byKey.get(key);
        if (place)
            place.tournaments.push(t);
        else
            byKey.set(key, { lat: t.lat, lng: t.lng, tournaments: [t] });
    }
    return { places: Array.from(byKey.values()), unplaced };
}
export function placeKind(place) {
    const tags = place.tournaments.flatMap(t => t.travelTags ?? []);
    if (tags.includes('Mediterranean') || tags.includes('Seaside'))
        return 'sea';
    if (tags.includes('Senior-friendly'))
        return 'senior';
    return 'plain';
}
export function isBeachfront(place) {
    return place.tournaments.some(t => t.seaM !== undefined);
}
//# sourceMappingURL=mapPlaces.js.map