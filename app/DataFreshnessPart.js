import { ThemeHelpPart } from './ThemeHelpPart';
export class DataFreshnessPart extends ThemeHelpPart {
    updateHeaderLiveStatus() {
        const countEl = document.getElementById('headerTournamentCount');
        if (!countEl || this.allTournaments.length === 0)
            return;
        const count = this.allTournaments.length.toLocaleString('en-GB');
        countEl.textContent = `${count} European tournaments`;
    }
}
//# sourceMappingURL=DataFreshnessPart.js.map