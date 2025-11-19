/**
 * DataService - Handles data fetching and API operations
 *
 * Provides:
 * - Tournament data loading from multiple sources
 * - Configuration loading
 * - CORS proxy fallback strategy
 * - Error handling and retries
 */

import { Tournament, AppConfig } from '../types';
import { CacheManager } from './CacheManager';

export class DataService {
    private readonly corsProxies: string[];
    private cacheManager: CacheManager;

    constructor(cacheManager: CacheManager) {
        this.cacheManager = cacheManager;
        this.corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            '' // Direct fetch (may fail due to CORS)
        ];
    }

    /**
     * Fetch tournaments from various sources with fallback strategy
     */
    async fetchTournaments(): Promise<Tournament[]> {
        // Strategy 0: Try to load from cache first
        const cachedTournaments = this.cacheManager.loadFromCache<Array<Omit<Tournament, 'date'> & { date: string }>>(
            this.cacheManager.CACHE_KEYS.TOURNAMENTS
        );
        if (cachedTournaments && cachedTournaments.length > 0) {
            console.log(`✓ Loaded ${cachedTournaments.length} tournaments from cache`);
            return cachedTournaments.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
        }

        // Strategy 1: Try to load tournaments_data.json from repository
        try {
            const dataUrl = 'tournaments_data.json';
            const response = await fetch(dataUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                    console.log(`✓ Loaded ${rawTournaments.length} tournaments from local data file`);
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
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.warn('Could not load local data file:', errorMessage);
        }

        // Strategy 2: Try CORS proxies with fallback
        for (const proxy of this.corsProxies) {
            try {
                const url = `${proxy}https://raw.githubusercontent.com/kobolcs/medtourney/main/tournaments_data.json`;
                console.log(`Trying to fetch from GitHub via proxy: ${proxy || 'direct'}`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const rawTournaments = await response.json() as Array<Omit<Tournament, 'date'> & { date: string }>;
                    if (Array.isArray(rawTournaments) && rawTournaments.length > 0) {
                        console.log(`✓ Loaded ${rawTournaments.length} tournaments from GitHub`);
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
                console.warn(`Failed to fetch via proxy ${proxy}:`, err);
                continue; // Try next proxy
            }
        }

        // All strategies failed
        throw new Error('Failed to load tournament data from all sources');
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
            console.log('✓ Loaded config from cache');
            return cachedConfig;
        }

        try {
            const response = await fetch('config.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const config = await response.json() as AppConfig;

            // Save to cache
            this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.CONFIG, config);

            console.log('✓ Loaded config from file');
            return config;
        } catch (err) {
            console.error('Failed to load config.json:', err);
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
        console.warn(`Failed to parse date: ${dateStr}`);
        return new Date();
    }
}
