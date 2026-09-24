/**
 * Pure helpers behind the map view (src/services/MapView.ts), kept free of
 * Leaflet so they can be unit-tested without a browser.
 */

import { Tournament } from '../types';

/** Tournaments that share one map position (same geocoded town/venue). */
export interface Place {
    lat: number;
    lng: number;
    tournaments: Tournament[];
}

/**
 * Group tournaments by coordinates. Many share a town, and identical points
 * can't be told apart by clustering alone, so each position becomes a single
 * marker listing all of its tournaments. Tournaments without coordinates
 * (location couldn't be geocoded) are counted separately.
 */
export function groupByPlace(tournaments: Tournament[]): { places: Place[]; unplaced: number } {
    const byKey = new Map<string, Place>();
    let unplaced = 0;
    for (const t of tournaments) {
        if (typeof t.lat !== 'number' || typeof t.lng !== 'number') {
            unplaced++;
            continue;
        }
        const key = `${t.lat},${t.lng}`;
        const place = byKey.get(key);
        if (place) place.tournaments.push(t);
        else byKey.set(key, { lat: t.lat, lng: t.lng, tournaments: [t] });
    }
    return { places: Array.from(byKey.values()), unplaced };
}

/** Marker colour class: seaside beats senior, as on the cards. */
export function placeKind(place: Place): 'sea' | 'senior' | 'plain' {
    const tags = place.tournaments.flatMap(t => t.travelTags ?? []);
    if (tags.includes('Mediterranean') || tags.includes('Seaside')) return 'sea';
    if (tags.includes('Senior-friendly')) return 'senior';
    return 'plain';
}

/** A place is beachfront when any of its tournaments' venues is <= 500 m from the sea. */
export function isBeachfront(place: Place): boolean {
    return place.tournaments.some(t => t.seaM !== undefined);
}
