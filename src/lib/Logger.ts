import { supportsColor } from "./supportsColor";

export enum LogLevel {
    Debug = "debug",
    Info = "info",
    Warn = "warn",
    Error = "error"
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    category?: string;
    data?: unknown;
}

export type LoggerCallback = (
    level: LogLevel,
    message: string,
    timestamp: Date,
    category?: string,
    data?: unknown
) => void;

export class Logger {
    private static instance: Logger;
    private logLevel: LogLevel = LogLevel.Debug;
    private logs: LogEntry[] = [];
    private maxLogs: number = 1000;
    private hasColorSupport: boolean;
    static callbacks: LoggerCallback[] = [];

    static addCallback(cbFunc: LoggerCallback): void {
        Logger.callbacks.push(cbFunc);
    }

    static removeCallback(cbFunc: LoggerCallback): void {
        const index = Logger.callbacks.indexOf(cbFunc);

        if (index !== -1) {
            Logger.callbacks.splice(index, 1);
        }
    }

    private constructor() {
        this.hasColorSupport = this.determineColorSupport();
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private determineColorSupport(): boolean {
        return supportsColor !== false;
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    setMaxLogs(max: number): void {
        this.maxLogs = max;
    }

    private getColorCode(level: LogLevel): { start: string; end: string } {
        if (!this.hasColorSupport) {
            return { start: "", end: "" };
        }

        const endColor = "\u001B[39m";
        let startColor = "";

        switch (level) {
            case LogLevel.Debug:
                startColor = "\u001B[90m"; // bright black (gray)
                break;
            case LogLevel.Info:
                startColor = "\u001B[34m"; // blue
                break;
            case LogLevel.Warn:
                startColor = "\u001B[33m"; // yellow
                break;
            case LogLevel.Error:
                startColor = "\u001B[31m"; // red
                break;
        }

        return { start: startColor, end: endColor };
    }

    private formatLogMessage(level: LogLevel, message: string, timestamp: Date, category?: string): string {
        const colors = this.getColorCode(level);
        const levelName = level.toUpperCase();
        const timestampStr = timestamp.toISOString().slice(0, 19).replace("T", " ");
        const categoryStr = category ? `[${category}] ` : "";

        if (this.hasColorSupport) {
            const timestampColor = "\u001B[36m"; // cyan
            const timestampEnd = "\u001B[39m";
            return `${colors.start}[${levelName}]${colors.end}${timestampColor} ${timestampStr}${timestampEnd} ${categoryStr}${message}`;
        }

        return `[${levelName}] ${timestampStr} ${categoryStr}${message}`;
    }

    private shouldSuppressLogging(): boolean {
        return process?.env?.SUPPRESS_CONSOLE_LOGGING === "true";
    }

    private log(level: LogLevel, message: string, category?: string, data?: unknown): void {
        if (level < this.logLevel) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            category,
            data
        };

        this.logs.push(entry);

        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Don't output to console if logging is suppressed
        if (this.shouldSuppressLogging()) {
            return;
        }

        // Output to console with color formatting
        const logMessage = this.formatLogMessage(level, message, entry.timestamp, category);

        switch (level) {
            case LogLevel.Debug:
                data ? console.debug(logMessage, data) : console.debug(logMessage);
                break;
            case LogLevel.Info:
                data ? console.info(logMessage, data) : console.info(logMessage);
                break;
            case LogLevel.Warn:
                data ? console.warn(logMessage, data) : console.warn(logMessage);
                break;
            case LogLevel.Error:
                data ? console.error(logMessage, data) : console.error(logMessage);
                break;
        }

        if (Logger.callbacks.length) {
            for (let i = 0; i < Logger.callbacks.length; i++) {
                Logger.callbacks[i](level, message, entry.timestamp, category, data);
            }
        }
    }

    debug(message: string, category?: string, data?: unknown): void {
        this.log(LogLevel.Debug, message, category, data);
    }

    info(message: string, category?: string, data?: unknown): void {
        this.log(LogLevel.Info, message, category, data);
    }

    warn(message: string, category?: string, data?: unknown): void {
        this.log(LogLevel.Warn, message, category, data);
    }

    error(message: string, category?: string, data?: unknown): void {
        this.log(LogLevel.Error, message, category, data);
    }

    getLogs(level?: LogLevel, category?: string): LogEntry[] {
        return this.logs.filter((log) => {
            if (level !== undefined && log.level !== level) {
                return false;
            }
            if (category !== undefined && log.category !== category) {
                return false;
            }
            return true;
        });
    }

    clearLogs(): void {
        this.logs = [];
    }

    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}

// Create a default logger instance for easy access
export const logger = Logger.getInstance();
