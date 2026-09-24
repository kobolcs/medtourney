/**
 * Shared type definitions for the MedTourney application
 */

export interface Tournament {
    name: string;
    url: string;
    location: string;
    date: Date;
    category: string;
    description: string;
    timeControl?: string;
    dateTo?: string;
    /** Map coordinates from geocode_tournaments.py; absent if the location couldn't be placed. */
    lat?: number;
    lng?: number;
    /** Within 10 km of the sea (geocode_tournaments.py): Mediterranean or Spain/Portugal's Atlantic coast. */
    coast?: 'med' | 'atlantic';
    /** Featured seaside: the venue itself is this many metres (<= 500) from OSM's coastline. */
    seaM?: number;
    /** Travel context: nearest airport with scheduled flights (geocode_tournaments.py, <= 150 km). */
    airport?: { iata: string; name: string; km: number };
    classificationConfidence?: 'high' | 'medium' | 'low';
    classificationReasons?: string[];
    travelTags?: string[];
}

export interface FilterState {
    openOnly: boolean;
    excludeYouth: boolean;
    mediterraneanOnly: boolean;
    seniorCategory: boolean;
    womenOnly: boolean;
    includeTeamTournaments: boolean;
    classicalTime: boolean;
    rapidTime: boolean;
    blitzTime: boolean;
    startDate: Date | null;
    endDate: Date | null;
    countryFilter: string[];
    minDays: number | 'weekend' | 'just-weekend';
    seniorS60: boolean;
    youthCategory: string;
    ratingCategory: string;
}

export interface AppConfig {
    europeanCountries: string[];
    nonEuropeanCountries: string[];
    mediterraneanLocations: string[];
    countryCodes: Record<string, CountryCode>;
}

export interface CountryCode {
    name: string;
    keywords: string[];
}

export type SortOption = 'date-asc' | 'date-desc' | 'name' | 'location' | 'country';
