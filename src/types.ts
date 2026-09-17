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
    countryFilter: string;
    minDays: number;
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
