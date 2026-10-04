type Tempo = 'classical' | 'rapid' | 'blitz';
const TEMPOS: Tempo[] = ['classical', 'rapid', 'blitz'];

interface BrowserTool {
    name: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
}

function inputs(): HTMLInputElement[] {
    return TEMPOS.map(tempo => document.getElementById(`${tempo}Time`) as HTMLInputElement);
}

/** All-off has always meant unrestricted in the service: make that state visible. */
export function syncTimeControlToolbar(): void {
    const controls = inputs();
    const hint = document.getElementById('tempoHint');
    if (controls.every(control => !control.checked)) {
        controls.forEach(control => { control.checked = true; });
        if (hint) hint.textContent = 'All tempos selected. Keep at least one tempo to narrow the list.';
    }
    document.getElementById('allTimeControls')?.setAttribute('aria-pressed', String(controls.every(control => control.checked)));
}

function currentView(): object {
    return {
        timeControls: TEMPOS.filter((_, index) => inputs()[index]?.checked),
        resultCount: document.getElementById('resultsCount')?.textContent,
        tournaments: Array.from(document.querySelectorAll<HTMLElement>('.tournament-card')).map(card => ({
            name: card.querySelector('.tournament-name')?.textContent?.trim(),
            location: card.querySelector('.tournament-place')?.textContent?.trim(),
            sourceUrl: card.dataset.tournamentUrl,
        })),
    };
}

function validateTempos(input: unknown): Tempo[] {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a timeControls object.');
    const value = (input as { timeControls?: unknown }).timeControls;
    if (!Array.isArray(value) || value.length < 1 || value.length > 3
        || value.some(tempo => !TEMPOS.includes(tempo as Tempo))
        || new Set(value).size !== value.length
        || Object.keys(input).some(key => key !== 'timeControls')) {
        throw new Error('Select one to three distinct tempos: classical, rapid, blitz.');
    }
    return value as Tempo[];
}

function registerBrowserTools(apply: (tempos: Tempo[]) => void): void {
    const context = (document as Document & { modelContext?: { registerTool: (tool: BrowserTool, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: BrowserTool[] = [
        {
            name: 'set_time_controls',
            description: 'Select tournament time controls, update the visible results, and return the current result count and page.',
            inputSchema: { type: 'object', properties: { timeControls: { type: 'array', items: { enum: TEMPOS }, minItems: 1, maxItems: 3, uniqueItems: true } }, required: ['timeControls'], additionalProperties: false },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute(input: unknown): object { apply(validateTempos(input)); return currentView(); },
        },
        {
            name: 'read_visible_tournaments',
            description: 'Read the selected time controls, current result count and tournament cards on the visible results page.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown): object {
                if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
                return currentView();
            },
        },
    ];
    tools.forEach(tool => {
        try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); }
        catch { /* Optional API must not affect the tournament UI. */ }
    });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

/** Native controls and optional agent tools share the same application action. */
export function initTimeControlToolbar(onChange: () => void): void {
    const apply = (tempos: Tempo[]): void => {
        inputs().forEach((control, index) => { control.checked = tempos.includes(TEMPOS[index]!); });
        syncTimeControlToolbar();
        onChange();
    };
    syncTimeControlToolbar();
    inputs().forEach(control => control.addEventListener('change', () => {
        const hint = document.getElementById('tempoHint');
        if (hint) hint.textContent = 'Choose one or more. Clocks show minutes + seconds per move.';
        syncTimeControlToolbar();
    }));
    document.getElementById('allTimeControls')?.addEventListener('click', () => apply(TEMPOS));
    registerBrowserTools(apply);
}
