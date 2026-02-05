/**
 * Simple logger interface.
 */

export type Logger = (message: string, data?: unknown) => void;

const defaultLogger: Logger = (message, data) => {
  if (data !== undefined) {
    console.info(`[statsig] ${message}`, data);
  } else {
    console.info(`[statsig] ${message}`);
  }
};

let currentLogger: Logger = defaultLogger;

/**
 * Set a custom logger implementation.
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

/**
 * Get the current logger instance.
 */
export function getLogger(): Logger {
  return currentLogger;
}
