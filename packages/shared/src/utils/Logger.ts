/**
 * Logging System
 * 
 * Provides consistent logging across all systems with context, formatting, and filtering.
 * Supports multiple log levels, system-specific logging, and player action tracking.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SYSTEM = 4,
  TEST = 5
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  system?: string;
  playerId?: string;
  error?: Error;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableSystemLogs: boolean;
  enablePlayerLogs: boolean;
  enableTestLogs: boolean;
  maxLogEntries: number;
  logFilePath?: string;
}

class LoggerImpl {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private systemStats = new Map<string, { errors: number; warnings: number; messages: number }>();
  private playerStats = new Map<string, { actions: number; errors: number; warnings: number }>();

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableSystemLogs: true,
      enablePlayerLogs: true,
      enableTestLogs: true,
      maxLogEntries: 10000,
      ...config
    };

    // Set up periodic log cleanup
    setInterval(() => this.cleanupLogs(), 300000); // Every 5 minutes
  }

  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, { ...context }, error);
  }

  public system(systemName: string, message: string, context?: Record<string, unknown>): void {
    if (!this.config.enableSystemLogs) return;

    // Update system stats
    const stats = this.systemStats.get(systemName) || { errors: 0, warnings: 0, messages: 0 };
    stats.messages++;
    this.systemStats.set(systemName, stats);

    this.log(LogLevel.SYSTEM, `[${systemName}] ${message}`, context, undefined, systemName);
  }

  public systemError(systemName: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.config.enableSystemLogs) return;

    // Update system stats
    const stats = this.systemStats.get(systemName) || { errors: 0, warnings: 0, messages: 0 };
    stats.errors++;
    this.systemStats.set(systemName, stats);

    this.log(LogLevel.ERROR, `[${systemName}] ${message}`, context, error, systemName);
  }

  public systemWarn(systemName: string, message: string, context?: Record<string, unknown>): void {
    if (!this.config.enableSystemLogs) return;

    // Update system stats
    const stats = this.systemStats.get(systemName) || { errors: 0, warnings: 0, messages: 0 };
    stats.warnings++;
    this.systemStats.set(systemName, stats);

    this.log(LogLevel.WARN, `[${systemName}] ${message}`, context, undefined, systemName);
  }

  public player(playerId: string, message: string, context?: Record<string, unknown>): void {
    if (!this.config.enablePlayerLogs) return;

    // Update player stats
    const stats = this.playerStats.get(playerId) || { actions: 0, errors: 0, warnings: 0 };
    stats.actions++;
    this.playerStats.set(playerId, stats);

    this.log(LogLevel.INFO, `[Player:${playerId}] ${message}`, context, undefined, undefined, playerId);
  }

  public playerError(playerId: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.config.enablePlayerLogs) return;

    // Update player stats
    const stats = this.playerStats.get(playerId) || { actions: 0, errors: 0, warnings: 0 };
    stats.errors++;
    this.playerStats.set(playerId, stats);

    this.log(LogLevel.ERROR, `[Player:${playerId}] ${message}`, context, error, undefined, playerId);
  }

  public playerWarn(playerId: string, message: string, context?: Record<string, unknown>): void {
    if (!this.config.enablePlayerLogs) return;

    // Update player stats
    const stats = this.playerStats.get(playerId) || { actions: 0, errors: 0, warnings: 0 };
    stats.warnings++;
    this.playerStats.set(playerId, stats);

    this.log(LogLevel.WARN, `[Player:${playerId}] ${message}`, context, undefined, undefined, playerId);
  }

  public test(testName: string, message: string, context?: Record<string, unknown>): void {
    if (!this.config.enableTestLogs) return;
    this.log(LogLevel.TEST, `[TEST:${testName}] ${message}`, context);
  }

  public testError(testName: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.config.enableTestLogs) return;
    this.log(LogLevel.ERROR, `[TEST:${testName}] ${message}`, context, error);
  }

  public testResult(testName: string, passed: boolean, details?: string): void {
    if (!this.config.enableTestLogs) return;
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const message = details ? `${status} - ${details}` : status;
    this.log(LogLevel.TEST, `[TEST:${testName}] ${message}`);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    system?: string,
    playerId?: string
  ): void {
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      error,
      system,
      playerId
    };

    // Add to log buffer
    this.logs.push(entry);

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // File output (if enabled and path provided)
    if (this.config.enableFile && this.config.logFilePath) {
      this.outputToFile(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const logMessage = `[${timestamp}] ${entry.message}${contextStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
      case LogLevel.SYSTEM:
      case LogLevel.TEST:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        if (entry.error) {
          console.error(logMessage, entry.error);
        } else {
          console.error(logMessage);
        }
        break;
    }
  }

  private outputToFile(_entry: LogEntry): void {
    // File logging implementation would go here
    // For now, just store in memory (could be enhanced with fs writes)
  }

  private cleanupLogs(): void {
    if (this.logs.length > this.config.maxLogEntries) {
      const excessLogs = this.logs.length - this.config.maxLogEntries;
      this.logs.splice(0, excessLogs);
    }
  }

  // Analytics and reporting methods
  public getSystemStats(): Map<string, { errors: number; warnings: number; messages: number }> {
    return new Map(this.systemStats);
  }

  public getPlayerStats(): Map<string, { actions: number; errors: number; warnings: number }> {
    return new Map(this.playerStats);
  }

  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  public getErrorLogs(count: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.level === LogLevel.ERROR)
      .slice(-count);
  }

  public getSystemLogs(systemName: string, count: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.system === systemName)
      .slice(-count);
  }

  public getPlayerLogs(playerId: string, count: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.playerId === playerId)
      .slice(-count);
  }

  public getTestLogs(count: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.level === LogLevel.TEST)
      .slice(-count);
  }

  public generateReport(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    systemStats: Record<string, { errors: number; warnings: number; messages: number }>;
    playerStats: Record<string, { actions: number; errors: number; warnings: number }>;
    recentErrors: LogEntry[];
  } {
    const logsByLevel: Record<string, number> = {};
    
    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      logsByLevel[levelName] = (logsByLevel[levelName] || 0) + 1;
    }

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      systemStats: Object.fromEntries(this.systemStats),
      playerStats: Object.fromEntries(this.playerStats),
      recentErrors: this.getErrorLogs(10)
    };
  }

  public clearLogs(): void {
    this.logs = [];
    this.systemStats.clear();
    this.playerStats.clear();
  }

  public setLogLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  public isLevelEnabled(level: LogLevel): boolean {
    return level >= this.config.minLevel;
  }
}

// Export singleton instance
export const Logger = new LoggerImpl();

// Export logger interface for systems to use
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  system(systemName: string, message: string, context?: Record<string, unknown>): void;
  systemError(systemName: string, message: string, error?: Error, context?: Record<string, unknown>): void;
  systemWarn(systemName: string, message: string, context?: Record<string, unknown>): void;
  player(playerId: string, message: string, context?: Record<string, unknown>): void;
  playerError(playerId: string, message: string, error?: Error, context?: Record<string, unknown>): void;
  playerWarn(playerId: string, message: string, context?: Record<string, unknown>): void;
  test(testName: string, message: string, context?: Record<string, unknown>): void;
  testError(testName: string, message: string, error?: Error, context?: Record<string, unknown>): void;
  testResult(testName: string, passed: boolean, details?: string): void;
}

// Convenience logger for systems
export class SystemLogger {
  constructor(private systemName: string) {}

  debug(message: string, context?: Record<string, unknown>): void {
    Logger.debug(`[${this.systemName}] ${message}`, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    Logger.system(this.systemName, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    Logger.systemWarn(this.systemName, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    Logger.systemError(this.systemName, message, error, context);
  }

  player(playerId: string, message: string, context?: Record<string, unknown>): void {
    Logger.player(playerId, `[${this.systemName}] ${message}`, context);
  }

  playerError(playerId: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    Logger.playerError(playerId, `[${this.systemName}] ${message}`, error, context);
  }

  playerWarn(playerId: string, message: string, context?: Record<string, unknown>): void {
    Logger.playerWarn(playerId, `[${this.systemName}] ${message}`, context);
  }
}

// Environment-based configuration
if (typeof process !== 'undefined' && process.env) {
  const logLevel = process.env.LOG_LEVEL;
  if (logLevel) {
    const level = LogLevel[logLevel as keyof typeof LogLevel];
    if (level !== undefined) {
      Logger.setLogLevel(level);
    }
  }

  // Configure based on environment
  if (process.env.NODE_ENV === 'production') {
    Logger.configure({
      minLevel: LogLevel.WARN,
      enableFile: true,
      enableConsole: false
    });
  } else if (process.env.NODE_ENV === 'test') {
    Logger.configure({
      minLevel: LogLevel.ERROR,
      enableConsole: false,
      enableTestLogs: true
    });
  } else {
    // Development environment
    Logger.configure({
      minLevel: LogLevel.DEBUG,
      enableConsole: true,
      enableSystemLogs: true,
      enablePlayerLogs: true,
      enableTestLogs: true
    });
  }
}

export default Logger;