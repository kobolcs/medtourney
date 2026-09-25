/**
 * TournamentFinder, part: DataFreshnessPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { ThemeHelpPart } from './ThemeHelpPart';

/** Data freshness: last-updated footer, header live status, staleness banner. */
export abstract class DataFreshnessPart extends ThemeHelpPart {
    /**
     * Parse the timestamp localStorage keeps alongside the cached tournament
     * list. Shared by the footer's "Data updated" line and the header's live
     * status line, which format it differently.
     */
    protected getCachedTournamentsTimestamp(): Date | null {
        const cacheTimestamp = localStorage.getItem(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
        if (!cacheTimestamp) return null;
        try {
            const parsed = JSON.parse(cacheTimestamp) as { timestamp?: string | number };
            if (parsed.timestamp) {
                const date = new Date(parsed.timestamp);
                if (!isNaN(date.getTime())) return date;
            }
        } catch (e) {
            this.logger.warn('Failed to parse cache timestamp', {
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
        return null;
    }

    /**
     * Display last updated timestamp
     */
    protected displayLastUpdated(): void {
        // First paint on repeat visits: when this browser cached the data (a
        // close lower bound on freshness). checkDataStaleness() replaces it
        // with the authoritative scrape time; with neither, the line stays hidden.
        const date = this.getCachedTournamentsTimestamp();
        if (date) this.setFooterTimestamp(date);
    }

    /** Show the footer's "Data updated <date> ·" segment with the given time. */
    protected setFooterTimestamp(date: Date): void {
        const wrap = document.getElementById('lastUpdatedWrap');
        const time = document.getElementById('lastUpdatedTime');
        if (!wrap || !time) return;
        time.textContent = date.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        wrap.hidden = false;
    }

    /**
     * Refresh the header's "N European tournaments · updated <when>" line.
     * Called after every search (count) and once checkDataStaleness resolves
     * the authoritative scrape timestamp (date), so it settles quickly on
     * repeat visits and self-corrects once the meta file lands.
     */
    protected updateHeaderLiveStatus(): void {
        const countEl = document.getElementById('headerTournamentCount');
        if (!countEl || this.allTournaments.length === 0) return;

        const count = this.allTournaments.length.toLocaleString('en-GB');
        const date = this.headerDateLabel ?? this.getCachedTournamentsTimestamp()?.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }) ?? null;

        countEl.textContent = date
            ? `${count} European tournaments · updated ${date}`
            : `${count} European tournaments`;
    }

    /**
     * Check if tournament data is stale (>48h since last scrape).
     * Updates the footer timestamp from the authoritative meta file and
     * shows a warning banner if the data is too old.
     */
    protected async checkDataStaleness(): Promise<void> {
        try {
            const response = await fetch('tournaments_data_meta.json');
            if (!response.ok) return;
            const meta = await response.json() as { generatedAt?: string };
            if (!meta.generatedAt) return;

            const generatedAt = new Date(meta.generatedAt);
            if (isNaN(generatedAt.getTime())) return;

            // Overwrite footer with the authoritative generation timestamp
            this.setFooterTimestamp(generatedAt);

            this.headerDateLabel = generatedAt.toLocaleString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            this.updateHeaderLiveStatus();

            const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince > 48) {
                const daysAgo = Math.round(hoursSince / 24);
                this.uiManager.showStalenessBanner(
                    `⚠️ Tournament data is ${daysAgo} day${daysAgo !== 1 ? 's' : ''} old — the daily update may have failed. Some recent tournaments may be missing.`
                );
            }
        } catch (_e) {
            // Non-critical — silently ignore
        }
    }
}
