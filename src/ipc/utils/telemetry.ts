import { BrowserWindow } from "electron";
import log from "electron-log";
import {
  DyadError,
  isDyadErrorKindFilteredFromTelemetry,
} from "@/errors/dyad_error";
import { isGenericFetchFailedError } from "@/lib/posthogTelemetry";
import { TelemetryEventPayload } from "@/ipc/types";

const logger = log.scope("telemetry");
const FILTERED_EXCEPTION_MESSAGES = new Set([
  "Supabase access token not found. Please authenticate first.",
]);

/**
 * Sends a telemetry event from the main process to the renderer,
 * where PostHog can capture it.
 */
export function sendTelemetryEvent(
  _eventName: string,
  _properties?: Record<string, unknown>,
): void {}

export function sendTelemetryEventToWindow(
  _target: BrowserWindow,
  _eventName: string,
  _properties?: Record<string, unknown>,
): void {}

export function sendTelemetryException(
  _error: unknown,
  _context?: Record<string, unknown>,
): void {}

export function shouldFilterTelemetryException(error: unknown): boolean {
  if (error instanceof DyadError) {
    return isDyadErrorKindFilteredFromTelemetry(error.kind);
  }

  if (
    error instanceof Error &&
    error.name === "RateLimitError" &&
    error.message.includes("(429)")
  ) {
    return true;
  }

  if (
    error instanceof Error &&
    isGenericFetchFailedError(error.name, error.message)
  ) {
    return true;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  return FILTERED_EXCEPTION_MESSAGES.has(message);
}
