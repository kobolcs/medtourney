import { z } from 'zod/mini';
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
    town: z.optional(z.string().check(z.minLength(1), z.maxLength(120))),
    details: z.catch(z.optional(z.object({
        organizer: z.optional(z.string().check(z.maxLength(120))),
        rounds: z.optional(z.int().check(z.gte(1), z.lte(99))),
        system: z.optional(z.string().check(z.maxLength(60))),
        rated: z.optional(z.array(z.string().check(z.maxLength(60)))),
        fideId: z.optional(z.string().check(z.regex(/^\d{1,10}$/))),
        address: z.optional(z.string().check(z.maxLength(160))),
        homepage: z.optional(z.url()),
        schedule: z.optional(z.array(z.object({
            round: z.int().check(z.gte(1), z.lte(99)),
            date: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
            time: z.optional(z.string().check(z.regex(/^\d{2}:\d{2}$/))),
        }))),
        regulationsUrl: z.optional(z.url()),
    })), undefined)
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