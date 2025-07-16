import { ParsedDkimRecord } from "./types";

export function parseDkimRecord(record: string): ParsedDkimRecord {
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

        if (!tags["v"] || tags["v"].toUpperCase() !== "DKIM1") {
            return { valid: false, error: "Invalid DKIM record (must start with v=DKIM1)" };
        }
        if (!tags["p"]) {
            return { valid: false, error: "DKIM record missing public key (p=)" };
        }

        return {
            valid: true,
            version: "DKIM1",
            keyType: tags["k"] || "rsa",
            publicKey: tags["p"],
            rawTags: tags
        };
    } catch (e) {
        return { valid: false, error: (e as Error).message };
    }
}
