export type DateLike = string | number | Date;

export enum DatePeriod {
    Daily = "Daily",
    Weekly = "Weekly",
    Monthly = "Monthly",
    Quarterly = "Quarterly",
    Yearly = "Yearly"
}

export class DateUtilError extends Error {
    constructor(
        message: string,
        public context?: Record<string, unknown>
    ) {
        super(message);
        this.name = "DateUtilError";
    }
}

/*
 * Provides utility functions for Dates, static only methods.
 */
export abstract class DateUtil {
    private constructor() {
        throw new DateUtilError("DateUtil is a static only utility class, cannot be instantiated.");
    }

    /*
     * Turn supplied date like parameter to a Date in UTC format.
     */
    static dateLikeToDateUtc(dateLike: DateLike): Date {
        if (typeof dateLike === "number") {
            if (!Number.isFinite(dateLike)) {
                throw new Error(`Invalid number: ${dateLike}`);
            }

            // Basic timestamp validation (reasonable range)
            const ms = dateLike < 1e12 ? dateLike * 1000 : dateLike;

            // Check if timestamp is in reasonable range (1970-01-01 to ~2286-11-20)
            if (ms < 0 || ms > 8.64e15) {
                throw new DateUtilError(`Timestamp out of valid range: dateLike=${dateLike}`);
            }

            return new Date(ms);
        }

        if (dateLike instanceof Date) {
            return new Date(dateLike.getTime());
        }

        if (typeof dateLike === "string") {
            const trimmed = dateLike.trim();

            // Quick check for timezone indicators - if found, use native parsing
            if (
                trimmed.includes("T") ||
                trimmed.includes("Z") ||
                trimmed.includes("+") ||
                trimmed.includes("GMT") ||
                trimmed.includes("UTC")
            ) {
                return new Date(trimmed);
            }

            // Fast path for common formats using indexOf and split
            const spaceIndex = trimmed.indexOf(" ");
            const datePart = spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex);
            const timePart = spaceIndex === -1 ? null : trimmed.substring(spaceIndex + 1);

            // Determine separator and parse date part
            let separator = "-";
            if (datePart.indexOf("/") !== -1) separator = "/";

            const dateParts = datePart.split(separator);
            if (dateParts.length !== 3) {
                // Fallback to native parsing
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return parsed;
                throw new DateUtilError(`Unable to parse date string: dateLike=${dateLike}`);
            }

            // Fast integer parsing with validation
            const part1 = parseInt(dateParts[0], 10);
            const part2 = parseInt(dateParts[1], 10);
            const part3 = parseInt(dateParts[2], 10);

            // Check for NaN values
            if (isNaN(part1) || isNaN(part2) || isNaN(part3)) {
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return parsed;
                throw new DateUtilError(`Unable to parse date string: dateLike=${dateLike}`);
            }

            // Determine format based on first part length/value
            let year: number, month: number, day: number;
            if (part1 > 31) {
                // YYYY-MM-DD format
                year = part1;
                month = part2;
                day = part3;
            } else {
                // DD-MM-YYYY format
                day = part1;
                month = part2;
                year = part3;
            }

            // Parse time part if present
            let hour = 0,
                minute = 0,
                second = 0,
                ms = 0;
            if (timePart) {
                const colonIndex1 = timePart.indexOf(":");
                if (colonIndex1 !== -1) {
                    const hourStr = timePart.substring(0, colonIndex1);
                    hour = parseInt(hourStr, 10);
                    if (isNaN(hour)) hour = 0;

                    const colonIndex2 = timePart.indexOf(":", colonIndex1 + 1);
                    if (colonIndex2 !== -1) {
                        const minuteStr = timePart.substring(colonIndex1 + 1, colonIndex2);
                        minute = parseInt(minuteStr, 10);
                        if (isNaN(minute)) minute = 0;

                        const secondPart = timePart.substring(colonIndex2 + 1);
                        const dotIndex = secondPart.indexOf(".");
                        if (dotIndex !== -1) {
                            const secondStr = secondPart.substring(0, dotIndex);
                            second = parseInt(secondStr, 10);
                            if (isNaN(second)) second = 0;

                            const msStr = secondPart.substring(dotIndex + 1);
                            ms = parseInt(msStr.padEnd(3, "0").substring(0, 3), 10);
                            if (isNaN(ms)) ms = 0;
                        } else {
                            second = parseInt(secondPart, 10);
                            if (isNaN(second)) second = 0;
                        }
                    } else {
                        const minuteStr = timePart.substring(colonIndex1 + 1);
                        minute = parseInt(minuteStr, 10);
                        if (isNaN(minute)) minute = 0;
                    }
                }
            }

            // Validate date components
            if (
                year < 1970 ||
                year > 3000 ||
                month < 1 ||
                month > 12 ||
                day < 1 ||
                day > 31 ||
                hour < 0 ||
                hour > 23 ||
                minute < 0 ||
                minute > 59 ||
                second < 0 ||
                second > 59
            ) {
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return parsed;
                throw new DateUtilError(`Unable to parse date string: dateLike=${dateLike}`);
            }

            return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
        }

        throw new DateUtilError(`Invalid DateLike type: dateLike=${typeof dateLike}`);
    }

    static startOfDayUtc(dateLike: DateLike): Date {
        const date = DateUtil.dateLikeToDateUtc(dateLike);
        date.setUTCHours(0, 0, 0, 0);

        return date;
    }

    static endOfDayUtc(dateLike: DateLike): Date {
        const date = DateUtil.dateLikeToDateUtc(dateLike);
        date.setUTCHours(23, 59, 59, 999);

        return date;
    }

    /**
     * Get days in a specific month
     */
    static getDaysInMonth(dateLike: DateLike): number {
        const date = DateUtil.dateLikeToDateUtc(dateLike);

        return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
    }

    /**
     * Get days in a specific quarter
     */
    static getDaysInQuarter(dateLike: DateLike): number {
        const date = DateUtil.dateLikeToDateUtc(dateLike);
        const quarter = Math.floor(date.getUTCMonth() / 3);

        const startMonth = quarter * 3;
        let totalDays = 0;

        for (let i = 0; i < 3; i++) {
            totalDays += this.getDaysInMonth(new Date(date.getUTCFullYear(), startMonth + i, 0));
        }

        return totalDays;
    }

    /**
     * Check if year is leap year
     */
    static isLeapYear(dateLike: DateLike): boolean {
        const date = DateUtil.dateLikeToDateUtc(dateLike);
        const year = date.getUTCFullYear();

        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    /**
     * Get number of days in a period for amortization
     */
    static getDaysInPeriod(period: DatePeriod | `${DatePeriod}`, referenceDate: DateLike): number {
        const date = DateUtil.startOfDayUtc(referenceDate);

        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (period) {
            case DatePeriod.Daily:
                return 1;
            case DatePeriod.Weekly:
                return 7;
            case DatePeriod.Monthly:
                return DateUtil.getDaysInMonth(date);
            case DatePeriod.Quarterly:
                return DateUtil.getDaysInQuarter(date);
            case DatePeriod.Yearly:
                return DateUtil.isLeapYear(date) ? 366 : 365;
            default:
                throw new DateUtilError(`Unsupported period: period=${period}`);
        }
    }

    static getDateRange(startDate: DateLike, endDate: DateLike): Date[] {
        const dates: Date[] = [];
        const current = DateUtil.startOfDayUtc(startDate);
        const end = DateUtil.endOfDayUtc(endDate);

        while (current <= end) {
            dates.push(current);
            current.setUTCDate(current.getUTCDate() + 1);
        }

        return dates;
    }

    static toPostgresDate(dateLike: DateLike): string {
        const date = DateUtil.dateLikeToDateUtc(dateLike);

        const month = date.getUTCMonth() + 1;
        const dayOfMonth = date.getUTCDate();
        return `${date.getUTCFullYear()}-${month.toString().padStart(2, "0")}-${dayOfMonth.toString().padStart(2, "0")}`;
    }

    static daysBetween(startDateLike: DateLike, endDateLike: DateLike): number {
        const startDate = DateUtil.dateLikeToDateUtc(startDateLike);
        const endDate = DateUtil.dateLikeToDateUtc(endDateLike);

        return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
    }

    /**
     * Parse relative date strings and return UTC Date objects
     */
    static parseRelativeDate(input: string): Date {
        const trimmed = input.trim().toLowerCase();
        const now = new Date();

        // Word-to-number mapping for text numbers
        const wordToNumber: { [key: string]: number } = {
            a: 1,
            an: 1,
            one: 1,
            two: 2,
            three: 3,
            four: 4,
            five: 5,
            six: 6,
            seven: 7,
            eight: 8,
            nine: 9,
            ten: 10,
            eleven: 11,
            twelve: 12,
            thirteen: 13,
            fourteen: 14,
            fifteen: 15,
            sixteen: 16,
            seventeen: 17,
            eighteen: 18,
            nineteen: 19,
            twenty: 20,
            thirty: 30,
            forty: 40,
            fifty: 50,
            sixty: 60,
            seventy: 70,
            eighty: 80,
            ninety: 90
        };

        // "X ago" patterns
        const agoMatch = trimmed.match(/^(.+)\s+ago$/);
        if (agoMatch) {
            const timePart = agoMatch[1].trim();

            // Try to parse "number unit" format (e.g., "30 days", "1 month")
            const numberUnitMatch = timePart.match(/^(\d+)\s+(.+)$/);
            if (numberUnitMatch) {
                const amount = parseInt(numberUnitMatch[1], 10);
                const unit = numberUnitMatch[2].toLowerCase();

                const result = new Date(now);

                if (unit.startsWith("second")) {
                    result.setUTCSeconds(result.getUTCSeconds() - amount);
                    return result;
                }

                if (unit.startsWith("minute")) {
                    result.setUTCMinutes(result.getUTCMinutes() - amount);
                    return result;
                }

                if (unit.startsWith("hour")) {
                    result.setUTCHours(result.getUTCHours() - amount);
                    return result;
                }

                if (unit.startsWith("day")) {
                    result.setUTCDate(result.getUTCDate() - amount);
                    return result;
                }

                if (unit.startsWith("week")) {
                    result.setUTCDate(result.getUTCDate() - amount * 7);
                    return result;
                }

                if (unit.startsWith("month")) {
                    result.setUTCMonth(result.getUTCMonth() - amount);
                    return result;
                }

                if (unit.startsWith("year")) {
                    result.setUTCFullYear(result.getUTCFullYear() - amount);
                    return result;
                }
            }

            // Try to parse "word unit" format (e.g., "thirty days", "a month", "one month")
            const wordUnitMatch = timePart.match(/^([a-z]+)\s+(.+)$/);
            if (wordUnitMatch) {
                const wordAmount = wordUnitMatch[1];
                const unit = wordUnitMatch[2].toLowerCase();

                // eslint-disable-next-line no-prototype-builtins
                if (wordToNumber.hasOwnProperty(wordAmount)) {
                    const amount = wordToNumber[wordAmount];
                    const result = new Date(now);

                    if (unit.startsWith("second")) {
                        result.setUTCSeconds(result.getUTCSeconds() - amount);
                        return result;
                    }

                    if (unit.startsWith("minute")) {
                        result.setUTCMinutes(result.getUTCMinutes() - amount);
                        return result;
                    }

                    if (unit.startsWith("hour")) {
                        result.setUTCHours(result.getUTCHours() - amount);
                        return result;
                    }

                    if (unit.startsWith("day")) {
                        result.setUTCDate(result.getUTCDate() - amount);
                        return result;
                    }

                    if (unit.startsWith("week")) {
                        result.setUTCDate(result.getUTCDate() - amount * 7);
                        return result;
                    }

                    if (unit.startsWith("month")) {
                        result.setUTCMonth(result.getUTCMonth() - amount);
                        return result;
                    }

                    if (unit.startsWith("year")) {
                        result.setUTCFullYear(result.getUTCFullYear() - amount);
                        return result;
                    }
                }
            }
        }

        // "next X" patterns
        const nextMatch = trimmed.match(/^next\s+(.+)$/);
        if (nextMatch) {
            const target = nextMatch[1];

            // "next 2am", "next 3pm", etc.
            const timeMatch = target.match(/^(\d{1,2})\s*(am|pm)$/);
            if (timeMatch) {
                const hour = parseInt(timeMatch[1], 10);
                const isPM = timeMatch[2] === "pm";

                let targetHour = hour;
                if (isPM && hour !== 12) targetHour += 12;
                if (!isPM && hour === 12) targetHour = 0;

                const nextTime = new Date(now);
                nextTime.setUTCHours(targetHour, 0, 0, 0);

                // If time has passed today, move to tomorrow
                if (nextTime <= now) {
                    nextTime.setUTCDate(nextTime.getUTCDate() + 1);
                }

                return nextTime;
            }

            // "next day"
            if (target === "day") {
                const nextDay = new Date(now);
                nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                nextDay.setUTCHours(0, 0, 0, 0);
                return nextDay;
            }

            // "next week"
            if (target === "week") {
                const nextWeek = new Date(now);
                nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
                nextWeek.setUTCHours(0, 0, 0, 0);
                return nextWeek;
            }

            // "next month"
            if (target === "month") {
                const nextMonth = new Date(now);
                nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
                nextMonth.setUTCHours(0, 0, 0, 0);
                return nextMonth;
            }

            // "next year"
            if (target === "year") {
                const nextYear = new Date(now);
                nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1, 0, 1);
                nextYear.setUTCHours(0, 0, 0, 0);
                return nextYear;
            }
        }

        // "in X" patterns
        const inMatch = trimmed.match(/^in\s+(\d+)\s*(.+)$/);
        if (inMatch) {
            const amount = parseInt(inMatch[1], 10);
            const unit = inMatch[2].toLowerCase();

            const result = new Date(now);

            if (unit.startsWith("second")) {
                result.setUTCSeconds(result.getUTCSeconds() + amount);
                return result;
            }

            if (unit.startsWith("minute")) {
                result.setUTCMinutes(result.getUTCMinutes() + amount);
                return result;
            }

            if (unit.startsWith("hour")) {
                result.setUTCHours(result.getUTCHours() + amount);
                return result;
            }

            if (unit.startsWith("day")) {
                result.setUTCDate(result.getUTCDate() + amount);
                return result;
            }

            if (unit.startsWith("week")) {
                result.setUTCDate(result.getUTCDate() + amount * 7);
                return result;
            }

            if (unit.startsWith("month")) {
                result.setUTCMonth(result.getUTCMonth() + amount);
                return result;
            }

            if (unit.startsWith("year")) {
                result.setUTCFullYear(result.getUTCFullYear() + amount);
                return result;
            }
        }

        // Special cases
        if (trimmed === "now") {
            return new Date(now);
        }

        if (trimmed === "today") {
            const today = new Date(now);
            today.setUTCHours(0, 0, 0, 0);
            return today;
        }

        if (trimmed === "tomorrow") {
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);
            return tomorrow;
        }

        if (trimmed === "yesterday") {
            const yesterday = new Date(now);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);
            return yesterday;
        }

        throw new DateUtilError(`Unable to parse relative date string: input=${input}`);
    }

    /**
     * Check if the given date is the last day of its month
     */
    static isLastDayOfMonth(dateLike: DateLike): boolean {
        const tomorrow = DateUtil.dateLikeToDateUtc(dateLike);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        return tomorrow.getUTCMonth() !== DateUtil.dateLikeToDateUtc(dateLike).getUTCMonth();
    }

    /**
     * Add specified number of months to a date
     */
    static addMonths(dateLike: DateLike, months: number): Date {
        const result = DateUtil.dateLikeToDateUtc(dateLike);
        result.setUTCMonth(result.getUTCMonth() + months);
        return result;
    }

    /**
     * Get the start of the month for the given date (first day at 00:00:00.000 UTC)
     */
    static startOfMonth(dateLike: DateLike): Date {
        const result = DateUtil.dateLikeToDateUtc(dateLike);
        result.setUTCDate(1);
        result.setUTCHours(0, 0, 0, 0);
        return result;
    }

    /**
     * Get the end of the month for the given date (last day at 23:59:59.999 UTC)
     */
    static endOfMonth(dateLike: DateLike): Date {
        const result = DateUtil.dateLikeToDateUtc(dateLike);
        result.setUTCMonth(result.getUTCMonth() + 1, 0); // Setting day to 0 gives last day of previous month
        result.setUTCHours(23, 59, 59, 999);
        return result;
    }

    /**
     * Get today's date at start of day (00:00:00.000 UTC)
     */
    static today(): Date {
        const now = new Date();
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        return today;
    }

    /**
     * Get tomorrow's date at start of day (00:00:00.000 UTC)
     */
    static tomorrow(now = new Date()): Date {
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow;
    }

    /**
     * Get yesterday's date at start of day (00:00:00.000 UTC)
     */
    static yesterday(now = new Date()): Date {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);
        return yesterday;
    }

    /*
     * Compare dates are the same using unix timestamp in milliseconds.
     */
    static equal(...args: DateLike[]): boolean {
        if (args.length < 2) {
            return true; // 0 or 1 dates are considered equal
        }

        const firstTime = DateUtil.dateLikeToDateUtc(args[0]).getTime();

        for (let i = 1; i < args.length; i++) {
            if (DateUtil.dateLikeToDateUtc(args[i]).getTime() !== firstTime) {
                return false;
            }
        }

        return true;
    }
}
