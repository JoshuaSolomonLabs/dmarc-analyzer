import { logger } from "./lib/Logger";
import { attachProcessErrorLoggers, removeDeprecationWarnings } from "./lib/process";
import { pathToFileURL } from "node:url";
import { generateDefaultReport } from "./analyzer/generate";

removeDeprecationWarnings();
attachProcessErrorLoggers();

/*
 * Will generate a default report.
 */
async function main(): Promise<void> {
    logger.info("Generating a default DMARC report", "Process");

    try {
        await generateDefaultReport();
    } catch (error) {
        logger.error("An error occured during default DMARC report generation:", "Process", error);
    }

    logger.info("Completed", "Process");

    const exitTimeout = setTimeout(() => {
        process.exit(0);
    }, 5000);
    exitTimeout.unref();
}

// Handle both ESM and CommonJS execution
if (
    typeof import.meta?.url === "string" &&
    (import.meta.main === true || import.meta.url === pathToFileURL(process.argv[1]).href)
) {
    main();
} else if (typeof __dirname !== "undefined") {
    if (require.main === module) {
        main();
    }
}
