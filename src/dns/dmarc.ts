import { ParsedDmarcRecord } from "./types";

export function parseDmarcRecord(record: string): ParsedDmarcRecord {
    try {
        const parts = record.trim().split(";");
        const tags: Record<string, string> = {};

        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            const [key, value] = trimmed.split("=", 2);
            if (key && value) {
                tags[key.toLowerCase()] = value.trim();
            }
        }

        if (!tags["v"] || tags["v"].toUpperCase() !== "DMARC1") {
            return { valid: false, error: "Invalid DMARC record (must start with v=DMARC1)" };
        }
        if (!tags["p"]) {
            return { valid: false, error: "DMARC record missing policy (p=)" };
        }

        return {
            valid: true,
            version: "DMARC1",
            policy: tags["p"],
            subdomainPolicy: tags["sp"],
            adkim: tags["adkim"],
            aspf: tags["aspf"],
            pct: tags["pct"],
            rua: tags["rua"] ? tags["rua"].split(",") : undefined,
            ruf: tags["ruf"] ? tags["ruf"].split(",") : undefined,
            fo: tags["fo"],
            rawTags: tags
        };
    } catch (e) {
        return { valid: false, error: (e as Error).message };
    }
}
