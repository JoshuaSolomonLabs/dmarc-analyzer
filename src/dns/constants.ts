import { ProviderDkimSelectors } from "./types";

/**
 * Known providers and their common DKIM selectors.
 * This list can be extended over time.
 */
export const KNOWN_PROVIDER_DKIM_SELECTORS: ProviderDkimSelectors[] = [
    {
        provider: "Google Workspace",
        selectors: ["google"],
        spfIncludes: ["_spf.google.com"],
        mxDomains: ["aspmx.l.google.com"]
    },
    {
        provider: "Microsoft 365",
        selectors: ["selector1", "selector2"],
        spfIncludes: ["spf.protection.outlook.com"],
        mxDomains: ["mail.protection.outlook.com"]
    },
    {
        provider: "Yahoo",
        selectors: ["default", "selector1"],
        spfIncludes: ["_spf.mail.yahoo.com"]
    },
    {
        provider: "SendGrid",
        selectors: ["s1", "s2"],
        spfIncludes: ["_spf.sendgrid.net"]
    },
    {
        provider: "Mailchimp",
        selectors: ["k1"],
        spfIncludes: ["servers.mcsv.net"]
    }
];
