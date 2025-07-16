import { readFile } from "node:fs/promises";
import { AnalysisResult } from "./types";
import { join } from "node:path";
import { cwd } from "node:process";
import { BigDecimal } from "../lib/BigDecimal";
import { DateUtil } from "../lib/DateUtil";
import { ParsedDkimRecord, ParsedDmarcRecord, ParsedSpfRecord } from "../dns/types";

export class ReportGenerator {
    static async generateHtmlReport(
        analysis: AnalysisResult,
        templateDirectory: string,
        includeChart = true,
        enableDnsLookups = true,
        templateFile = "report.html"
    ): Promise<string> {
        const templateHtml = await readFile(join(cwd(), templateDirectory, templateFile), { encoding: "utf8" });

        const html = await ReportGenerator.generateHtmlFromTemplate(
            templateHtml,
            analysis,
            includeChart,
            enableDnsLookups
        );

        return html;
    }

    private static explainSpfAll(all: string | null): string {
        if (!all) return "No 'all' mechanism specified—this may result in unpredictable SPF behavior.";
        if (all === "-all") return "Strict policy: Only listed servers are authorized to send mail for this domain.";
        if (all === "~all")
            return "SoftFail policy: Non-listed servers are not authorized but mail may still be accepted.";
        if (all === "+all") return "Permissive policy: All servers are allowed to send mail for this domain.";
        if (all === "?all") return "Neutral policy: No assertion whether the sender is authorized.";
        return `Custom 'all' mechanism: ${all}`;
    }

    private static generateSpfExplanation(spf: ParsedSpfRecord): string[] {
        if (!spf.valid) return [`Invalid SPF record: ${spf.error}`];

        const mechanisms = spf.mechanisms.length
            ? `The record includes mechanisms: ${spf.mechanisms.join(", ")}.`
            : `No mechanisms are defined.`;

        const allExplanation = (() => {
            switch (spf.all) {
                case "-all":
                    return `A strict policy is enforced: only the listed mechanisms are allowed. All other mail will be rejected.`;
                case "~all":
                    return `A softfail policy: non-listed servers are not authorized but mail may still be accepted, typically marked as suspicious.`;
                case "+all":
                    return `A permissive policy: all servers are explicitly allowed to send mail.`;
                case "?all":
                    return `A neutral policy: no assertion about mail legitimacy.`;
                case null:
                    return `No 'all' mechanism specified, so the default is neutral.`;
                default:
                    return `Custom 'all' mechanism: ${spf.all}`;
            }
        })();

        const modifiers = Object.keys(spf.modifiers).length
            ? `Additional modifiers: ${Object.entries(spf.modifiers)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}.`
            : `No additional modifiers are defined.`;

        return [mechanisms, modifiers, allExplanation];
    }

    private static generateDkimExplanation(dkim: ParsedDkimRecord): [string] {
        if (!dkim.valid) return [`Invalid DKIM record: ${dkim.error}`];
        return [`This DKIM record publishes a ${dkim.keyType.toUpperCase()} public key to verify email signatures.`];
    }

    private static explainDmarcPolicy(policy: string): string {
        if (policy === "none") return "Policy 'none': Reports only, no enforcement.";
        if (policy === "quarantine") return "Policy 'quarantine': Suspicious messages may be placed in spam.";
        if (policy === "reject") return "Policy 'reject': Failing messages will be rejected outright.";
        return `Custom policy: ${policy}`;
    }

    private static generateDmarcExplanation(dmarc: ParsedDmarcRecord): string[] {
        if (!dmarc.valid) return [`Invalid DMARC record: ${dmarc.error}`];

        const policy = (() => {
            switch (dmarc.policy) {
                case "none":
                    return `Policy 'none': only monitoring is performed, no enforcement action.`;
                case "quarantine":
                    return `Policy 'quarantine': emails failing authentication are marked as suspicious (e.g., sent to spam).`;
                case "reject":
                    return `Policy 'reject': emails failing authentication are rejected outright.`;
                default:
                    return `Custom policy '${dmarc.policy}'.`;
            }
        })();

        const sp = dmarc.subdomainPolicy
            ? `For subdomains, the policy is '${dmarc.subdomainPolicy}'.`
            : `No subdomain policy is specified; defaults to the main policy.`;

        const adkim = dmarc.adkim
            ? `DKIM alignment is '${dmarc.adkim}' (${dmarc.adkim === "s" ? "strict" : "relaxed"}).`
            : `No DKIM alignment specified; default is relaxed.`;

        const aspf = dmarc.aspf
            ? `SPF alignment is '${dmarc.aspf}' (${dmarc.aspf === "s" ? "strict" : "relaxed"}).`
            : `No SPF alignment specified; default is relaxed.`;

        const pct = dmarc.pct
            ? `${dmarc.pct}% of messages are subjected to this policy.`
            : `100% of messages are subjected to this policy.`;

        const rua = dmarc.rua?.length
            ? `Aggregate reports will be sent to: <strong class="domain">${dmarc.rua.join('</strong>, <strong class="domain">').replaceAll("mailto:", "")}</strong>.`
            : `No aggregate report recipients are specified.`;

        const ruf = dmarc.ruf?.length
            ? `Forensic reports will be sent to: ${dmarc.ruf.join(", ")}.`
            : `No forensic report recipients are specified.`;

        const fo = dmarc.fo
            ? `Failure reporting options: ${dmarc.fo}.`
            : `No specific failure reporting options are defined.`;

        return [policy, sp, adkim, aspf, pct, rua, ruf, fo];
    }

    private static generateRecommendations(analysis: AnalysisResult): string[] {
        const recs: string[] = [];

        // 1. SPF recommendations
        for (const rec of analysis.domainAuthRecords) {
            if (!rec.spf) {
                recs.push(
                    `❌ SPF record <strong class="fail">not found<strong> for <strong class="domain">${rec.domain}</strong>. You should create an SPF record.`
                );
            } else if (rec.spfParsed && !rec.spfParsed.valid) {
                recs.push(
                    `❌ SPF record for <strong class="domain">${rec.domain}</strong> is invalid: <strong class="fail">${rec.spfParsed.error}</strong>. Please fix it.`
                );
            } else if (rec.spfParsed && rec.spfParsed.valid) {
                if (rec.spfParsed.all === "+all") {
                    recs.push(
                        `⚠️ SPF record for <strong class="domain">${rec.domain}</strong> is overly permissive <strong class="warning">+all</strong>. Consider restricting it.`
                    );
                } else if (rec.spfParsed.all === "-all" && analysis.failedMessages / analysis.totalMessages > 0.1) {
                    recs.push(
                        `⚠️ SPF for <strong class="domain">${rec.domain}</strong> uses strict <strong>-all</strong> but <strong class="fail">&gt;10%</strong> of messages are failing. Check if legitimate senders are missing.`
                    );
                }
            }
        }

        // 2. DKIM recommendations
        for (const rec of analysis.domainAuthRecords) {
            if (!rec.dkim) {
                recs.push(
                    `❌ DKIM record <strong class="fail">not found</strong> for <strong class="domain">${rec.domain}</strong>. Consider setting up DKIM signing.`
                );
            } else if (rec.dkimParsed && !rec.dkimParsed.valid) {
                recs.push(
                    `❌ DKIM record for <strong class="domain">${rec.domain}</strong> is invalid: <strong class="fail">${rec.dkimParsed.error}</strong>. Fix this.`
                );
            }
        }

        // 3. DMARC recommendations
        for (const rec of analysis.domainAuthRecords) {
            if (!rec.dmarc) {
                recs.push(
                    `❌ DMARC record not found for <strong class="domain">${rec.domain}</strong>. Strongly recommend configuring DMARC.`
                );
            } else if (rec.dmarcParsed && !rec.dmarcParsed.valid) {
                recs.push(
                    `❌ DMARC record for <strong class="domain">${rec.domain}</strong> is invalid: <strong class="fail">${rec.dmarcParsed.error}</strong>. Fix this.`
                );
            } else if (rec.dmarcParsed && rec.dmarcParsed.valid) {
                const p = rec.dmarcParsed.policy;
                const failRatio = analysis.failedMessages / (analysis.totalMessages || 1);
                if (p === "none" && failRatio < 0.01) {
                    recs.push(
                        `✅ DMARC policy for <strong class="domain">${rec.domain}</strong> is <strong class="fail">none</strong> but failure rate is <strong class="pass>&lt;1%</strong>. Consider moving to <strong class="warn">quarantine</strong>.`
                    );
                } else if (p === "quarantine" && failRatio < 0.01) {
                    recs.push(
                        `✅ DMARC policy for <strong class="domain">${rec.domain}</strong> is <strong class="warn">quarantine</strong> with <strong class="pass">very low</strong> failure rate. You can consider moving to <strong class="fail">reject</strong>.`
                    );
                } else if (p === "reject" && failRatio > 0.05) {
                    recs.push(
                        `⚠️ DMARC policy for <strong class="domain">${rec.domain}</strong> is <strong class="fail">reject</strong> but <strong class="fail">&gt;5%</strong> of messages fail. Verify legitimate sources.`
                    );
                }
            }
        }

        // 4. Aggregate failure rate
        if (analysis.failedMessages / (analysis.totalMessages || 1) > 0.05) {
            recs.push(
                `❌ High failure rate <strong class="fail">&gt;5%</strong>. Investigate failing sources to avoid losing legitimate mail.`
            );
        } else if (analysis.quarantinedMessages / (analysis.totalMessages || 1) > 0.05) {
            recs.push(
                `⚠️ Many messages quarantined: <strong class="fail">${new BigDecimal(analysis.quarantinedMessages / (analysis.totalMessages || 1)).multiply(100).toFixed(2)}%</strong>. Review authentication records and sources.`
            );
        }

        // 5. All good
        if (recs.length === 0) {
            recs.push(
                `⭐ All authentication records are <strong class="pass">valid</strong> and failure rates are <strong class="pass">low</strong>. Great job!`
            );
        }

        return recs;
    }

    private static renderRecordKeyValuePairs(record: string): string {
        return record
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((chunk) => {
                return chunk
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((token) => {
                        let key = "";
                        let value = "";
                        if (token.includes("=")) {
                            [key, value] = token.split("=", 2);
                            return `<span class="record-kv"><span class="record-key">${key}</span>=<span class="record-value">${value}</span></span>`;
                        } else if (token.includes(":")) {
                            [key, value] = token.split(":", 2);
                            return `<span class="record-kv"><span class="record-key">${key}</span>:<span class="record-value">${value}</span></span>`;
                        } else {
                            return `<span class="record-kv"><span class="record-token">${token}</span></span>`;
                        }
                    })
                    .join("");
            })
            .join(`<span class="record-separator">;</span>`);
    }

    private static async generateHtmlFromTemplate(
        templateHtml: string,
        analysis: AnalysisResult,
        includeChart: boolean,
        enableDnsLookups: boolean
    ): Promise<string> {
        const chartScriptLibrary = includeChart
            ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>'
            : "";

        const chartScript = includeChart
            ? `
            <script>
                const ctx = document.getElementById('trendChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(analysis.trends.map((t) => t.date))},
                        datasets: [{
                            label: 'Pass Rate %',
                            data: ${JSON.stringify(analysis.trends.map((t) => t.passRate))},
                            borderColor: '#007bff',
                            fill: false
                        }]
                    },
                    options: {
                        maintainAspectRatio: false
                    }
                });
            </script>`
            : "";

        const dayCount = DateUtil.daysBetween(analysis.dateRange.earliest, analysis.dateRange.latest);

        const reportDetails = `
            <hr />
            <h2>Report Details</h2>
            <p>
                <strong>Analysis Period:</strong> ${
                    DateUtil.dateLikeToDateUtc(analysis.dateRange.earliest * 1000)
                        .toISOString()
                        .split("T")[0]
                } to ${
                    DateUtil.dateLikeToDateUtc(analysis.dateRange.latest * 1000)
                        .toISOString()
                        .split("T")[0]
                } (${dayCount} day${dayCount !== 1 ? "s" : ""})
            </p>
            <p>
                <strong>Reporting Organizations:</strong> <span class="domain">${Array.from(analysis.reportingOrgs).join('</span>, <span class="domain">')}</span>
            </p>
            <p>
                <strong>Analyzed domains:</strong> <span class="domain">${analysis.uniqueAnalyzedDomains.join('</span>, <span class="domain">')}</span>
            </p>`;

        const passedMessages = new BigDecimal(analysis.passedMessages);
        const quarantinedMessages = new BigDecimal(analysis.quarantinedMessages);
        const failedMessages = new BigDecimal(analysis.failedMessages);
        const totalMessages = new BigDecimal(analysis.totalMessages);

        let passRateCard: string;
        let passRateTable: string;
        let passRateWidth: string;
        let quarantineRateCard: string;
        let quarantineRateTable: string;
        let quarantineRateWidth: string;
        let failRateCard: string;
        let failRateTable: string;
        let failRateWidth: string;

        if (passedMessages.gt(0) && totalMessages.gt(0)) {
            passRateCard =
                passRateTable =
                passRateWidth =
                    passedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
        } else {
            if (totalMessages.gt(0)) {
                passRateCard =
                    '<span title="No reports or messages found for period">N/A<span class="tooltip">🔍</span></span>';
                passRateTable = '<span title="No reports or messages found for period">N/A</span>';
                passRateWidth = "0%";
            } else {
                passRateCard = passRateTable = '<span title="No messages passed during period">0%</span>';
                passRateWidth = "0%";
            }
        }

        if (quarantinedMessages.gt(0) && failedMessages.gt(0)) {
            quarantineRateCard =
                quarantineRateTable =
                quarantineRateWidth =
                    quarantinedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
        } else {
            if (totalMessages.gt(0)) {
                quarantineRateCard =
                    '<span title="No reports or messages found for period">N/A<span class="tooltip">🔍</span></span>';
                quarantineRateTable = '<span title="No reports or messages found for period">N/A</span>';
                quarantineRateWidth = "0%";
            } else {
                quarantineRateCard = quarantineRateTable =
                    '<span title="No messages quarantined during period">0%</span>';
                quarantineRateWidth = "0%";
            }
        }

        if (passedMessages.gt(0) && failedMessages.gt(0)) {
            failRateCard =
                failRateTable =
                failRateWidth =
                    failedMessages.divide(totalMessages).multiply(100).toFixed(2) + "%";
        } else {
            if (totalMessages.gt(0)) {
                failRateCard =
                    '<span title="No reports or messages found for period">N/A<span class="tooltip">🔍</span></span>';
                failRateTable = '<span title="No reports or messages found for period">N/A</span>';
                failRateWidth = "0%";
            } else {
                failRateCard = failRateTable = '<span title="No messages failed during period">0%</span>';
                failRateWidth = "0%";
            }
        }

        const summary = `
            <hr />
            <div class="summary">
                <div class="stat-card">
                    <div class="stat-value">${analysis.totalReports}</div>
                    <div class="stat-label">Total Reports</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analysis.totalMessages}</div>
                    <div class="stat-label">Total Messages</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value pass">${passRateCard}</div>
                    <div class="stat-label">Pass Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value quarantine">${quarantineRateCard}</div>
                    <div class="stat-label">Quarantine Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value fail">${failRateCard}</div>
                    <div class="stat-label">Fail Rate</div>
                </div>
            </div>`;

        const authenticationResults = `
            <hr />
            <h2>Authentication Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="pass">✓ Passed</td>
                        <td>${analysis.passedMessages}</td>
                        <td>${passRateTable}</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill pass" style="width: ${passRateWidth}"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="warn">⚠ Quarantined</td>
                        <td>${analysis.quarantinedMessages}</td>
                        <td>${quarantineRateTable}</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill warn" style="width: ${quarantineRateWidth}"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="fail">✗ Failed</td>
                        <td>${analysis.failedMessages}</td>
                        <td>${failRateTable}</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill fail" style="width: ${failRateWidth}"></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>`;

        const domainAlignment = `
            <hr />
            <h2>Domain Alignment</h2>
            <table>
                <thead>
                    <tr>
                        <th>Alignment Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>DKIM + SPF Aligned</td>
                        <td>${analysis.domainAlignment.bothAligned}</td>
                        <td>${analysis.totalMessages > 0 ? new BigDecimal(analysis.domainAlignment.bothAligned.toString()).divide(analysis.totalMessages.toString()).multiply("100").toFixed(2) : "0.00"}%</td>
                    </tr>
                    <tr>
                        <td>DKIM Only</td>
                        <td>${analysis.domainAlignment.dkimAligned}</td>
                        <td>${analysis.totalMessages > 0 ? new BigDecimal(analysis.domainAlignment.dkimAligned.toString()).divide(analysis.totalMessages.toString()).multiply("100").toFixed(2) : "0.00"}%</td>
                    </tr>
                    <tr>
                        <td>SPF Only</td>
                        <td>${analysis.domainAlignment.spfAligned}</td>
                        <td>${analysis.totalMessages > 0 ? new BigDecimal(analysis.domainAlignment.spfAligned.toString()).divide(analysis.totalMessages.toString()).multiply("100").toFixed(2) : "0.00"}%</td>
                    </tr>
                    <tr>
                        <td>ARC</td>
                        <td>${analysis.domainAlignment.arcAligned}</td>
                        <td>${analysis.totalMessages > 0 ? new BigDecimal(analysis.domainAlignment.arcAligned.toString()).divide(analysis.totalMessages.toString()).multiply("100").toFixed(2) : "0.00"}%</td>
                    </tr>
                    <tr>
                        <td>No Alignment</td>
                        <td>${analysis.domainAlignment.noneAligned}</td>
                        <td>${analysis.totalMessages > 0 ? new BigDecimal(analysis.domainAlignment.noneAligned.toString()).divide(analysis.totalMessages.toString()).multiply("100").toFixed(2) : "0.00"}%</td>
                    </tr>
                </tbody>
            </table>
            <div class="alignment-legend">
                <span class="explanation"><strong>DKIM:</strong> DomainKeys Identified Mail</span>
                <span class="explanation"><strong>SPF:</strong> Sender Policy Framework</span>
                <span class="explanation"><strong>ARC:</strong> Authenticated Received Chain</span>
            </div>`;

        const failingSources = analysis.topFailingSources.length
            ? `
            <hr />
            <h2>Top Failing Sources</h2>
            <table>
                <thead>
                    <tr>
                        <th>Source IP</th>
                        <th>Provider</th>
                        <th>Risk Level</th>
                        <th>Failed Messages</th>
                        <th>Disposition</th>
                    </tr>
                </thead>
                <tbody>${analysis.topFailingSources
                    .map(
                        (source) => `
                    <tr>
                        <td>${source.ip}</td>
                        <td>${source.provider}</td>
                        <td>${source.riskLevel}</td>
                        <td>${source.count}</td>
                        <td>${source.disposition}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
            </table>`
            : "";

        const allFailures = analysis.failureDetails.length
            ? `
            <hr />
            <h2>All Failures and Quarantined Messages</h2>
            <div class="failure-records">
                ${analysis.failureDetails
                    .sort((a, b) => a.dateRange.begin - b.dateRange.begin)
                    .map(
                        (f) => `
                    <div class="failure-card">
                        <h3>${f.ip} (${f.provider})</h3>
                        <div class="meta">
                            ${
                                DateUtil.dateLikeToDateUtc(f.dateRange.begin * 1000)
                                    .toISOString()
                                    .split("T")[0]
                            }
                            to
                            ${
                                DateUtil.dateLikeToDateUtc(f.dateRange.end * 1000)
                                    .toISOString()
                                    .split("T")[0]
                            }
                        </div>
                        <div class="meta">
                            <span class="badge ${f.riskLevel}">${f.riskLevel.toUpperCase()}</span>
                            <span class="badge ${f.disposition}">${f.disposition.toUpperCase()}</span>
                        </div>
                        <p><strong>Count:</strong> ${f.count}</p>
                        <p><strong>Header From:</strong> ${f.headerFrom}</p>
                        ${f.reason ? `<p><strong>Reason:</strong> ${f.reason}</p>` : ""}
                        ${f.comment ? `<p><strong>Comment:</strong> ${f.comment}</p>` : ""}
                        <p><strong>DKIM:</strong> ${f.dkim} &nbsp;&nbsp; <strong>SPF:</strong> ${f.spf}</p>
                        <p><strong>Report:</strong> ${f.reportId}</p>
                        <p><strong>Zip File:</strong> ${f.sourceZip}</p>
                        <p><strong>XML File:</strong> ${f.sourceFile}</p>
                    </div>
                `
                    )
                    .join("")}
            </div>`
            : "";

        const domainAuthRecords = analysis.domainAuthRecords.length
            ? `
            <hr />
            <h2>Domain Authentication Records</h2>
            <table>
            <thead>
                <tr>
                <th>Domain</th>
                <th>SPF</th>
                <th>DKIM</th>
                <th>DMARC</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.domainAuthRecords
                    .map(
                        (rec) => `
                <tr>
                    <td><strong class="domain">${rec.domain}</strong></td>
                    <td>${rec.spf ? `<code>${this.renderRecordKeyValuePairs(rec.spf)}</code>` : "❌ Not Found"}</td>
                    <td>${rec.dkim ? `<code title="${rec.dkim}">${this.renderRecordKeyValuePairs(rec.dkim.substring(0, 40) + "...")}...</code>` : "❌ Not Found"}</td>
                    <td>${rec.dmarc ? `<code>${this.renderRecordKeyValuePairs(rec.dmarc)}</code>` : "❌ Not Found"}</td>
                </tr>`
                    )
                    .join("")}
            </tbody>
            </table>`
            : enableDnsLookups
              ? `
            <hr />
            <h2>Domain Authentication Records</h2>
            <strong>Lookups were enabled but no records found.</strong>
            `
              : "";

        const domainAuthCards = `
            <hr />
            <h2>Domain Authentication Details</h2>
            <div class="domain-auth-cards">
            ${analysis.domainAuthRecords
                .map((rec) => {
                    const spfExplanation = rec.spfParsed
                        ? `<p>${ReportGenerator.generateSpfExplanation(rec.spfParsed).join("</p><p>")}</p>`
                        : "No parsed SPF data available.";
                    const dkimExplanation = rec.dkimParsed
                        ? `<p>${ReportGenerator.generateDkimExplanation(rec.dkimParsed).join("</p><p>")}</p>`
                        : "No parsed DKIM data available.";
                    const dmarcExplanation = rec.dmarcParsed
                        ? `<p>${ReportGenerator.generateDmarcExplanation(rec.dmarcParsed).join("</p><p>")}</p>`
                        : "No parsed DMARC data available.";

                    return `
                <div class="auth-card">
                    <h3>${rec.domain}</h3>
                    <!-- SPF -->
                    ${
                        rec.spf
                            ? rec.spfParsed?.valid
                                ? `
                    <p><strong>SPF:</strong> <code>${this.renderRecordKeyValuePairs(rec.spf)}</code></p>
                    <div class="spf-details">
                        <p><strong>Mechanisms:</strong> ${rec.spfParsed.mechanisms.join(", ") || "N/A"}</p>
                        <p><strong>Modifiers:</strong> ${
                            Object.entries(rec.spfParsed.modifiers)
                                .map(([k, v]) => `${k}=${v}`)
                                .join(", ") || "N/A"
                        }</p>
                        <p><strong>All Policy:</strong> ${rec.spfParsed.all || "N/A"}</p>
                    </div>
                    <div class="spf-explanation">${spfExplanation}</div>`
                                : `
                    <p><strong>SPF:</strong> <code><span class="fail">❌ Invalid: No parsed SPF data.</span></code>
                    <div class="spf-explanation">${spfExplanation}</div>`
                            : `
                    <p><strong>SPF:</strong> <code><span class="fail">❌ Not Found</span></code>`
                    }
                    <!-- DKIM -->
                    ${
                        rec.dkim
                            ? rec.dkimParsed?.valid
                                ? `
                    <p><strong>DKIM:</strong> <code>${this.renderRecordKeyValuePairs(rec.dkim.substring(0, 60) + "...")}</code></p>
                    <div class="dkim-details">
                        <p><strong>Key Type:</strong> ${rec.dkimParsed.keyType}</p>
                        <p><strong>Public Key:</strong> <code class="dkim-publickey">${rec.dkimParsed.publicKey}</code></p>
                    </div>
                    <div class="dkim-explanation">${dkimExplanation}</div>`
                                : `
                    <p><strong>DKIM:</strong> <code><span class="fail">❌ Invalid: No parsed DKIM data.</span></code>
                    <div class="dkim-explanation">${dkimExplanation}</div>`
                            : `
                    <p><strong>DKIM:</strong> <code><span class="fail">❌ Not Found</span></code>`
                    }
                    <!-- DMARC -->
                    ${
                        rec.dmarc
                            ? rec.dmarcParsed?.valid
                                ? `
                    <p><strong>DMARC:</strong> <code>${this.renderRecordKeyValuePairs(rec.dmarc)}</code></p>
                    <div class="dmarc-details">
                        <p><strong>Policy:</strong> ${rec.dmarcParsed.policy}</p>
                        <p><strong>Subdomain Policy:</strong> ${rec.dmarcParsed.subdomainPolicy || "N/A"}</p>
                        <p><strong>Alignment DKIM:</strong> ${rec.dmarcParsed.adkim || "N/A"}</p>
                        <p><strong>Alignment SPF:</strong> ${rec.dmarcParsed.aspf || "N/A"}</p>
                        <p><strong>Percentage:</strong> ${rec.dmarcParsed.pct || "100"}</p>
                        ${
                            rec.dmarcParsed.rua?.length
                                ? `<p><strong>Aggregate Reports:</strong> ${rec.dmarcParsed.rua.join(", ")}</p>`
                                : `<p><strong>Aggregate Reports:</strong> None</p>`
                        }
                    </div>
                    <div class="dmarc-explanation">${dmarcExplanation}</div>`
                                : `
                    <p><strong>DMARC:</strong> <code><span class="fail">❌ Invalid: No parsed DMARC data.</span></code>
                    <div class="dmarc-explanation">${dmarcExplanation}</div>`
                            : `
                    <p><strong>DMARC:</strong> <code><span class="fail">❌ Not Found</span></code>`
                    }
                </div>`;
                })
                .join("")}
            </div>`;

        const recommendations = `
            <hr />
            <div class="recommendation">
                <h3>Recommendations</h3>
                ${ReportGenerator.generateRecommendations(analysis)
                    .map((r) => `<p>${r}</p>`)
                    .join("")}
            </div>
            `;

        const tables = [
            authenticationResults,
            domainAlignment,
            failingSources,
            allFailures,
            domainAuthRecords,
            domainAuthCards,
            recommendations
        ];

        return templateHtml
            .replace("<!-- TREND_CHART_SCRIPT_LIBRARY_PLACEHOLDER -->", chartScriptLibrary)
            .replace("<!-- REPORT_DETAILS_PLACEHOLDER -->", reportDetails)
            .replace("<!-- SUMMARY_PLACEHOLDER -->", summary)
            .replace(
                "<!-- TREND_CHART_PLACEHOLDER -->",
                includeChart ? `<div class="chart-container"><canvas id='trendChart'></canvas></div>` : ""
            )
            .replace("<!-- CHART_SCRIPT_PLACEHOLDER -->", chartScript)
            .replace("<!-- TABLES_PLACEHOLDER -->", tables.join(""));
    }
}
