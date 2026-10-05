import { ThemeHelpPart } from './ThemeHelpPart';

/** Show provenance of the snapshot actually loaded, including an offline fallback. */
export abstract class DataFreshnessPart extends ThemeHelpPart {
    protected updateHeaderLiveStatus(): void {
        const countEl = document.getElementById('headerTournamentCount');
        if (!countEl || this.allTournaments.length === 0) return;
        const count = this.allTournaments.length.toLocaleString('en-GB');
        const info = this.dataService.getLoadedDataInfo();
        const label = info?.source === 'bundled' ? 'Bundled snapshot' :
            info?.source === 'cache' ? 'Offline snapshot' : 'Data updated';
        const date = info?.generatedAt ? new Date(info.generatedAt) : null;
        const stamp = date ? date.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
        }) : null;
        const noun = this.allTournaments.length === 1 ? 'tournament' : 'tournaments';
        countEl.textContent = `${count} ${noun} in index`;
        const freshness = document.getElementById('dataFreshness');
        if (freshness) {
            freshness.textContent = stamp ? `${label} ${stamp}` : `${label}: date unavailable`;
            freshness.hidden = false;
        }
    }
}
