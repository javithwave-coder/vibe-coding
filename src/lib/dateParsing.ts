
// Month name lookup
const MONTH_MAP: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
};

/**
 * Extract a day number from a string like "10th", "1st", "22nd", "3rd"
 */
function extractDay(s: string): number | null {
    const m = s.match(/(\d{1,2})/);
    if (!m) return null;
    const d = parseInt(m[1], 10);
    return d >= 1 && d <= 31 ? d : null;
}

/**
 * Find the month index from a string containing a month name.
 * Returns -1 if not found.
 */
function findMonth(s: string): number {
    const lower = s.toLowerCase();
    for (const [name, idx] of Object.entries(MONTH_MAP)) {
        if (lower.includes(name)) return idx;
    }
    return -1;
}

/**
 * Parse date ranges like:
 *   "10th Jan"         → { start: Jan 10, end: null, text: "10th Jan" }
 *   "24th-25th Jan"    → { start: Jan 24, end: Jan 25 }
 *   "28th Feb-1st March" → { start: Feb 28, end: Mar 1 }
 *   "5th-8th March"    → { start: Mar 5, end: Mar 8 }
 *   "15th-22nd March"  → { start: Mar 15, end: Mar 22 }
 */
export function parseDateRange(raw: string): { startDate: string; endDate: string | null; dayCount: number } | null {
    if (!raw || !raw.trim()) return null;

    const text = raw.trim();
    const year = new Date().getFullYear();

    // Check if there's a range separator (hyphen between day/month parts)
    // Patterns: "24th-25th Jan" or "28th Feb-1st March" or "5th-8th March"
    const hyphenIdx = text.indexOf('-');

    if (hyphenIdx === -1) {
        // Single day: "10th Jan" or "1st February"
        const day = extractDay(text);
        const month = findMonth(text);
        if (day === null || month === -1) return null;

        const d = new Date(year, month, day, 12, 0, 0);
        if (isNaN(d.getTime())) return null;

        const pad = (n: number) => n.toString().padStart(2, '0');
        return { startDate: `${year}-${pad(month + 1)}-${pad(day)}`, endDate: null, dayCount: 1 };
    }

    // Range: split by hyphen
    const leftPart = text.substring(0, hyphenIdx).trim();
    const rightPart = text.substring(hyphenIdx + 1).trim();

    // Extract start day
    const startDay = extractDay(leftPart);
    if (startDay === null) return null;

    // Extract end day
    const endDay = extractDay(rightPart);
    if (endDay === null) return null;

    // Determine months
    const leftMonth = findMonth(leftPart);
    const rightMonth = findMonth(rightPart);

    let startMonth: number;
    let endMonth: number;

    if (rightMonth !== -1 && leftMonth !== -1) {
        // Both sides have months: "28th Feb-1st March"
        startMonth = leftMonth;
        endMonth = rightMonth;
    } else if (rightMonth !== -1) {
        // Only right has month: "24th-25th Jan" or "5th-8th March"
        startMonth = rightMonth;
        endMonth = rightMonth;
    } else if (leftMonth !== -1) {
        // Only left has month (unusual but handle): "Feb 28th-1st"
        startMonth = leftMonth;
        endMonth = leftMonth;
    } else {
        return null;
    }

    const startDate = new Date(year, startMonth, startDay, 12, 0, 0);
    const endDate = new Date(year, endMonth, endDay, 12, 0, 0);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

    // Calculate day count
    const msPerDay = 86400000;
    const dayCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);

    const pad = (n: number) => n.toString().padStart(2, '0');

    return {
        startDate: `${year}-${pad(startMonth + 1)}-${pad(startDay)}`,
        endDate: `${year}-${pad(endMonth + 1)}-${pad(endDay)}`,
        dayCount,
    };
}
