// Reject impossible calendar dates instead of allowing JavaScript to roll them forward.
export function calendarDate(value) {
    if (typeof value !== 'string') return null;
    let parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    let year, month, day;
    if (parts) [, year, month, day] = parts.map(Number);
    else {
        parts = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
        if (!parts) return null;
        [, day, month, year] = parts.map(Number);
    }
    if (year < 1000 || year > 9999) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
