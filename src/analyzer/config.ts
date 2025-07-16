import { config } from "dotenv";
import { DmarcAnalyzerConfig } from "./types";

export function getConfig(): DmarcAnalyzerConfig {
    config();

    return {
        reportsDirectory: process.env.DMARC_REPORTS_DIR || process.argv[2] || "./reports",
        defaultHtmlTemplate: process.env.DMARC_DEFAULT_HTML_TEMPLATE || "report.html",
        templateDirectory: process.env.DMARC_HTML_TEMPLATE_DIR || process.argv[2] || "./templates",
        outputPath: process.env.DMARC_OUTPUT_PATH || process.argv[3] || "./dmarc-report.html",
        sortByTimestamp: process.env.DMARC_SORT_BY_TIMESTAMP !== "false",
        includeChart: process.env.DMARC_SORT_BY_TIMESTAMP !== "false",
        enableDnsLookups: process.env.DMARC_ENABLE_DNS_LOOKUPS !== "false"
    };
}
