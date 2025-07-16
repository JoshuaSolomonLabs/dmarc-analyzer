import { DateUtil } from "../lib/DateUtil";
import { AnalysisResult, DmarcRecord } from "./types";
import { KNOWN_PROVIDERS, PRIVATE_IP_RANGES } from "./constants";
import { IpInfo, TrendData } from "./types";
import { BigDecimal } from "../lib/BigDecimal";
import { lookupDomainAuthRecords } from "../dns/lookup";
import { resourceUsage } from "process";

export class DmarcAnalyzer {
    private static enrichIpData(ip: string): IpInfo {
        for (const provider of KNOWN_PROVIDERS) {
            if (provider.ranges.some((range) => ip.startsWith(range))) {
                return {
                    ip,
                    provider: provider.name,
                    isKnownProvider: true,
                    riskLevel: "low"
                };
            }
        }

        const isPrivate = PRIVATE_IP_RANGES.some((range) => ip.startsWith(range));

        return {
            ip,
            provider: "Unknown",
            isKnownProvider: false,
            riskLevel: isPrivate ? "medium" : "high"
        };
    }

    private static generateTrendData(records: DmarcRecord[]): TrendData[] {
        const dailyData = new Map<string, { passed: number; failed: number; total: number }>();

        for (const record of records) {
            for (let timestamp = record.dateRange.begin; timestamp <= record.dateRange.end; timestamp += 86400) {
                const dateKey = DateUtil.dateLikeToDateUtc(timestamp * 1000)
                    .toISOString()
                    .split("T")[0];

                if (!dailyData.has(dateKey)) {
                    dailyData.set(dateKey, { passed: 0, failed: 0, total: 0 });
                }

                const dayData = dailyData.get(dateKey)!;

                for (const recordRow of record.records) {
                    const count = Math.floor(
                        recordRow.count / ((record.dateRange.end - record.dateRange.begin) / 86400 + 1)
                    );

                    const dkimPass = recordRow.dkim === "pass";
                    const spfPass = recordRow.spf === "pass";
                    const arcPass = recordRow.reason === "local_policy" && recordRow.comment?.includes("arc=pass");
                    const passed = dkimPass || spfPass || arcPass;

                    dayData.total += count;
                    if (passed) {
                        dayData.passed += count;
                    } else {
                        dayData.failed += count;
                    }
                }
            }
        }

        return Array.from(dailyData.entries())
            .map(([date, data]) => ({
                date,
                passed: data.passed,
                failed: data.failed,
                total: data.total,
                passRate:
                    data.total > 0
                        ? new BigDecimal(data.passed.toString())
                              .divide(data.total.toString())
                              .multiply("100")
                              .toNumber()
                        : 0
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    static async analyze(records: DmarcRecord[], enableDnsLookups: boolean): Promise<AnalysisResult> {
        const result: AnalysisResult = {
            uniqueAnalyzedDomains: [],
            domainAuthRecords: [],
            totalReports: records.length,
            totalMessages: 0,
            passedMessages: 0,
            failedMessages: 0,
            quarantinedMessages: 0,
            rejectedMessages: 0,
            topFailingSources: [],
            failureDetails: [],
            domainAlignment: {
                dkimAligned: 0,
                spfAligned: 0,
                bothAligned: 0,
                arcAligned: 0,
                noneAligned: 0
            },
            reportingOrgs: new Set(),
            dateRange: {
                earliest: Number.MAX_SAFE_INTEGER,
                latest: 0
            },
            trends: this.generateTrendData(records),
            failureReasons: new Map(),
            subdomainAnalysis: new Map(),
            volumeByProvider: new Map()
        };

        const failingSources = new Map<string, { count: number; disposition: string }>();

        for (const record of records) {
            result.reportingOrgs.add(record.orgName);

            if (record.dateRange.begin < result.dateRange.earliest) {
                result.dateRange.earliest = record.dateRange.begin;
            }
            if (record.dateRange.end > result.dateRange.latest) {
                result.dateRange.latest = record.dateRange.end;
            }

            if (!result.uniqueAnalyzedDomains.includes(record.domain)) {
                result.uniqueAnalyzedDomains.push(record.domain);
            }

            // Track volume by reporting provider
            const currentVolume = result.volumeByProvider.get(record.orgName) || 0;
            const reportVolume = record.records.reduce((sum, recordRow) => sum + recordRow.count, 0);
            result.volumeByProvider.set(record.orgName, currentVolume + reportVolume);

            for (const recordRow of record.records) {
                result.totalMessages += recordRow.count;

                const dkimPass = recordRow.dkim === "pass";
                const spfPass = recordRow.spf === "pass";
                const arcPass = recordRow.reason === "local_policy" && recordRow.comment?.includes("arc=pass");
                const passed = dkimPass || spfPass || arcPass;

                // Subdomain analysis
                if (recordRow.headerFrom !== record.domain) {
                    const subdomainData = result.subdomainAnalysis.get(recordRow.headerFrom) || {
                        passed: 0,
                        failed: 0
                    };
                    if (passed) {
                        subdomainData.passed += recordRow.count;
                    } else {
                        subdomainData.failed += recordRow.count;
                    }
                    result.subdomainAnalysis.set(recordRow.headerFrom, subdomainData);
                }

                if (passed) {
                    result.passedMessages += recordRow.count;

                    if (dkimPass && spfPass) {
                        result.domainAlignment.bothAligned += recordRow.count;
                    } else if (dkimPass) {
                        result.domainAlignment.dkimAligned += recordRow.count;
                    } else {
                        result.domainAlignment.spfAligned += recordRow.count;
                    }

                    if (arcPass) {
                        result.domainAlignment.arcAligned += recordRow.count;
                    }
                } else {
                    result.failedMessages += recordRow.count;
                    result.domainAlignment.noneAligned += recordRow.count;

                    // Track failure reasons
                    if (recordRow.reason) {
                        const currentCount = result.failureReasons.get(recordRow.reason) || 0;
                        result.failureReasons.set(recordRow.reason, currentCount + recordRow.count);
                    }

                    // Track failing sources
                    const existing = failingSources.get(recordRow.sourceIp);
                    if (existing) {
                        existing.count += recordRow.count;
                    } else {
                        failingSources.set(recordRow.sourceIp, {
                            count: recordRow.count,
                            disposition: recordRow.disposition
                        });
                    }
                }

                if (!passed) {
                    result.failureDetails.push({
                        ip: recordRow.sourceIp,
                        provider: this.enrichIpData(recordRow.sourceIp).provider,
                        riskLevel: this.enrichIpData(recordRow.sourceIp).riskLevel,
                        disposition: recordRow.disposition,
                        count: recordRow.count,
                        headerFrom: recordRow.headerFrom,
                        dkim: recordRow.dkim,
                        spf: recordRow.spf,
                        dateRange: record.dateRange,
                        reason: recordRow.reason,
                        comment: recordRow.comment,
                        reportId: record.reportId,
                        sourceZip: record.sourceZip ?? "unknown",
                        sourceFile: record.sourceFile ?? "unknown"
                    });
                }

                if (recordRow.disposition === "quarantine") {
                    result.quarantinedMessages += recordRow.count;
                } else if (recordRow.disposition === "reject") {
                    result.rejectedMessages += recordRow.count;
                }
            }
        }

        // Add domains
        if (enableDnsLookups) {
            for (const domain of result.uniqueAnalyzedDomains) {
                const domainLookup = await lookupDomainAuthRecords(domain);
                result.domainAuthRecords.push(domainLookup);
            }
        }

        // Sort failing sources by count and enrich with IP data
        const topFailingIps = Array.from(failingSources.entries())
            .map(([ip, data]) => ({ ip, count: data.count, disposition: data.disposition }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Enrich IP data
        result.topFailingSources = await Promise.all(
            topFailingIps.map(async (source) => {
                const ipInfo = this.enrichIpData(source.ip);
                return {
                    ...source,
                    provider: ipInfo.provider,
                    isKnownProvider: ipInfo.isKnownProvider,
                    riskLevel: ipInfo.riskLevel
                };
            })
        );

        return result;
    }
}
