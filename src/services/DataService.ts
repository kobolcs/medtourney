/**
 * DataService - Handles data fetching and API operations
 *
 * Provides:
 * - Tournament data loading from multiple sources
 * - Configuration loading
 */

import { Tournament, AppConfig } from '../types';
import { CacheManager } from './CacheManager';
import { Logger } from '../utils/Logger';
import { safeValidateTournaments, safeValidateAppConfig, ValidatedTournamentsArray } from '../utils/validators';

export interface LoadedDataInfo {
    source: 'network' | 'cache' | 'bundled';
    dataUrl: string;
    generatedAt?: string;
}

interface TournamentSnapshot {
    rows: ValidatedTournamentsArray;
    dataUrl: string;
    generatedAt?: string;
}

interface DataSource {
    url: string;
    accept: string;
}

export class DataService {
    private readonly githubRepo = 'kobolcs/medtourney';
    private readonly githubBranch = 'main';
    private cacheManager: CacheManager;
    private loadedDataInfo: LoadedDataInfo | null = null;
    private logger = Logger.createScoped('DataService');

    constructor(cacheManager: CacheManager) {
        this.cacheManager = cacheManager;
    }

    /** Details of the snapshot actually returned, including offline provenance. */
    getLoadedDataInfo(): LoadedDataInfo | null {
        return this.loadedDataInfo ? { ...this.loadedDataInfo } : null;
    }

    /** Refresh from the network; keep a validated last-good snapshot for offline use. */
    async fetchTournaments(): Promise<Tournament[]> {
        this.loadedDataInfo = null;
        const sources = this.getDataSources();
        const key = this.cacheManager.CACHE_KEYS.TOURNAMENTS +
            (sources.length === 1 ? `:${sources[0]!.url}` : '');
        // Read without TTL expiry: a validated older snapshot is useful offline.
        const cached: unknown = this.cacheManager.loadPreference<unknown>(key);
        for (const source of sources) {
            try {
                const rows = this.validateRows(await this.fetchJson(source));
                const generatedAt = await this.fetchGeneratedAt(source, rows.length);
                const snapshot: TournamentSnapshot = { rows, dataUrl: source.url, generatedAt };
                this.cacheManager.saveToCache(key, snapshot);
                return this.useSnapshot(snapshot, 'network');
            } catch (error) {
                this.logger.warn('Could not refresh tournament data', {
                    source: source.url, error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        const fallback = this.validateCachedSnapshot(cached, sources);
        if (fallback) return this.useSnapshot(fallback, 'cache');
        if (sources.length === 1) {
            const bundled = await this.loadBundledSnapshot();
            if (bundled) return this.useSnapshot(bundled, 'bundled');
        }
        throw new Error('Failed to load tournament data from all sources (network and cache)');
    }

    /** A private deployment's bundled copy is the final fallback, never the upstream cache. */
    private async loadBundledSnapshot(): Promise<TournamentSnapshot | null> {
        const source = { url: 'tournaments_data.json', accept: 'application/json' };
        try {
            const rows = this.validateRows(await this.fetchJson(source));
            const generatedAt = await this.fetchGeneratedAt(source, rows.length);
            return { rows, dataUrl: source.url, generatedAt };
        } catch {
            return null;
        }
    }

    private getDataSources(): DataSource[] {
        const override = typeof document === 'undefined' ? null :
            document.querySelector<HTMLMetaElement>('meta[name="medtourney-data-source"]')?.content;
        if (override) {
            try {
                const root = new URL(override);
                if (root.protocol !== 'https:' || root.username || root.password || root.search || root.hash) {
                    throw new Error('Data source must be an HTTPS root URL');
                }
                if (!root.pathname.endsWith('/')) root.pathname += '/';
                return [{ url: new URL('tournaments_data.json', root).href, accept: 'application/json' }];
            } catch (error) {
                this.logger.warn('Invalid tournament data source override', { error });
            }
        }
        const [owner, repo] = this.githubRepo.split('/');
        return [
            { url: 'tournaments_data.json', accept: 'application/json' },
            { url: `https://${owner}.github.io/${repo}/tournaments_data.json`, accept: 'application/json' },
            { url: `https://api.github.com/repos/${this.githubRepo}/contents/tournaments_data.json?ref=${this.githubBranch}`,
                accept: 'application/vnd.github.v3.raw' }
        ];
    }

    private async fetchJson(source: DataSource): Promise<unknown> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(source.url, {
                method: 'GET', headers: { Accept: source.accept },
                cache: 'no-store', signal: controller.signal
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    private validateRows(raw: unknown): ValidatedTournamentsArray {
        const validation = safeValidateTournaments(raw);
        if (!validation.success || !validation.data?.length) {
            throw new Error('Invalid or empty tournament snapshot');
        }
        return validation.data;
    }

    private async fetchGeneratedAt(source: DataSource, count: number): Promise<string | undefined> {
        try {
            const raw = await this.fetchJson({ ...source,
                url: source.url.replace('tournaments_data.json', 'tournaments_data_meta.json') });
            return this.validateGeneratedAt(raw, count);
        } catch {
            // Sidecar availability never blocks an otherwise valid snapshot.
            return undefined;
        }
    }

    private validateGeneratedAt(raw: unknown, count: number): string | undefined {
        if (!raw || typeof raw !== 'object' || !('generatedAt' in raw) || !('keptRows' in raw)) return undefined;
        const { generatedAt, keptRows } = raw;
        if (typeof generatedAt !== 'string' || keptRows !== count ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) return undefined;
        const day = generatedAt.slice(0, 10);
        if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return undefined;
        return generatedAt;
    }

    private validateCachedSnapshot(raw: unknown, sources: DataSource[]): TournamentSnapshot | null {
        try {
            if (Array.isArray(raw)) return { rows: this.validateRows(raw), dataUrl: sources[0]!.url };
            if (!raw || typeof raw !== 'object' || !('rows' in raw) || !('dataUrl' in raw)) return null;
            const rows = this.validateRows(raw.rows);
            const dataUrl = raw.dataUrl;
            if (typeof dataUrl !== 'string' || !sources.some(source => source.url === dataUrl)) return null;
            const generatedAt = 'generatedAt' in raw ?
                this.validateGeneratedAt({ generatedAt: raw.generatedAt, keptRows: rows.length }, rows.length) : undefined;
            return { rows, dataUrl, generatedAt };
        } catch {
            return null;
        }
    }

    private useSnapshot(snapshot: TournamentSnapshot, source: LoadedDataInfo['source']): Tournament[] {
        this.loadedDataInfo = { source, dataUrl: snapshot.dataUrl, generatedAt: snapshot.generatedAt };
        return snapshot.rows.map(tournament => ({ ...tournament, date: new Date(tournament.date) }));
    }

    /**
     * Load application configuration
     */
    async loadConfig(): Promise<AppConfig> {
        // Check cache first
        const cachedConfig = this.cacheManager.loadFromCache<AppConfig>(
            this.cacheManager.CACHE_KEYS.CONFIG
        );
        if (cachedConfig) {
            this.logger.info('Loaded config from cache');
            return cachedConfig;
        }

        try {
            const response = await fetch('config.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const rawData: unknown = await response.json();

            // Validate config structure
            const validation = safeValidateAppConfig(rawData);
            if (!validation.success) {
                this.logger.warn('Config data validation failed, using defaults', {
                    errors: validation.error?.issues
                });
                return this.getDefaultConfig();
            }

            const config = validation.data!;

            // Save to cache
            this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.CONFIG, config);

            this.logger.info('Loaded and validated config from file', {
                countriesCount: config.europeanCountries.length,
                locationsCount: config.mediterraneanLocations.length
            });
            return config;
        } catch (err) {
            this.logger.warn('Failed to load config.json, using defaults', {
                error: err instanceof Error ? err.message : 'Unknown error'
            });
            // Return default config
            return this.getDefaultConfig();
        }
    }

    /**
     * Get default configuration (fallback)
     */
    private getDefaultConfig(): AppConfig {
        return {
            europeanCountries: [
                'spain', 'france', 'germany', 'italy', 'poland', 'czech', 'austria',
                'hungary', 'portugal', 'greece', 'netherlands', 'belgium', 'sweden',
                'norway', 'denmark', 'finland', 'switzerland', 'croatia', 'serbia'
            ],
            nonEuropeanCountries: [
                'russia', 'moscow', 'petersburg', 'turkey', 'israel', 'usa',
                'canada', 'china', 'india', 'japan', 'australia'
            ],
            mediterraneanLocations: [
                'barcelona', 'valencia', 'alicante', 'malaga', 'marbella',
                'nice', 'cannes', 'monaco', 'marseille', 'monte carlo',
                'genoa', 'naples', 'sicily', 'rome', 'athens', 'split',
                'dubrovnik', 'malta', 'cyprus', 'limassol'
            ],
            countryCodes: {}
        };
    }

    /**
     * Extract location from text (city, country)
     */
    extractLocation(text: string): string {
        const parts = text.split(',').map(p => p.trim());
        return parts[0] || text;
    }

    /**
     * Parse date from various formats
     */
    parseDate(dateStr: string): Date {
        // Try ISO format first
        const isoDate = new Date(dateStr);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }

        // Try other formats
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
            /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match && match[1] && match[2] && match[3]) {
                try {
                    if (format === formats[0]) {
                        // YYYY-MM-DD
                        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                    } else {
                        // DD.MM.YYYY or DD/MM/YYYY
                        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                    }
                } catch {
                    continue;
                }
            }
        }

        // Default to today if parsing fails
        this.logger.warn('Failed to parse date, using current date', {
            dateString: dateStr,
            defaultDate: new Date().toISOString()
        });
        return new Date();
    }
}
