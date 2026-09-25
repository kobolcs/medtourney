/**
 * Runtime validation schemas using Zod
 *
 * Provides runtime type validation for data fetched from external sources.
 * Complements TypeScript's compile-time type checking.
 *
 * zod/mini: the same validation as full zod with a tree-shakable,
 * function-style API (z.optional(x), .check(z.minLength(1))). Full zod
 * 4.6 added ~11 KB gzipped to the main bundle; mini keeps it small.
 */

import { z } from 'zod/mini';

/**
 * Tournament schema - validates tournament data structure
 */
export const TournamentSchema = z.object({
    name: z.string().check(z.minLength(1, 'Tournament name is required')),
    url: z.url('Invalid tournament URL'),
    location: z.string().check(z.minLength(1, 'Location is required')),
    date: z.string().check(z.refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format'
    })),
    category: z.string(),
    description: z.string(),
    timeControl: z.optional(z.string()),
    dateTo: z.optional(z.string()),
    // Map coordinates added by geocode_tournaments.py (absent when a
    // location couldn't be placed)
    lat: z.optional(z.number().check(z.gte(-90), z.lte(90))),
    lng: z.optional(z.number().check(z.gte(-180), z.lte(180))),
    coast: z.optional(z.enum(['med', 'atlantic', 'black', 'caspian'])),
    seaM: z.optional(z.int().check(z.gte(0), z.lte(500))),
    airport: z.optional(z.object({
        iata: z.string().check(z.regex(/^[A-Z0-9]{3}$/)),
        name: z.string(),
        km: z.int().check(z.gte(1), z.lte(150)),
        city: z.optional(z.string().check(z.minLength(1), z.maxLength(60))),
    })),
    town: z.optional(z.string().check(z.minLength(1), z.maxLength(120)))
});

/**
 * Array of tournaments schema
 */
export const TournamentsArraySchema = z.array(TournamentSchema);

/**
 * Country code schema
 */
export const CountryCodeSchema = z.object({
    name: z.string(),
    keywords: z.array(z.string())
});

/**
 * Application configuration schema
 */
export const AppConfigSchema = z.object({
    europeanCountries: z.array(z.string()),
    nonEuropeanCountries: z.array(z.string()),
    mediterraneanLocations: z.array(z.string()),
    countryCodes: z.record(z.string(), CountryCodeSchema)
});

/**
 * Type inference from schemas (for TypeScript)
 */
export type ValidatedTournament = z.infer<typeof TournamentSchema>;
export type ValidatedTournamentsArray = z.infer<typeof TournamentsArraySchema>;
export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Helper function to safely parse and validate data
 */
export function validateTournaments(data: unknown): ValidatedTournamentsArray {
    return TournamentsArraySchema.parse(data);
}

/**
 * Helper function to safely parse and validate app config
 */
export function validateAppConfig(data: unknown): ValidatedAppConfig {
    return AppConfigSchema.parse(data);
}

/**
 * Safe parse with error details
 */
export function safeValidateTournaments(data: unknown): {
    success: boolean;
    data?: ValidatedTournamentsArray;
    error?: z.core.$ZodError;
} {
    const result = TournamentsArraySchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}

/**
 * Safe parse config with error details
 */
export function safeValidateAppConfig(data: unknown): {
    success: boolean;
    data?: ValidatedAppConfig;
    error?: z.core.$ZodError;
} {
    const result = AppConfigSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
