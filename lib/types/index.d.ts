import type {} from "@deepseek-ai/cordis";
/**
 * dsh-system-monitor host plugin.
 *
 * Samples the host machine's CPU and memory usage every 5 seconds and
 * serves the latest snapshot at GET /api/dsh-system-monitor/stats.
 */
export declare const inject: string[];
export declare function apply(ctx: unknown): void;
