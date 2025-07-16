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
    google: /google\.com!.*!(\d{10})!\d{10}/,
    yahoo: /yahoo\.com-.*-(\d{10})-\d{10}/,
    microsoft: /(microsoft\.com|outlook\.com)_.*_(\d{10})_\d{10}/
};
