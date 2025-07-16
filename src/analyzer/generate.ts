import { getConfig } from "./config";
import { BigDecimal } from "../lib/BigDecimal";
import { logger } from "../lib/Logger";
import { DmarcAnalyzer } from "../reports/DmarcAnalyzer";
import { DmarcReportLoaderParser } from "../reports/DmarcReportLoaderParser";
import { ReportGenerator } from "../reports/ReportGenerator";
import { writeFile } from "node:fs/promises";

export async function generateDefaultReport(): Promise<void> {
    const config = getConfig();

    logger.info("Starting DMARC analysis", "Process");
    logger.info(`Reports directory: ${config.reportsDirectory}`, "Process");
    logger.info(`Output path: ${config.outputPath}`, "Process");
    logger.info(`Sort by timestamp: ${config.sortByTimestamp}`, "Process");

    // Load
    const records = await DmarcReportLoaderParser.processDirectory(config.reportsDirectory, config.sortByTimestamp);

    // Analyze
    const analysis = await DmarcAnalyzer.analyze(records, config.enableDnsLookups);

    const html = await ReportGenerator.generateHtmlReport(analysis, config.templateDirectory, config.includeChart);

    await writeFile(config.outputPath, html, "utf8");
    logger.info(`HTML report generated: ${config.outputPath}`, "Process");

    logger.info(
        `Analysis complete. Processed ${analysis.totalReports} reports covering ${analysis.totalMessages.toLocaleString()} messages`,
        "Process"
    );

    const passedMessages = new BigDecimal(analysis.passedMessages);
    const quarantinedMessages = new BigDecimal(analysis.quarantinedMessages);
    const failedMessages = new BigDecimal(analysis.failedMessages);
    const totalMessages = new BigDecimal(analysis.totalMessages);

    let passRate: string;
    let quarantineRate: string;
    let failRate: string;

    if (passedMessages.gt(0) && totalMessages.gt(0)) {
        passRate = passedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
    } else {
        if (totalMessages.gt(0)) {
            passRate = "N/A (No reports or messages found for period)";
        } else {
            passRate = "0% (No messages passed during period)";
        }
    }

    if (quarantinedMessages.gt(0) && failedMessages.gt(0)) {
        quarantineRate = quarantinedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
    } else {
        if (totalMessages.gt(0)) {
            quarantineRate = "N/A (No reports or messages found for period)";
        } else {
            quarantineRate = "0% (No messages quarantined during period)";
        }
    }

    if (passedMessages.gt(0) && failedMessages.gt(0)) {
        failRate = failedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
    } else {
        if (totalMessages.gt(0)) {
            failRate = "N/A (No reports or messages found for period)";
        } else {
            failRate = "0% (No messages failed during period)";
        }
    }

    logger.info(`Pass rate: ${passRate}`, "Process");
    logger.info(`Quarantine rate: ${quarantineRate}`, "Process");
    logger.info(`Fail rate: ${failRate}`, "Process");
}
