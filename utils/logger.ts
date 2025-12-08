// src/utils/logger.ts
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { DColors } from "../models/types.ts";

const env = await load();
const PROJECT_NAME = env["PROJECT_NAME"] || "Alerts-SuperHub-Deno";

class Logger {
  private projectName = PROJECT_NAME;

  private formatMsg(message: string): string {
    return `[${this.projectName}]: ${message}`;
  }

  /**
   * Logs an informational message.
   */
  public info(message: string, color: DColors = DColors.white): void {
    // ЗАЩИТА: Если цвет undefined, используем белый
    const safeColor = color || "color: white";
    console.log(`%c${this.formatMsg(message)}`, safeColor);
  }

  /**
   * Logs a warning message.
   */
  public warn(message: string, color: DColors = DColors.yellow): void {
    const safeColor = color || "color: yellow";
    console.log(`%c${this.formatMsg(message)}`, safeColor);
  }

  /**
   * Logs a success message.
   */
  public success(message: string, color: DColors = DColors.green): void {
    const safeColor = color || "color: green";
    console.log(`%c${this.formatMsg(message)}`, safeColor);
  }

  /**
   * Logs an error message.
   */
  public error(message: string, error?: unknown): void {
    console.error(`%c${this.formatMsg(message)}`, "color: red");
    if (error) {
      console.error(error);
    }
  }
}

export const logger = new Logger();
