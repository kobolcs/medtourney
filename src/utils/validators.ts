/**
 * Runtime validation schemas using Zod
 *
 * Provides runtime type validation for data fetched from external sources.
 * Complements TypeScript's compile-time type checking.
 */

import { z } from 'zod';

/**
 * Tournament schema - validates tournament data structure
 */
export const TournamentSchema = z.object({
    name: z.string().min(1, 'Tournament name is required'),
    url: z.string().url('Invalid tournament URL'),
    location: z.string().min(1, 'Location is required'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format'
    }),
    category: z.string(),
    description: z.string()
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
    error?: z.ZodError;
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
    error?: z.ZodError;
} {
    const result = AppConfigSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
