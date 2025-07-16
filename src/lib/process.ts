import { sleep } from "./promises";
import { logger } from "./Logger";

export function removeDeprecationWarnings(): void {
    process.removeAllListeners("warning");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attachedProcessListeners: [string, (...args: any[]) => Promise<void> | void][] = [];
const registeredCallbacks = new Set<WeakRef<() => Promise<void> | void>>();

export function attachExitHandlers(cb?: () => Promise<void> | void, forceExitDelay = 60000): void {
    if (!cb) {
        return;
    }

    registeredCallbacks.add(new WeakRef(cb));

    let didExit = false;
    function trapEvent(event: string): void {
        const handler = async (): Promise<void> => {
            if (!didExit) {
                logger.info(`CAUGHT ${event}`, "Process");
                didExit = true;

                // Execute all registered callbacks that are still alive
                const deadRefs: WeakRef<() => Promise<void> | void>[] = [];
                for (const weakRef of registeredCallbacks) {
                    const callback = weakRef.deref();
                    if (callback) {
                        try {
                            await callback();
                        } catch (err) {
                            logger.error(`error in exit handler during ${event}`, "Process", err);
                        }
                    } else {
                        deadRefs.push(weakRef);
                    }
                }

                // Clean up dead references
                for (const deadRef of deadRefs) {
                    registeredCallbacks.delete(deadRef);
                }

                await sleep(250);

                logger.info(`finished trap ${event}`, "Process");
                if (forceExitDelay > -1) {
                    const timeout = setTimeout(() => process.exit(0), forceExitDelay);
                    timeout.unref();
                }
            }
        };

        // Only attach event listeners once
        if (attachedProcessListeners.length === 0) {
            process.on(event, handler);
            attachedProcessListeners.push([event, handler]);
        }
    }

    // Only set up event listeners on first registration
    if (attachedProcessListeners.length === 0) {
        trapEvent("SIGINT");
        trapEvent("SIGHUP");
        if (process.platform === "win32") {
            trapEvent("SIGBREAK");
            trapEvent("SIGTERM");
        } else {
            trapEvent("SIGTERM");
        }
        trapEvent("beforeExit");
    }
}

export function removeExitHandler(callbackRef: WeakRef<() => Promise<void> | void>): boolean {
    return registeredCallbacks.delete(callbackRef);
}

export function removeAllExitHandlers(): void {
    registeredCallbacks.clear();

    for (const [event, handler] of attachedProcessListeners) {
        process.removeListener(event, handler);
    }
    attachedProcessListeners.length = 0;
}

export function getRegisteredExitHandlerCount(): number {
    return registeredCallbacks.size;
}

export function cleanupDeadReferences(): number {
    const deadRefs: WeakRef<() => Promise<void> | void>[] = [];
    for (const weakRef of registeredCallbacks) {
        if (!weakRef.deref()) {
            deadRefs.push(weakRef);
        }
    }

    for (const deadRef of deadRefs) {
        registeredCallbacks.delete(deadRef);
    }

    return deadRefs.length;
}

let didAttachProcessErrorLoggers = false;
/*
 * Catch and log anything that might be uncaught at the process level.
 */
export function attachProcessErrorLoggers(): void {
    if (!didAttachProcessErrorLoggers) {
        process.on("uncaughtException", (err) => {
            if (err instanceof Error) {
                logger.error(`unhandled exception \n${err.stack}`);
            } else {
                logger.error(`unhandled exception \n${err}`);
            }
        });

        process.on("unhandledRejection", (err) => {
            if (err instanceof Error) {
                logger.error(`unhandled rejection \n${err.stack}`);
            } else {
                logger.error(`unhandled rejection \n${err}`);
            }
        });

        didAttachProcessErrorLoggers = true;
    }
}
