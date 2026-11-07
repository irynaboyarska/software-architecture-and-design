# Decision log

Для кожної суттєвої зміни скопіюйте секцію нижче. Обсяг одного рішення: 80–120 слів.

## Decision №1: Єдина нормалізація статусу в Payments

**Problem:** Orders, Reports і Notifications мають три однакові функції перетворення відповіді Stripe на статус, тому кожна зміна статусів вимагає правок у трьох модулях.

**Evidence:** orders/, reports/ і notifications/mapPaymentStatus.ts, рядки 3-7.

**Decision:** Одна функція normalizePaymentStatus у src/payments/paymentStatus.ts; три копії видалено, Orders імпортує її.

**Why:** Знання про стани provider належить Payments (information hiding), тому нова умова торкається одного файлу.

**Alternative:** Винести функцію в shared/utils.

**Why rejected:** shared не має власника, і знання про Stripe опинилося б у спільному коді, доступному всім модулям.

**Trade-off:** Orders тепер залежить від Payments, тому напрям залежностей потрібно контролювати далі.

**Verification:** Unit-тести normalizePaymentStatus і незмінені функціональні тести проходять.

## Decision №2: processing замінює pending

**Problem:** Набір статусів містить pending для requires_action, а change request додає processing із тим самим змістом: платіж ще не завершено.

**Evidence:** orders/mapPaymentStatus.ts:4 повертав pending; StripeClient.ts:18 ніколи не повертає requires_action.

**Decision:** Набір статусів paid, processing, failed; requires_action відображається в processing.

**Why:** Два статуси з однаковим змістом ускладнюють consumers, а pending був недосяжним, тому поведінка paid і failed не змінюється.

**Alternative:** Залишити pending поряд із processing.

**Why rejected:** Різниці в значенні немає, а кожен consumer мусив би обробляти зайву гілку.

**Trade-off:** Якщо Stripe справді поверне requires_action, клієнт побачить processing замість pending.

**Verification:** Unit-тест для processing; функціональні тести paid і failed проходять.

## Decision №3: невідомий статус нормалізується у failed

**Problem:** Provider може повернути стан, якого система не знає: його не можна ні підтверджувати як paid, ні ламати через нього checkout.

**Evidence:** orders/mapPaymentStatus.ts:6 повертав failed для всього, окрім succeeded і requires_action.

**Decision:** normalizePaymentStatus повертає failed для будь-якого невідомого значення.

**Why:** Замовлення не підтверджується без відомого успіху, статус лишається payment_pending, а поведінка збігається з наявною.

**Alternative:** Кидати помилку для невідомого стану.

**Why rejected:** Виняток після списання залишків залишає замовлення без чіткого статусу.

**Trade-off:** Реально успішний платіж із новою назвою стану тимчасово показується як failed, доки не оновлено нормалізацію.

**Verification:** Unit-тест із невідомим станом очікує failed.
