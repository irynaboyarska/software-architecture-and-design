# Architecture Lab 3

Практична робота 3: рефакторинг під зміну вимог (checkout backend).

**Автор:** Боярська Ірина

**Заявлений рівень:** 90

## Запуск

Потрібен Node.js 22.18 або новіший. Встановлювати залежності не потрібно.

```bash
npm test
npm run check:architecture
npm start
```

Provider оплати вибирається змінною `PAYMENT_PROVIDER` (`stripe` за замовчуванням або `acmepay`). Токен, що починається з `fail_`, дає failed, з `proc_` дає processing, інший дає paid.

## Перевірки

- `npm test`: функціональні тести Checkout, unit-тести нормалізації статусів, контракту Payments (обидва provider), Inventory (`reserveStock`), `calculateTotal` та самої перевірки архітектури.
- `npm run check:architecture`: завершується з кодом 1, якщо модуль імпортує internal-файл іншого модуля, Orders або Checkout напряму звертається до Inventory storage, або в імпортах файлів чи модулів є цикл.

## Структура

```text
src/payments/    публічний контракт у index.ts; adapters і мапінг статусів в internal/
src/inventory/   reserveStock, власник інваріанта available >= 0
src/orders/      OrderService, залежить лише від публічних API Payments і Inventory
src/checkout/    CheckoutController, публічний API не змінився
src/shared/      calculateTotal: чиста функція
scripts/         перевірка архітектури
tests/           тести
REVIEW.md        review до змін, prediction і Actual impact
DECISIONS.md     журнал рішень
ADR-001-payments-boundary.md   рішення про межу Payments
```
