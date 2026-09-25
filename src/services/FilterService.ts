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

import { Tournament, FilterState, Sea } from '../types';
import { DEFAULT_SEAS, SEA_LABELS, isMediterraneanLocation, isSeaside, seaOf } from '../utils/seas';
import { isRestrictedEvent } from '../utils/openEvents';
import { Logger } from '../utils/Logger';

export class FilterService {
    private filterCache: Map<string, Tournament[]>;
    private readonly MAX_FILTER_CACHE_SIZE = 50;

    /** Tournament of the Week: an event you'd travel for, not a season-long league. */
    private static readonly FEATURED_MIN_DAYS = 5;
    private static readonly FEATURED_MAX_DAYS = 16;
    private static readonly CLUB_EVENT = /\b(circolo|club|klub|kluba|fase|liga|league|vereinsmeisterschaft|clubmeisterschaft|campionato sociale|campeonato social|championnat du club)\b/i;
    private readonly logger = Logger.createScoped('FilterService');

    constructor() {
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
            // Date range filter
            if (filterState.startDate && tournament.date < filterState.startDate) {
                return false;
            }
            if (filterState.endDate && tournament.date > filterState.endDate) {
                return false;
            }

            // Country filter — OR logic across selected codes
            if (filterState.countryFilter.length > 0) {
                const locationLower = tournament.location.toLowerCase();
                if (!filterState.countryFilter.some(code => locationLower.includes(code.toLowerCase()))) {
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
            if (filterState.excludeYouth && !filterState.youthCategory && this.isYouthTournament(nameLower, categoryLower)) {
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
                    (filterState.seniorCategory && this.isSeniorCategory(categoryLower, nameLower)) ||
                    (filterState.seniorS60 && this.isSeniorS60Category(categoryLower, nameLower));
                if (!matches) return false;
            }

            // Youth category filter (e.g. 'U14' shows only that age group)
            if (filterState.youthCategory && !this.matchesYouthCategory(nameLower, categoryLower, filterState.youthCategory)) {
                return false;
            }

            // Rating category filter (e.g. 'U1800' shows only that rating ceiling)
            if (filterState.ratingCategory && !this.matchesRatingCategory(nameLower, categoryLower, filterState.ratingCategory)) {
                return false;
            }

            // Women's tournament filter
            if (filterState.womenOnly && !this.isWomenTournament(categoryLower, nameLower)) {
                return false;
            }

            // Team tournament filter (exclude by default if not explicitly included)
            if (!filterState.includeTeamTournaments && this.isTeamTournament(nameLower, categoryLower)) {
                return false;
            }

            // Time control filters
            if (filterState.classicalTime || filterState.rapidTime || filterState.blitzTime) {
                const hasMatchingTimeControl =
                    (filterState.classicalTime && this.isClassicalTime(categoryLower)) ||
                    (filterState.rapidTime && this.isRapidTime(categoryLower)) ||
                    (filterState.blitzTime && this.isBlitzTime(categoryLower));

                if (!hasMatchingTimeControl) {
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

    // Category detection methods

    private isOpenCategory(category: string): boolean {
        return /\bopen\b/i.test(category);
    }

    private isYouthTournament(name: string, category: string): boolean {
        const youthPattern = /\b(youth|junior|u\d+|u-\d+|under|młodzie[żz]|juniorów|juniorzy|žiak|ml[áa]de[žz]|ifjúság|jugend|jeune|juvenil|joven|giovani|giovanile|school|schule|école|escuela|scuola|szkoł|škol)\b/i;
        return youthPattern.test(name) || youthPattern.test(category);
    }

    /** The Seaside rule (src/utils/seas.ts): by one of `seas` (default: any of the four). */
    isSeaside(tournament: Tournament, mediterraneanLocations: Set<string>, seas?: readonly Sea[]): boolean {
        return isSeaside(tournament, mediterraneanLocations, seas);
    }

    isMediterraneanLocation(location: string, mediterraneanLocations: Set<string>): boolean {
        return isMediterraneanLocation(location, mediterraneanLocations);
    }

    private isSeniorCategory(category: string, name: string): boolean {
        const seniorPattern = /\b(s50\+|s\s*50\+|s50|senior|senioren|veteran|veteranen|vétéran|veterano|weteran|50\+|50\s*\+|over\s*50|o50)\b/i;
        return seniorPattern.test(category) || seniorPattern.test(name);
    }

    private isSeniorS60Category(category: string, name: string): boolean {
        // No trailing \b — the + character is non-word so word boundary after it never fires
        const s60Pattern = /\b(s60\+?|s\s*60\+?|60\+|60\s*\+|over\s*60|o60)/i;
        return s60Pattern.test(category) || s60Pattern.test(name);
    }

    matchesYouthCategory(name: string, category: string, target: string): boolean {
        // target is like 'U12' — match U12, U-12, U 12 (case-insensitive)
        const age = target.replace(/^u/i, '');
        const re = new RegExp(`\\bu[-\\s]?${age}\\b`, 'i');
        return re.test(name) || re.test(category);
    }

    matchesRatingCategory(name: string, category: string, target: string): boolean {
        // target is like 'U1800' — match U1800, U-1800, U 1800 (case-insensitive)
        const rating = target.replace(/^u/i, '');
        const re = new RegExp(`\\bu[-\\s]?${rating}\\b`, 'i');
        return re.test(name) || re.test(category);
    }

    private isWomenTournament(category: string, name: string): boolean {
        const womenPattern = /\b(women|ladies|female|femmes|mujeres|donne|kobiet|žen)\b/i;
        return womenPattern.test(category) || womenPattern.test(name);
    }

    private isTeamTournament(name: string, category: string): boolean {
        // Prefix match, like TournamentProcessor._is_team_tournament, so plurals
        // count too ("Copa por Equipos", "équipes", "teams"); \p{L} instead of
        // \b because \b doesn't treat "é" as a letter
        const teamPattern = /(?:^|[^\p{L}])(team|mannschaft|[eé]quipe|equipo|equipa|squadr[ae]|drużyn|družstv)/iu;
        return teamPattern.test(name) || teamPattern.test(category);
    }

    private getTournamentDays(tournament: Tournament): number {
        if (!tournament.dateTo) return 1;
        const to = new Date(tournament.dateTo);
        if (isNaN(to.getTime())) return 1;
        return Math.round((to.getTime() - tournament.date.getTime()) / 86400000) + 1;
    }

    // True when every day of the tournament falls on a Saturday or Sunday:
    // 1-day on Sat, 1-day on Sun, or 2-day Sat+Sun.
    private isJustWeekend(tournament: Tournament): boolean {
        const days = this.getTournamentDays(tournament);
        if (days > 2) return false;
        const startDay = tournament.date.getUTCDay();
        if (days === 1) return startDay === 6 || startDay === 0;
        return startDay === 6; // 2-day must start Saturday (→ ends Sunday)
    }

    // True when the tournament spans ≤5 days AND its date range includes
    // at least one Saturday (day 6) and one Sunday (day 0).
    private isLongWeekend(tournament: Tournament): boolean {
        const days = this.getTournamentDays(tournament);
        if (days < 2 || days > 5) return false;
        let hasSat = false;
        let hasSun = false;
        for (let i = 0; i < days; i++) {
            const dow = new Date(tournament.date.getTime() + i * 86400000).getUTCDay();
            if (dow === 6) hasSat = true;
            if (dow === 0) hasSun = true;
        }
        return hasSat && hasSun;
    }

    private isClassicalTime(category: string): boolean {
        return /\b(classic|classical|standard)\b/i.test(category);
    }

    private isRapidTime(category: string): boolean {
        return /\brapid\b/i.test(category);
    }

    private isBlitzTime(category: string): boolean {
        return /\bblitz\b/i.test(category);
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

    /**
     * Sort tournaments by specified option
     */
    sortTournaments(tournaments: Tournament[], sortBy: string): Tournament[] {
        const sorted = [...tournaments];

        switch (sortBy) {
            case 'date-asc':
                sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
                break;
            case 'date-desc':
                sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
                break;
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'location':
                sorted.sort((a, b) => a.location.localeCompare(b.location));
                break;
            case 'country':
                sorted.sort((a, b) => {
                    const countryA = a.location.split(',').pop()?.trim() || '';
                    const countryB = b.location.split(',').pop()?.trim() || '';
                    return countryA.localeCompare(countryB);
                });
                break;
            default:
                // Default: date ascending
                sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
        }

        return sorted;
    }

    /**
     * Search within tournaments (quick search)
     */
    searchWithinTournaments(tournaments: Tournament[], query: string): Tournament[] {
        if (!query || query.trim() === '') {
            return tournaments;
        }

        const queryLower = query.toLowerCase();
        return tournaments.filter(tournament => {
            return (
                tournament.name.toLowerCase().includes(queryLower) ||
                tournament.location.toLowerCase().includes(queryLower) ||
                tournament.category.toLowerCase().includes(queryLower) ||
                tournament.description.toLowerCase().includes(queryLower)
            );
        });
    }
}
