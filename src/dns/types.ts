export interface DomainAuthRecords {
    domain: string;
    spf?: string;
    dmarc?: string;
    dkim?: string;
    spfParsed?: ParsedSpfRecord;
    dkimParsed?: ParsedDkimRecord;
    dmarcParsed?: ParsedDmarcRecord;
}

export type ParsedSpfRecord =
    | {
          valid: true;
          version: "spf1";
          mechanisms: string[];
          modifiers: Record<string, string>;
          all: string | null; // e.g., "-all", "~all"
      }
    | {
          valid: false;
          error: string;
      };

export type ParsedDkimRecord =
    | {
          valid: true;
          version: "DKIM1";
          keyType: string;
          publicKey: string;
          rawTags: Record<string, string>;
      }
    | {
          valid: false;
          error: string;
      };

export type ParsedDmarcRecord =
    | {
          valid: true;
          version: "DMARC1";
          policy: string;
          subdomainPolicy?: string;
          adkim?: string;
          aspf?: string;
          pct?: string;
          rua?: string[];
          ruf?: string[];
          fo?: string;
          rawTags: Record<string, string>;
      }
    | {
          valid: false;
          error: string;
      };

export interface ProviderDkimSelectors {
    provider: string;
    selectors: string[];
    spfIncludes?: string[];
    mxDomains?: string[];
}
