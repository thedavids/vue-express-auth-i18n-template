const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuidCsv(csv) {
    if (typeof csv !== 'string' || csv.trim() === '') return [];
    return csv
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.toLowerCase())
        .filter(s => UUID_RE.test(s))        // keeps DB happy (avoids invalid uuid errors)
        .slice(0, 100);                      // optional: cap to 100 to avoid unbounded lists
}