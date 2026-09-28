/* Build a per-day series for the last `days` days. */
function dailySeries(entries, days = 14) {
    // entries: [{ at: ISO string, amount: number }]
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        out.push({ date: dayKey(d), label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), amount: 0, orders: 0 });
    }

    const index = new Map(out.map((row, i) => [row.date, i]));
    for (const e of entries) {
        const key = dayKey(new Date(e.at));
        if (index.has(key)) {
            const row = out[index.get(key)];
            row.amount += e.amount;
            row.orders += 1;
        }
    }
    return out;
}

function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

module.exports = { dailySeries };
