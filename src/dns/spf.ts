import { ParsedSpfRecord } from "./types";

export function parseSpfRecord(record: string): ParsedSpfRecord {
    try {
        const parts = record.trim().split(/\s+/);

        if (!parts[0] || !parts[0].toLowerCase().startsWith("v=spf1")) {
            return { valid: false, error: "Invalid SPF record (must start with v=spf1)" };
        }

        const mechanisms: string[] = [];
        const modifiers: Record<string, string> = {};
        let all: string | null = null;

        for (let i = 1; i < parts.length; i++) {
            const token = parts[i];

            if (token.endsWith("all")) {
                all = token;
                continue;
            }

            if (token.includes("=")) {
                const [key, value] = token.split("=", 2);
                modifiers[key] = value;
            } else {
                mechanisms.push(token);
            }
        }

        return {
            valid: true,
            version: "spf1",
            mechanisms,
            modifiers,
            all
        };
    } catch (e) {
        return { valid: false, error: (e as Error).message };
    }
}
