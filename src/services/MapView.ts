import type * as Leaflet from 'leaflet';
import { Tournament } from '../types';
import { escapeHTML } from '../utils/html';
import { formatLocation } from '../utils/countries';
import { Logger } from '../utils/Logger';
import { groupByPlace, placeKind, isBeachfront, Place } from '../utils/mapPlaces';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
    ' · places: <a href="https://nominatim.org">Nominatim</a>, <a href="https://www.geonames.org">GeoNames</a>';
const EUROPE_CENTER: [number, number] = [48, 12];
const POPUP_LIST_LIMIT = 6;

/**
 * List/Map toggle's map. Leaflet (plus its cluster plugin and CSS) is
 * loaded with a dynamic import on first show, so the main bundle doesn't
 * grow for visitors who never open the map. Tiles are OpenStreetMap's
 * standard raster tiles (free, attribution required); coordinates come
 * precomputed in tournaments_data.json (geocode_tournaments.py), so the
 * browser never calls a geocoding service.
 */
export class MapView {
    private readonly logger = Logger.createScoped('MapView');
    private L: typeof Leaflet | null = null;
    private map: Leaflet.Map | null = null;
    private cluster: Leaflet.MarkerClusterGroup | null = null;
    private loading: Promise<void> | null = null;

    constructor(
        private readonly container: HTMLElement,
        private readonly note: HTMLElement | null,
        private readonly onShowInList: (url: string) => void
    ) {}

    /** Load Leaflet on first use. Safe to call repeatedly. */
    private ensureLoaded(): Promise<void> {
        this.loading ??= (async (): Promise<void> => {
            const leaflet = await import('leaflet');
            const L = leaflet.default ?? leaflet;
            // leaflet.markercluster is a UMD plugin that extends the global L.
            (window as unknown as { L: typeof Leaflet }).L = L;
            await Promise.all([
                import('leaflet.markercluster'),
                import('leaflet/dist/leaflet.css'),
                import('leaflet.markercluster/dist/MarkerCluster.css'),
            ]);
            this.L = L;

            this.map = L.map(this.container, { center: EUROPE_CENTER, zoom: 4, worldCopyJump: true });
            L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(this.map);
            this.cluster = L.markerClusterGroup({
                showCoverageOnHover: false,
                maxClusterRadius: 45,
                iconCreateFunction: (c): Leaflet.DivIcon => {
                    const count = c.getAllChildMarkers()
                        .reduce((n, m) => n + ((m.options as { count?: number }).count ?? 1), 0);
                    return L.divIcon({
                        html: `<span>${count}</span>`,
                        className: 'map-cluster',
                        iconSize: L.point(36, 36),
                    });
                },
            });
            this.map.addLayer(this.cluster);

            // Popup "Show in list" buttons (popups are rendered fresh each time)
            this.container.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.map-show-in-list');
                if (btn?.dataset.url) this.onShowInList(btn.dataset.url);
            });
        })().catch((error: unknown) => {
            this.loading = null; // allow a retry
            this.logger.error('Failed to load map', error);
            throw error;
        });
        return this.loading;
    }

    /** Show the map for these tournaments (all pages of the filtered list). */
    async show(tournaments: Tournament[]): Promise<void> {
        await this.ensureLoaded();
        // The container was display:none until now (and the layout may have
        // changed meanwhile, e.g. a phone rotated) - re-measure before
        // fitting the markers, or fitBounds uses the stale size.
        this.map?.invalidateSize();
        this.render(tournaments, true);
    }

    /** Re-render after a filter change, keeping the user's current view. */
    update(tournaments: Tournament[]): void {
        if (this.map) this.render(tournaments, false);
    }

    private render(tournaments: Tournament[], fit: boolean): void {
        const L = this.L;
        if (!L || !this.map || !this.cluster) return;

        const { places, unplaced } = groupByPlace(tournaments);
        this.cluster.clearLayers();

        const markers = places.map(place => {
            const count = place.tournaments.length;
            const name = place.tournaments[0]!.location;
            const marker = L.marker([place.lat, place.lng], {
                icon: L.divIcon({
                    html: count > 1 ? `<span>${count}</span>` : '',
                    className: `map-pin map-pin--${placeKind(place)}${count > 1 ? ' map-pin--multi' : ''}${isBeachfront(place) ? ' map-pin--beach' : ''}`,
                    iconSize: count > 1 ? L.point(28, 28) : L.point(16, 16),
                }),
                title: count > 1 ? `${count} tournaments: ${name}` : `${place.tournaments[0]!.name}, ${name}`,
                keyboard: true,
                count,
            } as Leaflet.MarkerOptions & { count: number });
            marker.bindPopup(() => this.popupHTML(place), { maxWidth: 300 });
            return marker;
        });
        this.cluster.addLayers(markers);

        if (fit && places.length > 0) {
            const bounds = L.latLngBounds(places.map(p => [p.lat, p.lng] as [number, number]));
            this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 8 });
        }

        if (this.note) {
            this.note.textContent = unplaced > 0
                ? `${unplaced} of ${tournaments.length} tournament${tournaments.length === 1 ? '' : 's'} couldn't be placed on the map (no recognisable town in the location) - they're still in the list.`
                : '';
            this.note.hidden = unplaced === 0;
        }
    }

    private popupHTML(place: Place): string {
        const shown = place.tournaments.slice(0, POPUP_LIST_LIMIT);
        const more = place.tournaments.length - shown.length;
        const items = shown.map(t => {
            const date = t.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            return `
                <li>
                    <a href="${escapeHTML(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(t.name)}</a>
                    <span class="map-popup-date">${escapeHTML(date)}${t.seaM !== undefined ? ` · 🏖 ${t.seaM} m from the sea` : ''}</span>
                    <button type="button" class="map-show-in-list" data-url="${escapeHTML(t.url)}">Show in list</button>
                </li>`;
        }).join('');
        return `
            <div class="map-popup">
                <div class="map-popup-place">${formatLocation(place.tournaments[0]!.location)}</div>
                <ul>${items}</ul>
                ${more > 0 ? `<p class="map-popup-more">+${more} more here - see the list</p>` : ''}
            </div>`;
    }
}
