/**
 * DataService - Handles data fetching and API operations
 *
 * Provides:
 * - Tournament data loading from multiple sources
 * - Configuration loading
 * - GitHub API integration (no CORS proxies needed)
 * - Error handling with detailed context
 */

import { Tournament, AppConfig } from '../types';
import { CacheManager } from './CacheManager';
import { Logger } from '../utils/Logger';

export class DataService {
    private readonly githubRepo = 'kobolcs/medtourney';
    private readonly githubBranch = 'main';
    private cacheManager: CacheManager;
    private logger = Logger.createScoped('DataService');

    constructor(cacheManager: CacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * Fetch tournaments from various sources with fallback strategy
     * Order: Cache → Local file → GitHub Pages → GitHub API
     */
    async fetchTournaments(): Promise<Tournament[]> {
        const fetchStartTime = Date.now();

        // Strategy 1: Try to load from cache first
        const cachedTournaments = this.cacheManager.loadFromCache<Array<Omit<Tournament, 'date'> & { date: string }>>(
            this.cacheManager.CACHE_KEYS.TOURNAMENTS
        );
        if (cachedTournaments && cachedTournaments.length > 0) {
            this.logger.info('Loaded tournaments from cache', {
                count: cachedTournaments.length,
                loadTime: Date.now() - fetchStartTime
            });
            return cachedTournaments.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
        }

        // Strategy 2: Try to load tournaments_data.json from same origin (GitHub Pages)
        try {
            const dataUrl = 'tournaments_data.json';
            this.logger.debug('Fetching from local file', { url: dataUrl });

            const response = await fetch(dataUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    this.logger.info('Loaded tournaments from local file', {
                        count: rawTournaments.length,
                        loadTime: Date.now() - fetchStartTime
                    });
                    // Save to cache
                    this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, rawTournaments);
                    // Convert date strings to Date objects
                    return rawTournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            }
        } catch (err) {
            this.logger.warn('Could not load local data file', {
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }

        // Strategy 3: Try GitHub Pages raw URL (usually same origin, no CORS)
        try {
            const pagesUrl = `https://${this.githubRepo.split('/')[0]}.github.io/${this.githubRepo.split('/')[1]}/tournaments_data.json`;
            this.logger.debug('Fetching from GitHub Pages', { url: pagesUrl });

            const response = await fetch(pagesUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    this.logger.info('Loaded tournaments from GitHub Pages', {
                        count: rawTournaments.length,
                        loadTime: Date.now() - fetchStartTime
                    });
                    this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, rawTournaments);
                    return rawTournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            }
        } catch (err) {
            this.logger.warn('Could not load from GitHub Pages', {
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }

        // Strategy 4: Try GitHub API directly (no CORS proxy needed)
        try {
            const apiUrl = `https://api.github.com/repos/${this.githubRepo}/contents/tournaments_data.json?ref=${this.githubBranch}`;
            this.logger.debug('Fetching from GitHub API', { url: apiUrl });

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github.v3.raw' // Get raw content, not base64
                }
            });

            if (response.ok) {
                const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    this.logger.info('Loaded tournaments from GitHub API', {
                        count: rawTournaments.length,
                        loadTime: Date.now() - fetchStartTime
                    });
                    this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, rawTournaments);
                    return rawTournaments.map(t => ({
                        ...t,
                        date: new Date(t.date)
                    }));
                }
            } else {
                this.logger.error('GitHub API returned error status', undefined, {
                    status: response.status,
                    statusText: response.statusText
                });
            }
        } catch (err) {
            this.logger.error('Failed to fetch from GitHub API', err, {
                repo: this.githubRepo,
                branch: this.githubBranch
            });
        }

        // All strategies failed
        const error = new Error('Failed to load tournament data from all sources (cache, local file, GitHub Pages, GitHub API)');
        this.logger.error('All fetch strategies failed', error, {
            attemptedSources: ['cache', 'local', 'github-pages', 'github-api'],
            totalTime: Date.now() - fetchStartTime
        });
        throw error;
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

            const config = await response.json() as AppConfig;

            // Save to cache
            this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.CONFIG, config);

            this.logger.info('Loaded config from file', {
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
