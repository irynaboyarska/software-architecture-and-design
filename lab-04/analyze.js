const fs = require("fs");
const { parseArgs } = require("util");

const REQUIRED = [
  "period",
  "engineering_hours",
  "changes",
  "modules_per_change",
  "rollback_rate",
  "incidents",
];

const THRESHOLDS = {
  modules_per_change: 3.0, // > N модулів на зміну
  engineering_hours: 24.0, // > N год на зміну (2x від baseline 12)
  rollback_rate: 0.05, // > 5% production-змін
  incidents: 2.0, // > N incidents на місяць
};
const LABELS = {
  modules_per_change: "modules touched/change",
  engineering_hours: "engineering hours/change",
  rollback_rate: "rollback rate",
  incidents: "incidents/month",
};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadRows(path) {
  const lines = fs
    .readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) fail("CSV порожній.");
  const header = lines[0].split(",").map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length)
    fail(`У CSV немає обов'язкових колонок: ${missing.join(", ")}`);

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const raw = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    const row = { period: raw.period };
    for (const col of REQUIRED.slice(1)) {
      row[col] = Number(raw[col]);
      if (Number.isNaN(row[col]))
        fail(`Некоректне число в колонці ${col} (період ${raw.period}).`);
    }
    return row;
  });
  if (rows.length < 2)
    fail("Потрібно щонайменше два періоди (baseline та поточний).");
  return rows;
}

function pick(rows, name, defaultIndex) {
  if (name === undefined) return rows.at(defaultIndex);
  const found = rows.find((r) => r.period === name);
  if (!found) fail(`Період '${name}' не знайдено в CSV.`);
  return found;
}

const num = (x) => String(Number(x.toFixed(2)));
const usd = (x) => `${Math.round(x).toLocaleString("en-US")} USD`;
const pct = (x) => `${Math.round(x * 100)}%`;

const options = {
  csv: { type: "string", default: "data/metrics.csv" },
  "baseline-period": { type: "string" },
  "current-period": { type: "string" },
  // What-if параметри
  "hourly-cost": { type: "string", default: "35" },
  impact: { type: "string", default: "4000" },
  changes: { type: "string" },
  "investment-hours": { type: "string", default: "320" },
  "savings-share": { type: "string", default: "0.25" },
  "failure-savings-share": { type: "string", default: "0" },
  "payback-good": { type: "string", default: "6" },
  "payback-max": { type: "string", default: "12" },
  "th-modules-per-change": {
    type: "string",
    default: String(THRESHOLDS.modules_per_change),
  },
  "th-engineering-hours": {
    type: "string",
    default: String(THRESHOLDS.engineering_hours),
  },
  "th-rollback-rate": {
    type: "string",
    default: String(THRESHOLDS.rollback_rate),
  },
  "th-incidents": { type: "string", default: String(THRESHOLDS.incidents) },
};
const { values: v } = parseArgs({ options });

const hourlyCost = Number(v["hourly-cost"]);
const impact = Number(v.impact);
const changesOverride = v.changes !== undefined ? Number(v.changes) : null;
const investmentHours = Number(v["investment-hours"]);
const savingsShare = Number(v["savings-share"]);
const failureSavingsShare = Number(v["failure-savings-share"]);
const paybackGood = Number(v["payback-good"]);
const paybackMax = Number(v["payback-max"]);
const thresholds = {
  modules_per_change: Number(v["th-modules-per-change"]),
  engineering_hours: Number(v["th-engineering-hours"]),
  rollback_rate: Number(v["th-rollback-rate"]),
  incidents: Number(v["th-incidents"]),
};

const rows = loadRows(v.csv);
const base = pick(rows, v["baseline-period"], 0);
const cur = pick(rows, v["current-period"], -1);

const baseCost = base.engineering_hours * hourlyCost;
const baseFailure = base.incidents * impact;

console.log("=== Параметри сценарію ===");
console.log(
  `hourly cost: ${num(hourlyCost)} USD/год | impact: ${usd(impact)} | ` +
    `changes override: ${changesOverride !== null ? num(changesOverride) : "з CSV"}`,
);
console.log(
  `investment: ${num(investmentHours)} год | savings share (tax): ${pct(savingsShare)} | ` +
    `savings share (failures): ${pct(failureSavingsShare)}`,
);

console.log("\n=== Метрики по періодах ===");
const results = {};
for (const r of rows) {
  const changes = changesOverride !== null ? changesOverride : r.changes;
  const changeCost = r.engineering_hours * hourlyCost;
  const tax = (changeCost - baseCost) * changes;
  const failure = r.incidents * impact;
  const modPct =
    ((r.modules_per_change - base.modules_per_change) /
      base.modules_per_change) *
    100;
  results[r.period] = { changeCost, tax, failure, changes };

  const sign = modPct >= 0 ? "+" : "";
  console.log(`[${r.period}]`);
  console.log(
    `  ChangeCost: ${num(r.engineering_hours)} год x ${num(hourlyCost)} = ${usd(changeCost)}/зміну`,
  );
  console.log(
    `  Architecture Tax/month: (${usd(changeCost)} - ${usd(baseCost)}) x ${num(changes)} = ${usd(tax)}`,
  );
  console.log(
    `  ExpectedFailureCost/month: ${num(r.incidents)} x ${usd(impact)} = ${usd(failure)}`,
  );
  console.log(
    `  modules/change: ${num(r.modules_per_change)} (${sign}${Math.round(modPct)}% відносно baseline)`,
  );
}

const res = results[cur.period];
const failureDelta = res.failure - baseFailure;
console.log(`\n=== Підсумок: '${base.period}' -> '${cur.period}' ===`);
console.log(
  `Architecture Tax: ${usd(res.tax)}/міс; приріст ExpectedFailureCost: ${usd(failureDelta)}/міс`,
);
console.log(
  `Разом: ${usd(res.tax + failureDelta)}/міс (~${usd(12 * (res.tax + failureDelta))}/рік)`,
);

console.log("\n=== Review thresholds (поточний період) ===");
const crossed = [];
for (const [key, limit] of Object.entries(thresholds)) {
  const value = cur[key];
  const hit = value > limit;
  if (hit) crossed.push(key);
  const shown =
    key === "rollback_rate"
      ? `${pct(value)} > ${pct(limit)}`
      : `${num(value)} > ${num(limit)}`;
  console.log(`  ${LABELS[key]}: ${shown} -> ${hit ? "ПЕРЕТНУТО" : "в нормі"}`);
}
if (crossed.length >= 2) {
  console.log(
    `Перетнуто порогів: ${crossed.length} (>=2) -> архітектурне рішення потрібно ПЕРЕГЛЯНУТИ.`,
  );
} else {
  console.log(
    `Перетнуто порогів: ${crossed.length} (<2) -> окремого перегляду не потрібно.`,
  );
}

console.log("\n=== Інвестиція і break-even ===");
const investCost = investmentHours * hourlyCost;
const savings = res.tax * savingsShare + failureDelta * failureSavingsShare;
console.log(
  `InvestmentCost: ${num(investmentHours)} год x ${num(hourlyCost)} = ${usd(investCost)}`,
);
console.log(
  `MonthlySavings: ${usd(res.tax)} x ${pct(savingsShare)} + ` +
    `${usd(failureDelta)} x ${pct(failureSavingsShare)} = ${usd(savings)}/міс`,
);
if (savings <= 0) {
  console.log(
    "BreakEven: не досягається (економія <= 0) -> інвестиція не виправдана.",
  );
} else {
  const be = investCost / savings;
  console.log(
    `BreakEvenMonths: ${usd(investCost)} / ${usd(savings)} = ${be.toFixed(2)} міс.`,
  );
  let verdict;
  if (be <= paybackGood) verdict = `<= ${num(paybackGood)} міс. -> інвестувати`;
  else if (be <= paybackMax)
    verdict = `між ${num(paybackGood)} і ${num(paybackMax)} міс. -> інвестувати після пілоту`;
  else verdict = `> ${num(paybackMax)} міс. -> не інвестувати за цих припущень`;
  console.log(`Рішення: ${verdict}`);
}
