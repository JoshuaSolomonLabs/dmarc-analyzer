export interface DmarcAnalyzerConfig {
    templateDirectory: string;
    defaultHtmlTemplate: string;
    reportsDirectory: string;
    outputPath: string;
    sortByTimestamp: boolean;
    includeChart: boolean;
    enableDnsLookups: boolean;
}
