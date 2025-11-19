/**
 * CacheManager - Handles all localStorage caching operations
 *
 * Provides versioned caching with TTL (Time To Live) support for:
 * - Tournament data
 * - Application configuration
 * - User preferences (theme, filters)
 */

interface CachedData<T> {
    data: T;
    timestamp: number;
    version: string;
}

export class CacheManager {
    private readonly CACHE_VERSION = '2.3.0';
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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
        } catch (err) {
            console.warn(`Failed to save to cache (${key}):`, err);
        }
    }

    /**
     * Load data from localStorage with version check and TTL validation
     */
    loadFromCache<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const cachedData: CachedData<T> = JSON.parse(item);

            // Version check
            if (cachedData.version !== this.CACHE_VERSION) {
                console.log(`Cache version mismatch for ${key}. Clearing...`);
                localStorage.removeItem(key);
                return null;
            }

            // TTL check
            const age = Date.now() - cachedData.timestamp;
            if (age > this.CACHE_DURATION) {
                console.log(`Cache expired for ${key} (age: ${Math.round(age / 1000 / 60)} minutes)`);
                localStorage.removeItem(key);
                return null;
            }

            return cachedData.data;
        } catch (err) {
            console.warn(`Failed to load from cache (${key}):`, err);
            return null;
        }
    }

    /**
     * Clear specific cache entry
     */
    clearCache(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (err) {
            console.warn(`Failed to clear cache (${key}):`, err);
        }
    }

    /**
     * Clear all application caches
     */
    clearAllCaches(): void {
        Object.values(this.CACHE_KEYS).forEach(key => this.clearCache(key));
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
        const collapsed = this.loadFromCache<string>(this.CACHE_KEYS.FILTERS_COLLAPSED);
        return collapsed === 'true';
    }

    /**
     * Save filters collapsed state
     */
    saveFiltersCollapsed(collapsed: boolean): void {
        localStorage.setItem(this.CACHE_KEYS.FILTERS_COLLAPSED, collapsed.toString());
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
}
