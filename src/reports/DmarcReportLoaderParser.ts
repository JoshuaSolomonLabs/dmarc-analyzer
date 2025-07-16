import { readdir, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { createGunzip } from "zlib";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { logger } from "../lib/Logger";
import { DateUtil } from "../lib/DateUtil";
import { parseStringPromise } from "xml2js";
import { DmarcRecord, ZipFileInfo } from "./types";
import { ZIP_FILENAME_PATTERNS } from "./constants";

export class DmarcReportLoaderParser {
    private static parseZipFilename(reportsDirectory: string, filename: string): ZipFileInfo {
        const baseName = basename(filename, ".zip");

        for (const [provider, regex] of Object.entries(ZIP_FILENAME_PATTERNS)) {
            const match = baseName.match(regex);
            if (match) {
                const timestamp = parseInt(match[1]);
                return {
                    filename,
                    path: join(reportsDirectory, filename),
                    timestamp,
                    provider
                };
            }
        }

        // Default fallback
        return {
            filename,
            path: join(reportsDirectory, filename),
            timestamp: 0,
            provider: "unknown"
        };
    }

    private static async parseXmlReport(
        xmlContent: string,
        zipFilename: string,
        xmlFilename: string
    ): Promise<DmarcRecord> {
        const parsed = await parseStringPromise(xmlContent);
        const feedback = parsed.feedback;

        const report: DmarcRecord = {
            sourceZip: zipFilename,
            sourceFile: xmlFilename,
            domain: feedback.policy_published[0].domain[0],
            orgName: feedback.report_metadata[0].org_name[0],
            email: feedback.report_metadata[0].email[0],
            reportId: feedback.report_metadata[0].report_id[0],
            dateRange: {
                begin: parseInt(feedback.report_metadata[0].date_range[0].begin[0]),
                end: parseInt(feedback.report_metadata[0].date_range[0].end[0])
            },
            policy: {
                domain: feedback.policy_published[0].domain[0],
                adkim: feedback.policy_published[0].adkim?.[0] || "r",
                aspf: feedback.policy_published[0].aspf?.[0] || "r",
                p: feedback.policy_published[0].p[0],
                sp: feedback.policy_published[0].sp?.[0] || feedback.policy_published[0].p[0],
                pct: parseInt(feedback.policy_published[0].pct?.[0] || "100")
            },
            records: []
        };

        const records = feedback.record || [];
        for (const record of records) {
            const row = record.row[0];
            const policyEvaluated = row.policy_evaluated[0];
            const identifiers = record.identifiers[0];
            const authResults = record.auth_results[0];

            report.records.push({
                sourceIp: row.source_ip[0],
                count: parseInt(row.count[0]),
                disposition: policyEvaluated.disposition[0],
                dkim: policyEvaluated.dkim[0],
                spf: policyEvaluated.spf[0],
                headerFrom: identifiers.header_from[0],
                envelopeFrom: identifiers.envelope_from?.[0],
                dkimDomain: authResults.dkim?.[0]?.domain?.[0],
                spfDomain: authResults.spf?.[0]?.domain?.[0],
                reason: policyEvaluated.reason?.[0]?.type?.[0],
                comment: policyEvaluated.reason?.[0]?.comment?.[0]
            });
        }

        return report;
    }

    static async processDirectory(reportsDirectory: string, sortByTimestamp = true): Promise<DmarcRecord[]> {
        const files = await readdir(reportsDirectory);
        const zipFiles = files.filter((file) => extname(file) === ".zip");

        logger.info(`Found ${zipFiles.length} ZIP files to process`, "DmarcAnalyzer");

        const zipFileInfos = zipFiles.map((file) => this.parseZipFilename(reportsDirectory, file));

        if (sortByTimestamp) {
            zipFileInfos.sort((a, b) => a.timestamp - b.timestamp);
        }

        const records: DmarcRecord[] = [];

        for (const zipInfo of zipFileInfos) {
            const dateStr =
                zipInfo.timestamp > 0
                    ? DateUtil.dateLikeToDateUtc(zipInfo.timestamp * 1000)
                          .toISOString()
                          .split("T")[0]
                    : "unknown";
            logger.info(`Processing ${zipInfo.filename} (${zipInfo.provider}, ${dateStr})`, "DmarcAnalyzer");

            try {
                records.push(...(await this.processZipFile(zipInfo.path)));
            } catch (err) {
                logger.error(`Failed to process ${zipInfo.filename}`, "DmarcAnalyzer", err);
            }
        }

        return records;
    }

    private static async processZipFile(filePath: string): Promise<DmarcRecord[]> {
        const zipFilename = basename(filePath);
        const zipData = await readFile(filePath);
        const zip = await JSZip.loadAsync(zipData);

        const records: DmarcRecord[] = [];

        for (const [filename, file] of Object.entries(zip.files)) {
            if (file.dir) continue;

            let xmlContent: string;
            if (filename.endsWith(".gz")) {
                const buffer = await file.async("nodebuffer");
                xmlContent = await this.decompressGzip(buffer);
            } else {
                xmlContent = await file.async("string");
            }

            const baseFilename = basename(filename);

            const record = await this.parseXmlReport(xmlContent, zipFilename, baseFilename);

            records.push(record);

            logger.info(`Parsed report ${record.reportId} from ${record.orgName}`, "DmarcAnalyzer");
        }

        return records;
    }

    private static async decompressGzip(buffer: Buffer): Promise<string> {
        const chunks: Buffer[] = [];
        const readable = Readable.from(buffer);
        const gunzip = createGunzip();

        return new Promise((resolve, reject) => {
            readable
                .pipe(gunzip)
                .on("data", (chunk) => chunks.push(chunk))
                .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
                .on("error", reject);
        });
    }
}
