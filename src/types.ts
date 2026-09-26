/**
 * Shared type definitions for the MedTourney application
 */

/** A sea a seaside tournament is by (geocode_tournaments.py `coast`) */
export type Sea = 'med' | 'atlantic' | 'black' | 'caspian';

/** One round from a chess-results.com playing schedule (details/parse.py) */
export interface ScheduleRound {
    round: number;
    /** YYYY-MM-DD */
    date: string;
    /** HH:MM (absent if not on the page) */
    time?: string;
}

/** chess-results.com tournament details (details/parse.py) */
export interface TournamentDetails {
    organizer?: string;
    rounds?: number;
    /** e.g. "Swiss-System", "Round robin" */
    system?: string;
    /** e.g. ["Rating national", "Rating international"] */
    rated?: string[];
    /** FIDE event id - https://ratings.fide.com/tournament_information.phtml?event=<id> */
    fideId?: string;
    address?: string;
    homepage?: string;
    /** Playing schedule from ?art=14 page (multi-day events only) */
    schedule?: ScheduleRound[];
    /** PDF regulations/announcement link from the Links section */
    regulationsUrl?: string;
}

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
    /** Within 10 km of the sea (geocode_tournaments.py): which sea. */
    coast?: Sea;
    /** Featured seaside: the venue itself is this many metres (<= 500) from OSM's coastline. */
    seaM?: number;
    /** Travel context: nearest airport with airline routes (geocode_tournaments.py, <= 150 km). */
    airport?: { iata: string; name: string; km: number; city?: string };
    /** From the chess-results.com details page (fetch_details.py); fields may be missing. */
    details?: TournamentDetails;
    /** Display town from reverse geocoding (the location text is often a street or venue). */
    town?: string;
    classificationConfidence?: 'high' | 'medium' | 'low';
    classificationReasons?: string[];
    travelTags?: string[];
}

export interface FilterState {
    openOnly: boolean;
    excludeYouth: boolean;
    mediterraneanOnly: boolean;
    /** Seas the Seaside mode (mediterraneanOnly) counts; missing = src/utils/seas.ts DEFAULT_SEAS */
    seas?: Sea[];
    seniorCategory: boolean;
    womenOnly: boolean;
    includeTeamTournaments: boolean;
    /** Show weekly / season-long events (over FilterService.MAX_EVENT_DAYS); missing = false */
    includeLongEvents?: boolean;
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
