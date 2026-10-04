import { Tournament } from '../../types';
import { FilterPredicates } from './FilterPredicates';

/** Ordering and text search, independent of the filter cache. */
export abstract class OrderingPart extends FilterPredicates {
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
