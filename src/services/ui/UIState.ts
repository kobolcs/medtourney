/**
 * UIManager's state (pagination, results, shortlist, empty-state context).
 * Base of the class chain in src/services/UIManager.ts; the methods live in
 * the part files in this folder and in UIManager.ts.
 */
import { Tournament } from '../../types';

export abstract class UIState {
    protected currentPage = 1;
    protected itemsPerPage = 10;
    protected filteredTournaments: Tournament[] = [];
    protected shortlistedUrls: Set<string> = new Set();
    protected emptyStateContext: { totalCount: number; relaxations: { label: string; count: number }[] } | null = null;
    protected groupByDate = false;
    protected monthCounts: Map<string, number> = new Map();

    // Implemented further up the chain; declared here so lower parts can call them
    protected abstract renderResults(): void;
}
