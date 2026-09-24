/**
 * FED code -> country name/flag helpers for tournament location display.
 *
 * Mirrors the 55 FED codes used by the country filter checkboxes in
 * index.html (see config.json's `countryCodes`), but is kept as a static
 * local map rather than loaded from config so card rendering never has to
 * wait on the async config fetch.
 */

import { escapeHTML } from './html';

interface CountryInfo {
    name: string;
    iso2: string;
}

// FED (chess-results.com) code -> { display name, ISO 3166-1 alpha-2 for the
// flag emoji }. The British home nations and Crown dependencies have no ISO2
// of their own, so they fall back to the closest recognizable flag (GB).
export const COUNTRY_CODES: Record<string, CountryInfo> = {
    ALB: { name: 'Albania', iso2: 'AL' },
    AND: { name: 'Andorra', iso2: 'AD' },
    ARM: { name: 'Armenia', iso2: 'AM' },
    AUT: { name: 'Austria', iso2: 'AT' },
    AZE: { name: 'Azerbaijan', iso2: 'AZ' },
    BEL: { name: 'Belgium', iso2: 'BE' },
    BIH: { name: 'Bosnia and Herzegovina', iso2: 'BA' },
    BUL: { name: 'Bulgaria', iso2: 'BG' },
    CRO: { name: 'Croatia', iso2: 'HR' },
    CYP: { name: 'Cyprus', iso2: 'CY' },
    CZE: { name: 'Czech Republic', iso2: 'CZ' },
    DEN: { name: 'Denmark', iso2: 'DK' },
    ENG: { name: 'England', iso2: 'GB' },
    EST: { name: 'Estonia', iso2: 'EE' },
    FAI: { name: 'Faroe Islands', iso2: 'FO' },
    FIN: { name: 'Finland', iso2: 'FI' },
    FRA: { name: 'France', iso2: 'FR' },
    GEO: { name: 'Georgia', iso2: 'GE' },
    GER: { name: 'Germany', iso2: 'DE' },
    GCI: { name: 'Guernsey', iso2: 'GG' },
    GIB: { name: 'Gibraltar', iso2: 'GI' },
    GBR: { name: 'Great Britain', iso2: 'GB' },
    GRE: { name: 'Greece', iso2: 'GR' },
    HUN: { name: 'Hungary', iso2: 'HU' },
    IRL: { name: 'Ireland', iso2: 'IE' },
    ISL: { name: 'Iceland', iso2: 'IS' },
    IOM: { name: 'Isle of Man', iso2: 'IM' },
    ITA: { name: 'Italy', iso2: 'IT' },
    JCI: { name: 'Jersey', iso2: 'JE' },
    KOS: { name: 'Kosovo', iso2: 'XK' },
    LAT: { name: 'Latvia', iso2: 'LV' },
    LIE: { name: 'Liechtenstein', iso2: 'LI' },
    LTU: { name: 'Lithuania', iso2: 'LT' },
    LUX: { name: 'Luxembourg', iso2: 'LU' },
    MLT: { name: 'Malta', iso2: 'MT' },
    MDA: { name: 'Moldova', iso2: 'MD' },
    MNC: { name: 'Monaco', iso2: 'MC' },
    MNE: { name: 'Montenegro', iso2: 'ME' },
    NED: { name: 'Netherlands', iso2: 'NL' },
    MKD: { name: 'North Macedonia', iso2: 'MK' },
    NOR: { name: 'Norway', iso2: 'NO' },
    POL: { name: 'Poland', iso2: 'PL' },
    POR: { name: 'Portugal', iso2: 'PT' },
    ROU: { name: 'Romania', iso2: 'RO' },
    SMR: { name: 'San Marino', iso2: 'SM' },
    SCO: { name: 'Scotland', iso2: 'GB' },
    SRB: { name: 'Serbia', iso2: 'RS' },
    SVK: { name: 'Slovakia', iso2: 'SK' },
    SLO: { name: 'Slovenia', iso2: 'SI' },
    ESP: { name: 'Spain', iso2: 'ES' },
    SWE: { name: 'Sweden', iso2: 'SE' },
    SUI: { name: 'Switzerland', iso2: 'CH' },
    TUR: { name: 'Turkey', iso2: 'TR' },
    UKR: { name: 'Ukraine', iso2: 'UA' },
    WLS: { name: 'Wales', iso2: 'GB' },
};

/**
 * Small fixed-size (20x15, @3x source for retina) flag icons, not emoji -
 * flag emoji render as plain two-letter text on platforms whose fonts don't
 * include color flag glyphs (Windows and several Linux distros, regardless
 * of browser). Sourced from the MIT-licensed lipis/flag-icons project and
 * rasterized small since several countries' official flags carry a detailed
 * coat of arms that's needlessly heavy as SVG at icon size (e.g. Serbia's
 * was 180KB+); see public/flags/.
 */
function flagIconHTML(iso2: string): string {
    return `<img class="flag-icon" src="flags/${iso2.toLowerCase()}.png" width="20" height="15" alt="" loading="lazy">`;
}

/**
 * Format a "City, FED" (or bare "FED") location string with a flag icon and
 * the spelled-out country name, e.g. "Chatham, ENG" -> flag + "Chatham ·
 * England". Unknown FED codes fall back to the raw (escaped) location
 * string unchanged. Returns HTML ready to insert directly - the caller
 * should NOT re-escape this.
 */
/**
 * "🇪🇸 Benidorm · Spain" for a card. `town` (reverse-geocoded by
 * geocode_tournaments.py) wins over the location text, which is often a
 * street or venue ("Fragkopoulou 29", "Centro Ágora - C/ Lepanto 55"); the
 * caller keeps the original text in a tooltip. The FED code is the last
 * comma-separated part ("Hall, Street 5, ESP" has two commas).
 */
export function formatLocation(location: string, town?: string): string {
    const parts = location.split(',');
    const code = parts[parts.length - 1]!.trim().toUpperCase();
    const info = COUNTRY_CODES[code];
    if (!info) return escapeHTML(town ?? location);

    const flag = flagIconHTML(info.iso2);
    const place = (town ?? parts.slice(0, -1).join(',')).trim();
    return place ? `${flag} ${escapeHTML(place)} · ${info.name}` : `${flag} ${info.name}`;
}
