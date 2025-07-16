# DMARC Report Analyzer

Analyzes DMARC reports from ZIP files and generates comprehensive HTML reports to help you safely transition from `p=none` to `p=quarantine` to `p=reject`.

## Features

- **Smart ZIP File Sorting**: Automatically detects and sorts reports by timestamp
    - Google format: `google.com!domain.com!startTimestamp!endTimestamp.zip`
    - Yahoo format: `yahoo.com-domain.com-startTimestamp-endTimestamp.zip`
    - Microsoft format: `microsoft.com_domain.com_startTimestamp_endTimestamp.zip`
    - Generic fallback for other providers

- **Comprehensive Analysis**:
    - Authentication pass/fail rates with visual progress bars
    - Domain alignment analysis (DKIM vs SPF)
    - Top failing IP addresses for investigation
    - Policy recommendations based on failure rates

- **Policy Recommendations**:
    - ✅ Ready for `p=reject`: <1% failure rate
    - ⚠️ Consider `p=quarantine`: <5% failure rate
    - ❌ Stay with `p=none`: >5% failure rate

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Edit `.env` with your settings:

```bash
DMARC_REPORTS_DIR=./reports
DMARC_OUTPUT_PATH=./dmarc-report.html
DMARC_SORT_BY_TIMESTAMP=true
```

## Usage

### Using environment variables:

```bash
yarn run dev
```

### Using command line arguments:

```bash
tsx src/main.ts /path/to/reports output-report.html
```

### Priority order:

1. Command line arguments
2. Environment variables
3. Defaults (`./reports`, `./dmarc-report.html`)

## Report Structure

The generated HTML report includes:

- **Summary Statistics**: Total reports, messages, pass/fail rates
- **Authentication Results**: Visual breakdown of DMARC outcomes
- **Domain Alignment**: DKIM vs SPF alignment analysis
- **Top Failing Sources**: IP addresses requiring investigation
- **Policy Recommendations**: Next steps for DMARC policy progression

## Supported Providers

The analyzer recognizes timestamp formats from:

- **Google Workspace** (`google.com!domain!start!end.zip`)
- **Yahoo** (`yahoo.com-domain-start-end.zip`)
- **Microsoft** (`microsoft.com_domain_start_end.zip`)
- **Generic** (attempts to extract 10-digit timestamp)

Files are automatically sorted chronologically when `DMARC_SORT_BY_TIMESTAMP=true`.

## Example Output

```
[INFO] Starting DMARC analysis (Process)
[INFO] Reports directory: ./reports (Process)
[INFO] Output path: ./dmarc-report.html (Process)
[INFO] Sort by timestamp: true (Process)
[INFO] Found 15 ZIP files to process (DmarcAnalyzer)
[INFO] Sorted ZIP files by timestamp (DmarcAnalyzer)
[INFO] Processing google.com!testomain.com!1752364800!1752451199.zip (google, 2025-07-13) (DmarcAnalyzer)
[INFO] Analysis complete. Processed 15 reports covering 1,234 messages (Process)
[INFO] Pass rate: 98.50% (Process)
```
