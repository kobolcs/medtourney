import { Tournament, Sea } from '../../types';
import { isSeaside, isMediterraneanLocation } from '../../utils/seas';
import { entryCategories } from '../../utils/entryCategories';

/** Cohesive entry, location, clock and duration predicates shared by filtering. */
export abstract class FilterPredicates {
    // Category detection methods

    protected isOpenCategory(category: string): boolean {
        return /\bopen\b/i.test(category);
    }

    protected isYouthTournament(name: string, category: string): boolean {
        return entryCategories(name, category).youth;
    }

    /** The Seaside rule (src/utils/seas.ts): by one of `seas` (default: any of the four). */
    isSeaside(tournament: Tournament, mediterraneanLocations: Set<string>, seas?: readonly Sea[]): boolean {
        return isSeaside(tournament, mediterraneanLocations, seas);
    }

    isMediterraneanLocation(location: string, mediterraneanLocations: Set<string>): boolean {
        return isMediterraneanLocation(location, mediterraneanLocations);
    }

    protected isSeniorCategory(category: string, name: string): boolean {
        return entryCategories(name, category).seniors.includes(50);
    }
    protected isSeniorS60Category(category: string, name: string): boolean {
        return entryCategories(name, category).seniors.some(age => age >= 60);
    }
    matchesYouthCategory(name: string, category: string, target: string): boolean {
        return entryCategories(name, category).ages.includes(Number(target.replace(/^u/i, '')));
    }
    matchesRatingCategory(name: string, category: string, target: string): boolean {
        return entryCategories(name, category).ratings.includes(Number(target.replace(/^u/i, '')));
    }

    protected isWomenTournament(category: string, name: string): boolean {
        const womenPattern = /\b(women|ladies|female|femmes|mujeres|donne|kobiet|žen)\b/i;
        return womenPattern.test(category) || womenPattern.test(name);
    }

    protected isTeamTournament(name: string, category: string): boolean {
        // Prefix match, like TournamentProcessor._is_team_tournament, so plurals
        // count too ("Copa por Equipos", "équipes", "teams"); \p{L} instead of
        // \b because \b doesn't treat "é" as a letter
        const teamPattern = /(?:^|[^\p{L}])(team|mannschaft|[eé]quipe|equipo|equipa|squadr[ae]|drużyn|družstv)/iu;
        return teamPattern.test(name) || teamPattern.test(category);
    }

    protected getTournamentDays(tournament: Tournament): number {
        if (!tournament.dateTo) return 1;
        const to = new Date(tournament.dateTo);
        if (isNaN(to.getTime())) return 1;
        return Math.round((to.getTime() - tournament.date.getTime()) / 86400000) + 1;
    }

    // True when every day of the tournament falls on a Saturday or Sunday:
    // 1-day on Sat, 1-day on Sun, or 2-day Sat+Sun.
    protected isJustWeekend(tournament: Tournament): boolean {
        const days = this.getTournamentDays(tournament);
        if (days > 2) return false;
        const startDay = tournament.date.getUTCDay();
        if (days === 1) return startDay === 6 || startDay === 0;
        return startDay === 6; // 2-day must start Saturday (→ ends Sunday)
    }

    // True when the tournament spans ≤5 days AND its date range includes
    // at least one Saturday (day 6) and one Sunday (day 0).
    protected isLongWeekend(tournament: Tournament): boolean {
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

    protected isClassicalTime(category: string): boolean {
        return /\b(classic|classical|standard)\b/i.test(category);
    }

    protected isRapidTime(category: string): boolean {
        return /\brapid\b/i.test(category);
    }

    protected isBlitzTime(category: string): boolean {
        return /\bblitz\b/i.test(category);
    }

}
