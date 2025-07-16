/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * From https://stackoverflow.com/questions/16742578/bigdecimal-in-javascript
 * Allows use of bigint, in place of having to use a separate library (native functions are fast).
 * This shifts all numbers fed to it by `#DECIMALS` places, so 1.2345 becomes 123450000000000000.
 * Then all operations operate on this shifted number for precision.
 * Passed safe integers can simply be converted and shifted.
 */
type ValidBigDecimalInput = BigDecimal | number | bigint | string;

export class BigDecimal {
    static [Symbol.hasInstance](value: unknown): boolean {
        if (typeof value !== "object" || value === null) return false;

        const ctor = (value as any).constructor;

        return (
            typeof (value as any).add === "function" &&
            typeof (value as any).subtract === "function" &&
            ctor !== null &&
            typeof ctor.SHIFT === "bigint"
        );
    }

    // Configuration: private constants
    static readonly #DECIMALS = 18; // Number of decimals on all instances
    static readonly #ROUNDED = true; // Numbers are truncated (false) or rounded (true)
    static SHIFT = BigInt(`1${"0".repeat(BigDecimal.#DECIMALS)}`); // Derived constant
    static readonly #fromBigInt = Symbol(); // Secret to allow construction with given #n value
    n!: bigint; // the BigInt that will hold the BigDecimal's value multiplied by #SHIFT, this isn't private as we need this raw value for sorting elswhere
    _str?: string; // cached canonical string for repeated toString calls
    static NaN: BigDecimal;
    static readonly DECIMALS = BigDecimal.#DECIMALS;
    static readonly ROUNDED = BigDecimal.#ROUNDED;

    constructor(value: ValidBigDecimalInput, convert?: symbol) {
        if (value instanceof BigDecimal) return value;
        if (convert === BigDecimal.#fromBigInt) {
            // Can only be used within this class
            this.n = <bigint>value;
            return;
        }
        // Store typeof result once
        const valueType = typeof value;
        // Fast cache lookup (string key)
        const str = valueType === "string" ? (value as string) : String(value);
        if (str.length <= maxCacheKeyLength && str in COMMON_CACHE) {
            return COMMON_CACHE[str];
        }
        // Fast path for safe integers
        if (valueType === "number") {
            if (Number.isSafeInteger(value)) {
                this.n = BigInt(value) * SHIFT;
                return;
            }
            // Handle special float values
            if (!Number.isFinite(value)) {
                if (Number.isNaN(value)) {
                    // Return NaN instance
                    return BigDecimal.NaN;
                }
                throw new Error("BigDecimal cannot represent Infinity");
            }
        }

        // Fast path for strings
        if (valueType === "string") {
            // Handle empty string
            if (value === "") {
                throw new Error("BigDecimal cannot parse empty string");
            }

            // Fast path for integers (no decimal point)
            if (!(value as string).includes(".")) {
                // Handle leading/trailing whitespace
                const trimmed = (value as string).trim();
                if (trimmed !== value) {
                    this.n = BigInt(trimmed) * SHIFT;
                    return;
                }
                this.n = BigInt(value) * SHIFT;
                return;
            }

            // Fast path for common decimal patterns
            const dotIndex = (value as string).indexOf(".");
            if (dotIndex !== -1) {
                const ints = (value as string).slice(0, dotIndex);
                const decis = (value as string).slice(dotIndex + 1);

                // Optimize for short decimal strings
                if (decis.length <= DEC) {
                    this.n = BigInt(ints + decis.padEnd(DEC, "0")) + BigInt(ROUNDED && decis[DEC] >= "5");
                    return;
                }

                // Handle long decimal strings (slice instead of padEnd)
                this.n = BigInt(ints + decis.slice(0, DEC).padEnd(DEC, "0")) + BigInt(ROUNDED && decis[DEC] >= "5");
                return;
            }
        }

        if (valueType !== "string" && valueType !== "number" && valueType !== "bigint") {
            throw new Error(`BigDecimal invalid input type: ${valueType}`);
        }

        // Fallback: convert to string and parse
        const [ints, decis = ""] = str.split(".");
        this.n = BigInt(ints + decis.padEnd(DEC, "0").slice(0, DEC)) + BigInt(ROUNDED && decis[DEC] >= "5");
    }
    add(num: ValidBigDecimalInput): BigDecimal {
        if (num === "0" || num === 0) {
            return this;
        }
        return new BigDecimal(
            this.n + (num instanceof BigDecimal ? num.n : new BigDecimal(num).n),
            BigDecimal.#fromBigInt
        );
    }
    subtract(num: ValidBigDecimalInput): BigDecimal {
        if (num === "0" || num === 0) {
            return this;
        }
        return new BigDecimal(
            this.n - (num instanceof BigDecimal ? num.n : new BigDecimal(num).n),
            BigDecimal.#fromBigInt
        );
    }
    static #divRound(dividend: bigint, divisor: bigint): BigDecimal {
        return new BigDecimal(
            dividend / divisor + (ROUNDED ? ((dividend * 2n) / divisor) % 2n : 0n),
            BigDecimal.#fromBigInt
        );
    }
    multiply(num: ValidBigDecimalInput): BigDecimal {
        if (num === "1" || num === 1) {
            return this;
        }
        if (num === "0" || num === 0) {
            return ZERO_CACHED;
        }
        if (num === "-1" || num === -1) {
            return new BigDecimal(-this.n, BigDecimal.#fromBigInt);
        }
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return BigDecimal.#divRound(this.n * BigInt(num), 1n);
        }
        return BigDecimal.#divRound(this.n * (num instanceof BigDecimal ? num.n : new BigDecimal(num).n), SHIFT);
    }
    divide(num: ValidBigDecimalInput): BigDecimal {
        if (num === "1" || num === 1) {
            return this;
        }
        return BigDecimal.#divRound(this.n * SHIFT, num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    pow(exponent: ValidBigDecimalInput): BigDecimal {
        const exp = exponent instanceof BigDecimal ? exponent : new BigDecimal(exponent);

        // Handle special cases
        if (exp.eq(0)) return ONE_CACHED;
        if (exp.eq(1)) return this;
        if (this.eq(0)) return ZERO_CACHED;
        if (this.eq(1)) return ONE_CACHED;

        // For integer exponents, use efficient repeated multiplication
        if (exp.significantDigits() === 0) {
            const expNum = exp.toNumber();
            if (expNum < 0) {
                return ONE_CACHED.divide(this.pow(-expNum));
            }

            let result = ONE_CACHED;
            let base = new BigDecimal(this.n, BigDecimal.#fromBigInt);
            let n = expNum;

            while (n > 0) {
                if (n % 2 === 1) {
                    result = result.multiply(base);
                }
                base = base.multiply(base);
                n = Math.floor(n / 2);
            }

            return result;
        }

        // For fractional exponents, convert to regular numbers (precision loss warning)
        const baseNum = this.toNumber();
        const expNum = exp.toNumber();
        return new BigDecimal(Math.pow(baseNum, expNum));
    }
    static pow10(exponent: number): BigDecimal {
        if (!Number.isInteger(exponent)) {
            throw new Error("pow10 only accepts whole numbers");
        }

        if (exponent === 0) return ONE_CACHED;
        if (exponent === 1) return new BigDecimal(10);

        if (exponent < 0) {
            const absExp = -exponent;
            const powerOfTen = `1${"0".repeat(absExp)}`;
            return ONE_CACHED.divide(powerOfTen);
        }

        const powerOfTen = `1${"0".repeat(exponent)}`;
        return new BigDecimal(powerOfTen);
    }
    shiftPow10(exponent: number): BigDecimal {
        if (!Number.isInteger(exponent)) {
            throw new Error("shiftPow10 only accepts whole numbers");
        }

        if (exponent === 0) return this;

        if (exponent > 0) {
            // Shift left (multiply): move decimal point right
            const shift = BigInt(10 ** exponent);
            return new BigDecimal(this.n * shift, BigDecimal.#fromBigInt);
        } else {
            // Shift right (divide): move decimal point left
            const shift = BigInt(10 ** -exponent);
            return BigDecimal.#divRound(this.n, shift);
        }
    }
    round(significantDigits: number): BigDecimal {
        const shift = BigInt(10 ** (DEC - significantDigits));
        const roundedResult = BigDecimal.#divRound(this.n, shift).multiply(shift);
        return new BigDecimal(roundedResult.n, BigDecimal.#fromBigInt);
    }
    truncate(significantDigits: number): BigDecimal {
        const stringValue = this.toString();
        const dotIndex = stringValue.indexOf(".");
        if (dotIndex !== -1) {
            // If decimal point exists
            const truncatedString = stringValue.slice(0, dotIndex + significantDigits + 1);
            return new BigDecimal(truncatedString);
        } else {
            // If no decimal point, simply return the original number
            return this;
        }
    }
    static random(min: ValidBigDecimalInput, max: ValidBigDecimalInput): BigDecimal {
        const minBN = min instanceof BigDecimal ? min : new BigDecimal(min);
        const maxBN = max instanceof BigDecimal ? max : new BigDecimal(max);
        const range = maxBN.subtract(minBN);
        return new BigDecimal(Math.random()).multiply(range).add(minBN); //new BigDecimal(randomBn * range + minBN).divide(1000000n);
    }
    lt(num: ValidBigDecimalInput): boolean {
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return this.n < BigInt(num) * SHIFT;
        }
        if (typeof num === "string" && num === "0") {
            return this.n < 0n;
        }
        return this.n < (num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    lte(num: ValidBigDecimalInput): boolean {
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return this.n <= BigInt(num) * SHIFT;
        }
        if (typeof num === "string" && num === "0") {
            return this.n <= 0n;
        }
        return this.n <= (num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    gt(num: ValidBigDecimalInput): boolean {
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return this.n > BigInt(num) * SHIFT;
        }
        if (typeof num === "string" && num === "0") {
            return this.n > 0n;
        }
        return this.n > (num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    gte(num: ValidBigDecimalInput): boolean {
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return this.n >= BigInt(num) * SHIFT;
        }
        if (typeof num === "string" && num === "0") {
            return this.n >= 0n;
        }
        return this.n >= (num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    eq(num: ValidBigDecimalInput): boolean {
        if (typeof num === "number" && Number.isSafeInteger(num)) {
            return this.n === BigInt(num) * SHIFT;
        }
        if (typeof num === "string" && num === "0") {
            return this.n === 0n;
        }
        return this.n === (num instanceof BigDecimal ? num.n : new BigDecimal(num).n);
    }
    abs(): BigDecimal {
        if (this.n < 0n) {
            return new BigDecimal(-this.n, BigDecimal.#fromBigInt);
        }

        return this;
    }
    // Compare function, i.e. for set sorting, array sorting
    cmp(num: ValidBigDecimalInput): number {
        const x = this.n;
        const y = num instanceof BigDecimal ? num.n : new BigDecimal(num).n;
        if (x < y) return -1;
        if (x > y) return 1;

        return 0;
    }
    toString(): string {
        if (this._str) return this._str; // cached
        if (this === NAN) return (this._str = "NaN");
        if (this.n === 0n) return (this._str = "0");
        if (this.n === SHIFT) return (this._str = "1");

        const neg = this.n < 0n;
        const abs = neg ? -this.n : this.n;

        // one division; derive remainder without %
        const intPartBig = abs / SHIFT;
        const fracPartBig = abs - intPartBig * SHIFT;

        const intStr = intPartBig.toString();
        const fracStr = formatFrac(fracPartBig);

        return (this._str = (neg ? "-" : "") + intStr + (fracStr ? `.${fracStr}` : ""));
    }

    // Common database query serialization hooks
    toPostgres(): string {
        return this.toString();
    }
    toMySQL(): string {
        return this.toString();
    }
    toSQLite(): string {
        return this.toString();
    }
    toFixed(length: number, withCommas = false, prefix = ""): string {
        if (this === NAN) return "NaN";

        // trivial 0 / 1 paths – pull from cached canonical
        if (this.n === 0n || this.n === SHIFT) {
            const base = this.toString(); // cached
            if (length === 0) return prefix + base;
            return `${prefix + base}.${ZERO_PAD.slice(0, length)}`;
        }

        // canonical string split once
        const [intRaw, fracRaw = ""] = this.toString().split(".");
        const intStr = withCommas ? intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : intRaw;

        // fractional part: slice + (maybe) pad from ZERO_PAD
        let frac = fracRaw.slice(0, length);
        if (frac.length < length) frac += ZERO_PAD.slice(0, length - frac.length);

        return prefix + intStr + (length ? `.${frac}` : "");
    }
    // Warning this is likely lossey for floating point numbers
    toNumber(): number {
        if (this === NAN) {
            return Number.NaN;
        }
        const stringValue = this.toString();

        if (stringValue.indexOf(".") !== -1) {
            return parseFloat(stringValue);
        } else {
            return parseInt(stringValue);
        }
    }
    getBigInt(): bigint {
        return this.n;
    }
    toJSON(): string {
        return this.toString();
    }
    static createNaN(): void {
        if (BigDecimal.NaN) {
            throw new Error("BigDecimal NaN already initialized");
        }
        BigDecimal.NaN = Object.create(BigDecimal.prototype);
    }
    isNaN(): boolean {
        return this === NAN;
    }
    significantDigits(): number {
        let rem: bigint;
        if (
            this === NAN || // NaN → 0 significant digits
            (rem = ((this.n % SHIFT) + SHIFT) % SHIFT) === 0n
        ) {
            return 0;
        }

        let digits = DEC;
        while (rem % 10n === 0n) {
            rem /= 10n;
            --digits;
        }
        return digits;
    }
    // Work out if two numbers are close together, same logic as pythons isclose function
    isClose(num: ValidBigDecimalInput): boolean {
        const other = num instanceof BigDecimal ? num : new BigDecimal(num);

        if (this.isNaN() || other.isNaN()) return false;
        if (this.eq(other)) return true;

        const diff = this.subtract(other).abs();
        const maxVal = this.abs().max(other.abs());

        // Adaptive tolerance based on magnitude
        let relativeTolerance: BigDecimal;
        let absoluteTolerance: BigDecimal;

        if (maxVal.gte("1000")) {
            // For large numbers, be more lenient
            relativeTolerance = new BigDecimal("0.000001"); // 1e-6
            absoluteTolerance = new BigDecimal("0.0001"); // 1e-4
        } else if (maxVal.gte("1")) {
            // For medium numbers
            relativeTolerance = new BigDecimal("0.0000001"); // 1e-7
            absoluteTolerance = new BigDecimal("0.0000001"); // 1e-7
        } else {
            // For small numbers
            relativeTolerance = new BigDecimal("0.0000000001"); // 1e-10
            absoluteTolerance = new BigDecimal("0.0000000001"); // 1e-10
        }

        const threshold = relativeTolerance.multiply(maxVal).max(absoluteTolerance);
        return diff.lte(threshold);
    }
    min(...args: ValidBigDecimalInput[]): BigDecimal {
        let min = new BigDecimal(this.n, BigDecimal.#fromBigInt);

        for (let i = 0, len = args.length; i < len; i++) {
            const check = args[i] instanceof BigDecimal ? <BigDecimal>args[i] : new BigDecimal(args[i]);

            if (check.n < min.n) {
                min = check;
            }
        }

        return min;
    }
    max(...args: ValidBigDecimalInput[]): BigDecimal {
        let max = new BigDecimal(this.n, BigDecimal.#fromBigInt);

        for (let i = 0, len = args.length; i < len; i++) {
            const check = args[i] instanceof BigDecimal ? <BigDecimal>args[i] : new BigDecimal(args[i]);

            if (check.n > max.n) {
                max = check;
            }
        }

        return max;
    }
    clone(): BigDecimal {
        return new BigDecimal(this.n, BigDecimal.#fromBigInt);
    }
}

BigDecimal.createNaN();

const SHIFT = BigDecimal.SHIFT; // 1 × 18-dec BigInt
const DEC = BigDecimal.DECIMALS; // 18
const ROUNDED = BigDecimal.ROUNDED;
const ZERO_PAD = "0".repeat(DEC); // "000000000000000000"
const NAN = BigDecimal.NaN; // NaN cache

const trimRightZeros = (s: string): string => {
    let end = s.length;
    while (s.charCodeAt(end - 1) === 48) --end; // '0'
    return end === s.length ? s : s.slice(0, end); // SlicedString – no copy
};

// Optimized - avoid string manipulation for small remainders
const formatFrac = (rem: bigint): string => {
    if (rem === 0n) return "";
    let s = rem.toString();
    if (s.length < DEC) s = ZERO_PAD.slice(s.length) + s;
    return trimRightZeros(s);
};

const COMMON_CACHE: { [index: string]: BigDecimal } = {};

// Helper to create BigDecimal without cache lookup
const createWithoutCache = (value: unknown): BigDecimal => {
    const bd = Object.create(BigDecimal.prototype);

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        bd.n = BigInt(value) * SHIFT;
        return bd;
    }

    if (typeof value === "string") {
        if (!value.includes(".")) {
            bd.n = BigInt(value) * SHIFT;
            return bd;
        }

        const [ints, decis] = value.split(".");
        bd.n = BigInt(ints + decis.padEnd(DEC, "0").slice(0, DEC)) + BigInt(ROUNDED && decis[DEC] >= "5");
        return bd;
    }

    // Fallback to string conversion
    const str = String(value);
    const [ints, decis] = str.split(".").concat("");
    bd.n = BigInt(ints + decis.padEnd(DEC, "0").slice(0, DEC)) + BigInt(ROUNDED && decis[DEC] >= "5");
    return bd;
};

let maxCacheKeyLength = 0;

// Initialize common values after class definition
const initializeCommonCache = (): void => {
    const commonValues = [
        0,
        1,
        -1,
        2,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000,
        "0.1",
        "0.01",
        "0.001",
        "0.0001",
        "0.00001",
        "0.000001",
        "0.5",
        "0.25",
        "0.75"
    ];

    for (const val of commonValues) {
        const key = val.toString();
        // Create without cache lookup to avoid recursion
        const bd = createWithoutCache(val);
        COMMON_CACHE[key] = bd;
        // Cache string internally
        bd.toString();

        if (key.length > maxCacheKeyLength) {
            maxCacheKeyLength = key.length;
        }
    }
};

initializeCommonCache();

const ZERO_CACHED = COMMON_CACHE[0]; // Cached Zero
const ONE_CACHED = COMMON_CACHE[1]; // Cached One
