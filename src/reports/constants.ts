export const KNOWN_PROVIDERS = [
    { name: "Google", ranges: ["209.85.", "172.217.", "142.250.", "74.125."] },
    { name: "Microsoft", ranges: ["40.92.", "40.107.", "52.96.", "65.55."] },
    { name: "Amazon SES", ranges: ["54.240.", "23.249.", "23.251."] },
    { name: "Mailchimp", ranges: ["198.2.", "205.201."] },
    { name: "SendGrid", ranges: ["167.89.", "169.45."] }
];

export const PRIVATE_IP_RANGES = [
    "192.168.",
    "10.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31."
];

export const ZIP_FILENAME_PATTERNS = {
    // google.com!solomonlabs.org!1762560000!1762646400.zip
    google: /google\.com!.*!(\d{10})!\d{10}/,

    // yahoo.com-foo-1762560000-1762646400.zip
    yahoo: /yahoo\.com-.*-(\d{10})-\d{10}/,

    // Microsoft DMARC reports:
    // - microsoft.com_example.com_1762560000_1762646400.zip
    // - outlook.com_example.com_1762560000_1762646400.zip
    // - enterprise.protection.outlook.com!example.com!1762560000!1762646400(.xml.gz)?.zip
    microsoft: /(?:microsoft\.com|outlook\.com|enterprise\.protection\.outlook\.com)[!_].*?(\d{10})[!_]\d{10}/,

    // Amazon SES DMARC reports:
    // amazonses.com!example.com!1762560000!1762646400(.xml.gz)?.zip
    // or straight amazonses.com!example.com!1762560000!1762646400.xml.gz
    amazonSes: /amazonses\.com[!_].*?(\d{10})[!_]\d{10}/
};
