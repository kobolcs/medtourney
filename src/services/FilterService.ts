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

import { Tournament, FilterState, AppConfig } from '../types';

export class FilterService {
    private filterCache: Map<string, Tournament[]>;
    private readonly MAX_FILTER_CACHE_SIZE = 50;
    private config: AppConfig | null = null;

    constructor() {
        this.filterCache = new Map();
    }

    /**
     * Set application configuration
     */
    setConfig(config: AppConfig): void {
        this.config = config;
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
    filterTournaments(tournaments: Tournament[], filterState: FilterState): Tournament[] {
        // Generate cache key from filter state
        const cacheKey = this.generateCacheKey(filterState);

        // Check cache
        if (this.filterCache.has(cacheKey)) {
            console.log('Using cached filter results');
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

            // Country filter
            if (filterState.countryFilter && filterState.countryFilter !== 'all') {
                const locationLower = tournament.location.toLowerCase();
                const countryLower = filterState.countryFilter.toLowerCase();
                if (!locationLower.includes(countryLower)) {
                    return false;
                }
            }

            const categoryLower = tournament.category.toLowerCase();
            const locationLower = tournament.location.toLowerCase();
            const nameLower = tournament.name.toLowerCase();

            // Open category filter
            if (filterState.openOnly && !this.isOpenCategory(categoryLower)) {
                return false;
            }

            // Exclude youth filter
            if (filterState.excludeYouth && this.isYouthTournament(nameLower, categoryLower)) {
                return false;
            }

            // Mediterranean filter
            if (filterState.mediterraneanOnly && !this.isMediterraneanLocation(locationLower)) {
                return false;
            }

            // Senior category filter
            if (filterState.seniorCategory && !this.isSeniorCategory(categoryLower, nameLower)) {
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

        console.log(`Filtered ${filtered.length} tournaments (cached for future use)`);
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
            senior: filterState.seniorCategory,
            women: filterState.womenOnly,
            team: filterState.includeTeamTournaments,
            classical: filterState.classicalTime,
            rapid: filterState.rapidTime,
            blitz: filterState.blitzTime,
            start: filterState.startDate?.toISOString(),
            end: filterState.endDate?.toISOString(),
            country: filterState.countryFilter
        });
    }

    // Category detection methods

    private isOpenCategory(category: string): boolean {
        return /\bopen\b/i.test(category);
    }

    private isYouthTournament(name: string, category: string): boolean {
        const youthPattern = /\b(youth|junior|u\d+|u-\d+|under|młodzie[żz]|juniorów|juniorzy|żiak|ml[áa]de[žz]|ifjúság|jugend|jeune|juvenil|joven|giovani|giovanile|school|schule|école|escuela|scuola|szkoł|škol)\b/i;
        return youthPattern.test(name) || youthPattern.test(category);
    }

    private isMediterraneanLocation(location: string): boolean {
        if (!this.config) return false;
        return this.config.mediterraneanLocations.some(place =>
            location.includes(place.toLowerCase())
        );
    }

    private isSeniorCategory(category: string, name: string): boolean {
        const seniorPattern = /\b(s50\+|s\s*50\+|s50|senior|senioren|veteran|veteranen|vétéran|veterano|weteran|50\+|50\s*\+|over\s*50|o50)\b/i;
        return seniorPattern.test(category) || seniorPattern.test(name);
    }

    private isWomenTournament(category: string, name: string): boolean {
        const womenPattern = /\b(women|ladies|female|femmes|mujeres|donne|kobiet|žen)\b/i;
        return womenPattern.test(category) || womenPattern.test(name);
    }

    private isTeamTournament(name: string, category: string): boolean {
        const teamPattern = /\b(team|mannschaft|équipe|equipo|squadra|drużyn|družstv)\b/i;
        return teamPattern.test(name) || teamPattern.test(category);
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
