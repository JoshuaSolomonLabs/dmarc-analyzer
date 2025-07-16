# DMARC Analyzer

Analyze DMARC aggregate reports and generate rich, interactive HTML reports to help you monitor and improve your domain’s email authentication posture.

> Safely transition from `p=none` ➡ `p=quarantine` ➡ `p=reject` with confidence.

---

## ✨ Features

✅ **Smart ZIP File Handling**

- Automatically detects and sorts ZIP reports by timestamp:
    - **Google:** `google.com!domain!start!end.zip`
    - **Yahoo:** `yahoo.com-domain-start-end.zip`
    - **Microsoft:** `microsoft.com_domain_start_end.zip`
    - **Generic fallback** for other providers

✅ **Comprehensive Analysis**

- Pass/fail rates with visual progress bars
- DKIM and SPF domain alignment breakdown
- Trend charts of pass rates over time
- Top failing sources with risk classification
- Subdomain analysis and volume by reporting provider

✅ **Policy Recommendations**

- Automatic suggestions to move toward stricter policies based on failure rates
- Warnings for overly permissive SPF (`+all`) or excessive failures under `reject` policies

✅ **DNS Lookups (Optional)**

- SPF, DKIM, and DMARC records automatically resolved and explained
- Detection of known DKIM selectors for major providers

✅ **Beautiful HTML Reports**

- Styled, mobile-friendly HTML output
- Summaries, tables, failure details, and recommendations

---

## 📦 Installation

```bash
yarn install
```

---

## ⚙️ Configuration

You can configure via **environment variables**.

### Using `.env`:

Create a `.env` file (copy `.env.example`):

```dotenv
DMARC_REPORTS_DIR=./reports
DMARC_OUTPUT_PATH=./dmarc-report.html
DMARC_SORT_BY_TIMESTAMP=true
DMARC_ENABLE_DNS_LOOKUPS=true
DMARC_INCLUDE_TREND_CHART=true
```

- `DMARC_REPORTS_DIR`: Folder containing ZIP reports
- `DMARC_OUTPUT_PATH`: Path to output HTML report
- `DMARC_SORT_BY_TIMESTAMP`: Whether to sort ZIP files chronologically
- `DMARC_ENABLE_DNS_LOOKUPS`: Perform DNS lookups for SPF/DKIM/DMARC
- `DMARC_INCLUDE_TREND_CHART`: Include pass-rate chart in the report

---

## 🚀 Usage

### Run with environment configuration

```bash
yarn run dev
```

**Arguments priority order:**

1. Environment variables
2. Defaults

---

## 📈 Report Contents

The generated report includes:

- **Report Details**
    - Time range and reporting organizations
- **Summary Statistics**
    - Total reports and messages
    - Pass, quarantine, and fail rates
- **Trend Chart**
    - Daily pass rate over the reporting period
- **Authentication Results**
    - Detailed table of pass/quarantine/fail counts
- **Domain Alignment**
    - DKIM/SPF/ARC breakdown
- **Top Failing Sources**
    - IPs, providers, and dispositions
- **All Failures**
    - Every failed message with metadata
- **Domain Authentication Records**
    - Resolved SPF, DKIM, and DMARC with explanations
- **Recommendations**
    - Tailored policy guidance

---

## 🛠 Example

```bash
[INFO] Starting DMARC analysis (Process)
[INFO] Reports directory: ./reports (Process)
[INFO] Output path: ./dmarc-report.html (Process)
[INFO] Sort by timestamp: true (Process)
[INFO] Found 15 ZIP files to process (DmarcAnalyzer)
[INFO] Sorted ZIP files by timestamp (DmarcAnalyzer)
[INFO] Processing google.com!yourdomain.com!1752364800!1752451199.zip (google, 2025-07-13) (DmarcAnalyzer)
[INFO] Analysis complete. Processed 15 reports covering 1,234 messages (Process)
[INFO] Pass rate: 98.5% (Process)
```

---

## 🧩 Supported Providers

- **Google Workspace**
- **Yahoo**
- **Microsoft**
- **Generic ZIP filenames**

---

## ⚖️ License

MIT

---

## ✉️ Contact & Contributions

**Author:** [Joshua Richardson](https://github.com/JoshuaSolomonLabs)
**Issues:** [GitHub Issues](https://github.com/JoshuaSolomonLabs/dmarc-analyzer/issues)
