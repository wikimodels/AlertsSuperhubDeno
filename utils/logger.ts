import { CONFIG } from "../config.ts";
import { DColors } from "../models/types.ts";

class Logger {
  private projectName = CONFIG.PROJECT_NAME;

  /**
   * Logs an informational message.
   * @param message - The message to log.
   */
  public info(message: string, color: DColors): void {
    console.log(`%c[${this.projectName}] ${message}`, color);
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   */
  public warn(message: string, color: DColors): void {
    console.log(`%c[${this.projectName}]:${message}`, color);
  }

  /**
   * Logs an error message.
   * @param message - The error message to log.
   * @param error - (Optional) The error object to include in the log.
   */
  public error(message: string, error?: unknown): void {
    console.error(`%c[${this.projectName}]:${message}`, `color:${DColors.red}`);
    if (error) {
      console.error(`[${this.projectName}]:Error Details:`, error);
    }
  }

  /**
   * Logs a success message.
   * @param message - The message to log.
   */
  public success(message: string, color: DColors): void {
    console.log(`%c[${this.projectName}] ${message}`, color);
  }
}

// Export a singleton instance of the Logger
export const logger = new Logger();
