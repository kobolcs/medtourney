export class Logger {
    static debug(message, metadata) {
        if (this.isDevelopment) {
            this.log('debug', message, metadata);
        }
    }
    static info(message, metadata) {
        if (this.isDevelopment) {
            this.log('info', message, metadata);
        }
    }
    static warn(message, metadata) {
        this.log('warn', message, metadata);
    }
    static error(message, error, metadata) {
        const errorObj = error instanceof Error ? error : undefined;
        this.log('error', message, metadata, errorObj);
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
    static log(level, message, metadata, error) {
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
        }
        else {
            consoleMethod(`${prefix} ${message}`);
        }
    }
    static getConsoleMethod(level) {
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
    static sendToMonitoring(logContext) {
        console.error('Error logged:', logContext);
    }
    static createScoped(scope) {
        return new ScopedLogger(scope);
    }
}
Logger.isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
Logger.isProduction = !Logger.isDevelopment;
class ScopedLogger {
    constructor(scope) {
        this.scope = scope;
    }
    debug(message, metadata) {
        Logger.debug(message, { ...metadata, scope: this.scope });
    }
    info(message, metadata) {
        Logger.info(message, { ...metadata, scope: this.scope });
    }
    warn(message, metadata) {
        Logger.warn(message, { ...metadata, scope: this.scope });
    }
    error(message, error, metadata) {
        Logger.error(message, error, { ...metadata, scope: this.scope });
    }
}
//# sourceMappingURL=Logger.js.map