import { DomainAuthRecords } from "../dns/types";

export interface ZipFileInfo {
    filename: string;
    path: string;
    timestamp: number;
    provider: string;
}

export interface DmarcRecord {
    sourceZip: string;
    sourceFile: string;
    domain: string;
    orgName: string;
    email: string;
    reportId: string;
    dateRange: {
        begin: number;
        end: number;
    };
    policy: {
        domain: string;
        adkim: string;
        aspf: string;
        p: string;
        sp: string;
        pct: number;
    };
    records: Array<DmarcRecordRow>;
}

export interface DmarcRecordRow {
    sourceIp: string;
    count: number;
    disposition: string;
    dkim: string;
    spf: string;
    headerFrom: string;
    envelopeFrom?: string;
    dkimDomain?: string;
    spfDomain?: string;
    reason?: string;
    comment?: string;
}

export interface TrendData {
    date: string;
    passed: number;
    failed: number;
    total: number;
    passRate: number;
}

export interface IpInfo {
    ip: string;
    provider: string;
    isKnownProvider: boolean;
    riskLevel: "low" | "medium" | "high";
}

export interface TopFailingSource {
    ip: string;
    count: number;
    disposition: string;
    provider: string;
    isKnownProvider: boolean;
    riskLevel: "low" | "medium" | "high";
}

export interface FailureDetail {
    ip: string;
    provider: string;
    riskLevel: "low" | "medium" | "high";
    disposition: string;
    count: number;
    headerFrom: string;
    dkim: string;
    spf: string;
    dateRange: {
        begin: number;
        end: number;
    };
    reason?: string;
    comment?: string;
    reportId: string;
    sourceZip: string;
    sourceFile: string;
}

export interface AnalysisResult {
    uniqueAnalyzedDomains: string[];
    domainAuthRecords: DomainAuthRecords[];
    totalReports: number;
    totalMessages: number;
    passedMessages: number;
    failedMessages: number;
    quarantinedMessages: number;
    rejectedMessages: number;
    topFailingSources: TopFailingSource[];
    failureDetails: FailureDetail[];
    domainAlignment: {
        dkimAligned: number;
        spfAligned: number;
        bothAligned: number;
        arcAligned: number;
        noneAligned: number;
    };
    reportingOrgs: Set<string>;
    dateRange: {
        earliest: number;
        latest: number;
    };
    trends: TrendData[];
    failureReasons: Map<string, number>;
    subdomainAnalysis: Map<string, { passed: number; failed: number }>;
    volumeByProvider: Map<string, number>;
}
