import { z } from 'zod';
export const TournamentSchema = z.object({
    name: z.string().min(1, 'Tournament name is required'),
    url: z.string().url('Invalid tournament URL'),
    location: z.string().min(1, 'Location is required'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format'
    }),
    category: z.string(),
    description: z.string(),
    timeControl: z.string().optional(),
    dateTo: z.string().optional()
});
export const TournamentsArraySchema = z.array(TournamentSchema);
export const CountryCodeSchema = z.object({
    name: z.string(),
    keywords: z.array(z.string())
});
export const AppConfigSchema = z.object({
    europeanCountries: z.array(z.string()),
    nonEuropeanCountries: z.array(z.string()),
    mediterraneanLocations: z.array(z.string()),
    countryCodes: z.record(z.string(), CountryCodeSchema)
});
export function validateTournaments(data) {
    return TournamentsArraySchema.parse(data);
}
export function validateAppConfig(data) {
    return AppConfigSchema.parse(data);
}
export function safeValidateTournaments(data) {
    const result = TournamentsArraySchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
export function safeValidateAppConfig(data) {
    const result = AppConfigSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
//# sourceMappingURL=validators.js.map