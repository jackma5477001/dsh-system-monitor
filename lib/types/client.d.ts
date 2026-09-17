/**
 * dsh-system-monitor client bundle.
 *
 * Registers a full-width line into the `conversation.session.header.utilities`
 * slot and moves its DOM node below the header title row, showing the host
 * machine's live CPU and memory usage (polled every 5 seconds).
 */
export declare const inject: string[];
export declare function apply(ctx: unknown): void;
