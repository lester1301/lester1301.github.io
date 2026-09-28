/* Builds CSV text. Values are quoted and escaped per RFC 4180. */
function csvCell(value) {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) lines.push(row.map(csvCell).join(","));
    return "\uFEFF" + lines.join("\r\n"); // BOM so Excel opens UTF-8 correctly
}

module.exports = { toCsv };
