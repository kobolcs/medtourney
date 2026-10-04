/**
 * FilterService - Handles tournament filtering logic
 *
 * Provides efficient filtering with caching for:
 * - Category filters (Open, Senior, Women, Team)
 * - Geographic filters (Mediterranean, European)
 * - Time control filters (Classical, Rapid, Blitz)
 * - Date range filtering
 * - Country filtering
 */

import { federationCode } from '../utils/countries';
import { Tournament, FilterState } from '../types';
import { DEFAULT_SEAS, SEA_LABELS, seaOf } from '../utils/seas';
import { isRestrictedEvent } from '../utils/openEvents';
import { OrderingPart } from './filter/OrderingPart';
import { Logger } from '../utils/Logger';

export class FilterService extends OrderingPart {
    private filterCache: Map<string, Tournament[]>;
    private readonly MAX_FILTER_CACHE_SIZE = 50;

    /** Tournament of the Week: an event you'd travel for, not a season-long league. */
    /** Longer than this = weekly / season-long event, hidden by default */
    static readonly MAX_EVENT_DAYS = 21;
    private static readonly FEATURED_MIN_DAYS = 5;
    private static readonly FEATURED_MAX_DAYS = 16;
    private static readonly CLUB_EVENT = /\b(circolo|club|klub|kluba|fase|liga|league|vereinsmeisterschaft|clubmeisterschaft|campionato sociale|campeonato social|championnat du club)\b/i;
    private readonly logger = Logger.createScoped('FilterService');

    constructor() {
        super();
        this.filterCache = new Map();
    }

    /**
     * Clear filter cache (call when new data loaded)
     */
    clearCache(): void {
        this.filterCache.clear();
    }

    /**
     * Filter tournaments based on filter state
     */
    filterTournaments(
        tournaments: Tournament[],
        filterState: FilterState,
        mediterraneanLocations: Set<string>
    ): Tournament[] {
        // Generate cache key from filter state
        const cacheKey = this.generateCacheKey(filterState);

        // Check cache
        if (this.filterCache.has(cacheKey)) {
            this.logger.debug('Using cached filter results');
            return this.filterCache.get(cacheKey)!;
        }

        // Apply filters
        const filtered = tournaments.filter(tournament => {
            // Date range filter: compare against the tournament's end date so that
            // ongoing and recently-ended events stay visible (default start = 7 days ago).
            if (filterState.startDate) {
                const end = tournament.dateTo ? new Date(`${tournament.dateTo}T12:00:00`) : tournament.date;
                if (isNaN(end.getTime()) || end < filterState.startDate) return false;
            }
            if (filterState.endDate && tournament.date > filterState.endDate) {
                return false;
            }

            // Country filter — OR logic across selected codes
            if (filterState.countryFilter.length > 0) {
                const country = federationCode(tournament.location);
                if (!filterState.countryFilter.some(code => country === code.toUpperCase())) {
                    return false;
                }
            }

            const categoryLower = tournament.category.toLowerCase();
            const nameLower = tournament.name.toLowerCase();

            // Open category filter
            // "Open to all": hide only clearly restricted events - few are labelled "Open"
            if (filterState.openOnly && isRestrictedEvent(nameLower, categoryLower)) {
                return false;
            }

            // Exclude youth filter (bypassed when a specific U-category is targeted)
            if (filterState.excludeYouth && !filterState.youthCategory && this.isYouthTournament(tournament.name, tournament.category)) {
                return false;
            }

            // Seaside filter (mediterraneanOnly - the "Seaside" mode), by the picked seas
            if (filterState.mediterraneanOnly
                && !this.isSeaside(tournament, mediterraneanLocations, filterState.seas ?? DEFAULT_SEAS)) {
                return false;
            }

            // Senior category filter (S50+ and/or S60+ — OR logic when both checked)
            if (filterState.seniorCategory || filterState.seniorS60) {
                const matches =
                    (filterState.seniorCategory && this.isSeniorCategory(tournament.category, tournament.name)) ||
                    (filterState.seniorS60 && this.isSeniorS60Category(tournament.category, tournament.name));
                if (!matches) return false;
            }

            // Youth category filter (e.g. 'U14' shows only that age group)
            if (filterState.youthCategory && !this.matchesYouthCategory(tournament.name, tournament.category, filterState.youthCategory)) {
                return false;
            }

            // Rating category filter (e.g. 'U1800' shows only that rating ceiling)
            if (filterState.ratingCategory && !this.matchesRatingCategory(tournament.name, tournament.category, filterState.ratingCategory)) {
                return false;
            }

            // Women's tournament filter
            if (filterState.womenOnly && !this.isWomenTournament(categoryLower, nameLower)) {
                return false;
            }

            // Team tournament filter (exclude by default if not explicitly included)
            // Weekly club leagues / season-long events (e.g. 162 days) aren't
            // tournaments to travel to - hidden unless asked for
            if (!filterState.includeLongEvents && this.getTournamentDays(tournament) > FilterService.MAX_EVENT_DAYS) {
                return false;
            }

            if (!filterState.includeTeamTournaments && this.isTeamTournament(nameLower, categoryLower)) {
                return false;
            }

            // Time control filters
            if (filterState.classicalTime || filterState.rapidTime || filterState.blitzTime) {
                const hasMatchingTimeControl =
                    (filterState.classicalTime && this.isClassicalTime(categoryLower)) ||
                    (filterState.rapidTime && this.isRapidTime(categoryLower)) ||
                    (filterState.blitzTime && this.isBlitzTime(categoryLower));

                if (!hasMatchingTimeControl && !(filterState.classicalTime && filterState.rapidTime && filterState.blitzTime)) {
                    return false;
                }
            }

            // Minimum duration filter
            if (filterState.minDays === 'just-weekend') {
                if (!this.isJustWeekend(tournament)) return false;
            } else if (filterState.minDays === 'weekend') {
                if (!this.isLongWeekend(tournament)) return false;
            } else if (filterState.minDays > 0) {
                if (this.getTournamentDays(tournament) < filterState.minDays) return false;
            }

            return true;
        });

        // Cache results with size limit (FIFO eviction)
        if (this.filterCache.size >= this.MAX_FILTER_CACHE_SIZE) {
            const firstKey = this.filterCache.keys().next().value;
            if (firstKey) {
                this.filterCache.delete(firstKey);
            }
        }
        this.filterCache.set(cacheKey, filtered);

        this.logger.debug(`Filtered ${filtered.length} tournaments (cached for future use)`);
        return filtered;
    }

    /**
     * Generate cache key from filter state
     */
    private generateCacheKey(filterState: FilterState): string {
        return JSON.stringify({
            open: filterState.openOnly,
            youth: filterState.excludeYouth,
            med: filterState.mediterraneanOnly,
            seas: (filterState.seas ?? DEFAULT_SEAS).join(','),
            senior: filterState.seniorCategory,
            women: filterState.womenOnly,
            team: filterState.includeTeamTournaments,
            long: filterState.includeLongEvents ?? false,
            classical: filterState.classicalTime,
            rapid: filterState.rapidTime,
            blitz: filterState.blitzTime,
            start: filterState.startDate?.toISOString(),
            end: filterState.endDate?.toISOString(),
            country: filterState.countryFilter.join(','),
            minDays: filterState.minDays,
            s60: filterState.seniorS60,
            youthCat: filterState.youthCategory,
            ratingCat: filterState.ratingCategory
        });
    }

    /**
     * Annotate a tournament with classification confidence, reasons, and travel tags.
     * Call after filtering so only displayed tournaments are annotated.
     */
    annotate(tournament: Tournament, mediterraneanLocations: Set<string>): Tournament {
        const cat = tournament.category.toLowerCase();
        const name = tournament.name.toLowerCase();

        const reasons: string[] = [];
        const tags: string[] = [];

        if (this.isOpenCategory(cat)) reasons.push('Open to all');
        if (this.isSeniorCategory(cat, name)) reasons.push('Senior (S50+)');
        if (this.isWomenTournament(cat, name)) reasons.push("Women's");
        if (this.isClassicalTime(cat)) reasons.push('Classical');
        if (this.isRapidTime(cat)) reasons.push('Rapid');
        if (this.isBlitzTime(cat)) reasons.push('Blitz');

        // Which sea ("Mediterranean", "Atlantic", "Black Sea", "Caspian") + "Seaside"
        const sea = seaOf(tournament, mediterraneanLocations);
        if (sea) tags.push(SEA_LABELS[sea], 'Seaside');
        if (this.isSeniorCategory(cat, name)) tags.push('Senior-friendly');
        if (this.isClassicalTime(cat)) tags.push('Classical');
        if (this.isRapidTime(cat)) tags.push('Rapid');

        const confidence: 'high' | 'medium' | 'low' =
            reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'low';

        return { ...tournament, classificationReasons: reasons, travelTags: tags, classificationConfidence: confidence };
    }

    /**
     * Pick the upcoming seaside tournament to feature: one you'd plan a trip
     * around. Seaside, starts within 30 days, runs FEATURED_MIN_DAYS to
     * FEATURED_MAX_DAYS (a 7-week club championship with a round a week is
     * long but not a trip), is Open (not a closed national championship)
     * and isn't a club/league, team or youth event.
     * Beachfront venues first, then the soonest start, then the longer one.
     */
    pickFeatured(tournaments: Tournament[], mediterraneanLocations: Set<string>): Tournament | null {
        const now = new Date();
        // Compare at day granularity (tournament dates are stored as UTC midnight)
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const cutoff = new Date(todayUtc.getTime() + 30 * 86400000);

        const candidates = tournaments.filter(t => {
            if (t.date < todayUtc || t.date > cutoff) return false;
            if (!t.dateTo) return false;
            if (!this.isSeaside(t, mediterraneanLocations, DEFAULT_SEAS)) return false;
            const days = this.getTournamentDays(t);
            if (days < FilterService.FEATURED_MIN_DAYS || days > FilterService.FEATURED_MAX_DAYS) return false;
            const name = t.name.toLowerCase();
            const category = t.category.toLowerCase();
            return this.isOpenCategory(category) // not a closed national/invitation event
                && !FilterService.CLUB_EVENT.test(name)
                && !this.isTeamTournament(name, category)
                && !this.isYouthTournament(name, category);
        });

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            // Beachfront venues (<= 500 m from the sea) are the ones to feature
            const beachDiff = Number(b.seaM !== undefined) - Number(a.seaM !== undefined);
            if (beachDiff !== 0) return beachDiff;
            const dateDiff = a.date.getTime() - b.date.getTime();
            if (dateDiff !== 0) return dateDiff;
            return this.getTournamentDays(b) - this.getTournamentDays(a);
        });

        return candidates[0] ?? null;
    }

}
