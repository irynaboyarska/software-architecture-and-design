# Практична робота 4. Архітектура під змінами: вартість змін і економіка еволюції

Папка містить звіт (`REPORT.md`), вхідні дані (`data/metrics.csv`), скрипт аналізу (`analyze.js`) та збережені результати двох сценаріїв (`results/`).

## Вимоги

Node.js 18+. Зовнішні залежності та `npm install` не потрібні (використовуються лише вбудовані модулі `fs` і `util`).

## Формат CSV

Обов'язкові колонки: `period, engineering_hours, changes, modules_per_change, rollback_rate, incidents`.
Додаткові колонки (`lead_time_days, deploy_minutes, deployments_per_week, avg_pr_loc`) скрипт ігнорує.
Перший рядок вважається baseline, останній — поточним періодом (можна змінити через `--baseline-period` і `--current-period`).

```
period,engineering_hours,changes,modules_per_change,rollback_rate,incidents,lead_time_days,deploy_minutes,deployments_per_week,avg_pr_loc
baseline,12,20,1.8,0.02,1,2,8,5,180
current,31,20,4.6,0.09,4,6,24,2,510
```

## Запуск

Базовий сценарій:

```
node analyze.js --csv data/metrics.csv
```

Альтернативний what-if сценарій (економія інвестиції 10% замість 25%):

```
node analyze.js --csv data/metrics.csv --savings-share 0.10
```

## Параметри what-if

- `--hourly-cost` (35) — вартість інженерної години, USD
- `--impact` (4000) — середній бізнес-вплив incident, USD
- `--changes` — перевизначити кількість змін на місяць у всіх періодах
- `--investment-hours` (320) — одноразова вартість інвестиції, год
- `--savings-share` (0.25) — частка Architecture Tax, яку знімає інвестиція
- `--failure-savings-share` (0.0) — частка приросту ExpectedFailureCost, яку знімає інвестиція
- `--payback-good` (6), `--payback-max` (12) — межі рішення за break-even, міс.
- `--th-modules-per-change` (3.0), `--th-engineering-hours` (24), `--th-rollback-rate` (0.05), `--th-incidents` (2) — review thresholds

## Структура

```
lab-04/
├── README.md
├── REPORT.md
├── analyze.js
├── data/metrics.csv
└── results/
    ├── baseline.txt
    └── alternative.txt
```
