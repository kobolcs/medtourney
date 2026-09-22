/**
 * CacheManager - Handles all localStorage caching operations
 *
 * Provides versioned caching with TTL (Time To Live) support for:
 * - Tournament data
 * - Application configuration
 * - User preferences (theme, filters)
 */

import packageJson from '../../package.json';
import { Logger } from '../utils/Logger';

interface CachedData<T> {
    data: T;
    timestamp: number;
    version: string;
}

export class CacheManager {
    // Automatically sync with package.json version
    private readonly CACHE_VERSION = packageJson.version;
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private logger = Logger.createScoped('CacheManager');

    readonly CACHE_KEYS = {
        TOURNAMENTS: 'medtourney_tournaments',
        CONFIG: 'medtourney_config',
        THEME: 'medtourney_theme',
        FILTERS_COLLAPSED: 'medtourney_filters_collapsed',
        FILTER_PREFERENCES: 'medtourney_filter_preferences'
    } as const;

    /**
     * Save data to localStorage with version and timestamp
     */
    saveToCache<T>(key: string, data: T): void {
        try {
            const cachedData: CachedData<T> = {
                data,
                timestamp: Date.now(),
                version: this.CACHE_VERSION
            };
            localStorage.setItem(key, JSON.stringify(cachedData));
            this.logger.debug('Saved to cache', { key, version: this.CACHE_VERSION });
        } catch (err) {
            this.logger.warn('Failed to save to cache', {
                key,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    /**
     * Load data from localStorage with version check and TTL validation
     */
    loadFromCache<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const cachedData = JSON.parse(item) as CachedData<T>;

            // Version check
            if (cachedData.version !== this.CACHE_VERSION) {
                this.logger.info('Cache version mismatch, clearing cache', {
                    key,
                    cachedVersion: cachedData.version,
                    currentVersion: this.CACHE_VERSION
                });
                localStorage.removeItem(key);
                return null;
            }

            // TTL check
            const age = Date.now() - cachedData.timestamp;
            if (age > this.CACHE_DURATION) {
                this.logger.info('Cache expired, clearing cache', {
                    key,
                    ageMinutes: Math.round(age / 1000 / 60),
                    maxAgeMinutes: Math.round(this.CACHE_DURATION / 1000 / 60)
                });
                localStorage.removeItem(key);
                return null;
            }

            this.logger.debug('Loaded from cache', { key, ageMinutes: Math.round(age / 1000 / 60) });
            return cachedData.data;
        } catch (err) {
            this.logger.warn('Failed to load from cache', {
                key,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
            return null;
        }
    }

    /**
     * Clear specific cache entry
     */
    clearCache(key: string): void {
        try {
            localStorage.removeItem(key);
            this.logger.debug('Cleared cache entry', { key });
        } catch (err) {
            this.logger.warn('Failed to clear cache', {
                key,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    /**
     * Clear all application caches
     */
    clearAllCaches(): void {
        Object.values(this.CACHE_KEYS).forEach(key => this.clearCache(key));
        this.logger.info('Cleared all caches');
    }

    /**
     * Get theme preference from cache
     */
    getThemePreference(): string | null {
        return this.loadFromCache<string>(this.CACHE_KEYS.THEME);
    }

    /**
     * Save theme preference to cache
     */
    saveThemePreference(theme: string): void {
        this.saveToCache(this.CACHE_KEYS.THEME, theme);
    }

    /**
     * Get filters collapsed state
     */
    getFiltersCollapsed(): boolean {
        return this.loadFromCache<boolean>(this.CACHE_KEYS.FILTERS_COLLAPSED) === true;
    }

    /**
     * Save filters collapsed state
     */
    saveFiltersCollapsed(collapsed: boolean): void {
        this.saveToCache(this.CACHE_KEYS.FILTERS_COLLAPSED, collapsed);
    }

    /**
     * Get filter preferences
     */
    getFilterPreferences(): Record<string, boolean> | null {
        return this.loadFromCache<Record<string, boolean>>(this.CACHE_KEYS.FILTER_PREFERENCES);
    }

    /**
     * Save filter preferences
     */
    saveFilterPreferences(preferences: Record<string, boolean>): void {
        this.saveToCache(this.CACHE_KEYS.FILTER_PREFERENCES, preferences);
    }

    /**
     * Get current cache version (for debugging)
     */
    getCacheVersion(): string {
        return this.CACHE_VERSION;
    }
}
