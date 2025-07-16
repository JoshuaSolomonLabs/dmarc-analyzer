import { promises as dns } from "dns";
import { DomainAuthRecords } from "./types";
import { parseSpfRecord } from "./spf";
import { parseDmarcRecord } from "./dmarc";
import { parseDkimRecord } from "./dkim";
import { KNOWN_PROVIDER_DKIM_SELECTORS } from "./constants";

export async function lookupDomainAuthRecords(domain: string): Promise<DomainAuthRecords> {
    const result: DomainAuthRecords = { domain };

    // SPF (TXT records)
    let spfMechanisms: string[] = [];
    try {
        const txtRecords = await dns.resolveTxt(domain);
        const spfRecord = txtRecords.map((r) => r.join("")).find((r) => r.toLowerCase().startsWith("v=spf1"));

        if (spfRecord) {
            result.spf = spfRecord;
            result.spfParsed = parseSpfRecord(spfRecord);
            spfMechanisms = result.spfParsed.valid ? result.spfParsed.mechanisms : [];
        }
    } catch (err) {
        result.spf = undefined;
    }

    // MX records (optional, but helpful)
    let mxRecords: string[] = [];
    try {
        const mxEntries = await dns.resolveMx(domain);
        mxRecords = mxEntries.map((entry) => entry.exchange.toLowerCase());
    } catch (err) {
        // ignore
    }

    // Use array to track insertion order
    const selectorsToTryRaw: string[] = [];

    // Collect selectors from matching providers
    for (const provider of KNOWN_PROVIDER_DKIM_SELECTORS) {
        const matchesSpf = provider.spfIncludes?.some((spfInc) => spfMechanisms.some((m) => m.includes(spfInc)));

        const matchesMx = provider.mxDomains?.some((mxDom) => mxRecords.some((mx) => mx.includes(mxDom)));

        if (matchesSpf || matchesMx) {
            selectorsToTryRaw.push(...provider.selectors);
        }
    }

    // Always add fallback at the end
    selectorsToTryRaw.push("default");

    // Remove duplicates while preserving order
    const selectorsToTry = Array.from(new Set(selectorsToTryRaw));

    // DKIM lookup (try selectors in order)
    for (const selector of selectorsToTry) {
        try {
            const dkimRecords = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
            const dkimRecord = dkimRecords.map((r) => r.join("")).join(" ");

            if (dkimRecord) {
                result.dkim = dkimRecord;
                result.dkimParsed = parseDkimRecord(dkimRecord);
                break; // stop after first successful lookup
            }
        } catch {
            // keep trying next selector
        }
    }

    // DMARC (_dmarc TXT)
    try {
        const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
        const dmarcRecord = dmarcRecords.map((r) => r.join("")).find((r) => r.toLowerCase().startsWith("v=dmarc1"));

        if (dmarcRecord) {
            result.dmarc = dmarcRecord;
            result.dmarcParsed = parseDmarcRecord(dmarcRecord);
        }
    } catch (err) {
        result.dmarc = undefined;
    }

    return result;
}
