/**
 * Logger - Structured logging utility with log levels
 *
 * Provides centralized logging with environment-aware behavior:
 * - Development: Logs to console with full details
 * - Production: Only logs errors (can be extended to send to monitoring service)
 *
 * Usage:
 *   Logger.debug('Operation started', { userId: 123 });
 *   Logger.info('Tournament loaded', { count: 50 });
 *   Logger.warn('Cache miss', { key: 'tournaments' });
 *   Logger.error('Fetch failed', error, { url: '...' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    timestamp: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, unknown>;
    error?: Error;
}

// Vite injects this at build time, defaults to true for safety
declare const __DEV__: boolean | undefined;

export class Logger {
    // In production, Terser will remove console.* calls anyway
    // This provides additional runtime control for info/debug
    private static isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
    private static isProduction = !Logger.isDevelopment;

    /**
     * Log debug information (development only)
     */
    static debug(message: string, metadata?: Record<string, unknown>): void {
        if (this.isDevelopment) {
            this.log('debug', message, metadata);
        }
    }

    /**
     * Log informational messages
     */
    static info(message: string, metadata?: Record<string, unknown>): void {
        if (this.isDevelopment) {
            this.log('info', message, metadata);
        }
    }

    /**
     * Log warnings
     */
    static warn(message: string, metadata?: Record<string, unknown>): void {
        this.log('warn', message, metadata);
    }

    /**
     * Log errors (always logged, even in production)
     */
    static error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
        const errorObj = error instanceof Error ? error : undefined;
        this.log('error', message, metadata, errorObj);

        // In production, send to monitoring service (optional)
        if (this.isProduction && errorObj) {
            this.sendToMonitoring({
                timestamp: new Date().toISOString(),
                level: 'error',
                message,
                metadata,
                error: errorObj
            });
        }
    }

    /**
     * Internal logging method
     */
    private static log(
        level: LogLevel,
        message: string,
        metadata?: Record<string, unknown>,
        error?: Error
    ): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        const consoleMethod = this.getConsoleMethod(level);

        if (metadata || error) {
            consoleMethod(`${prefix} ${message}`, {
                ...(metadata && { metadata }),
                ...(error && {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    }
                })
            });
        } else {
            consoleMethod(`${prefix} ${message}`);
        }
    }

    /**
     * Get appropriate console method for log level
     */
    private static getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
        switch (level) {
            case 'debug':
                return console.debug;
            case 'info':
                return console.info;
            case 'warn':
                return console.warn;
            case 'error':
                return console.error;
            default:
                return console.log;
        }
    }

    /**
     * Send error to monitoring service (placeholder for production)
     * Integrate with services like Sentry, LogRocket, Datadog, etc.
     */
    private static sendToMonitoring(logContext: LogContext): void {
        // Placeholder for production error monitoring
        // Example integrations:
        //
        // Sentry:
        // Sentry.captureException(logContext.error, {
        //     level: 'error',
        //     extra: logContext.metadata
        // });
        //
        // Custom API:
        // fetch('/api/logs', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(logContext)
        // });

        // For now, we'll just ensure errors are logged to console even in prod
        console.error('Error logged:', logContext);
    }

    /**
     * Create a scoped logger with automatic context
     */
    static createScoped(scope: string): ScopedLogger {
        return new ScopedLogger(scope);
    }
}

/**
 * Scoped logger that automatically includes context in all log calls
 */
class ScopedLogger {
    constructor(private scope: string) {}

    debug(message: string, metadata?: Record<string, unknown>): void {
        Logger.debug(message, { ...metadata, scope: this.scope });
    }

    info(message: string, metadata?: Record<string, unknown>): void {
        Logger.info(message, { ...metadata, scope: this.scope });
    }

    warn(message: string, metadata?: Record<string, unknown>): void {
        Logger.warn(message, { ...metadata, scope: this.scope });
    }

    error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
        Logger.error(message, error, { ...metadata, scope: this.scope });
    }
}
