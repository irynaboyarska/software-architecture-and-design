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

## Decision №4: Публічний контракт Payments

**Problem:** Checkout збирав payload Stripe, а Orders створював StripeClient, тому додавання provider змушувало змінювати обидва модулі.

**Evidence:** CheckoutController.ts:3 і 22-28, OrderService.ts:4 і 8-12 у початковому коді.

**Decision:** Payments експортує лише authorizePayment та типи PaymentRequest і PaymentResult у src/payments/index.ts; payload, client і мапінг Stripe стали internal.

**Why:** Знання про provider прихована за явним контрактом, тому consumers залежать тільки від нейтральних типів.

**Alternative:** Передавати в Orders інтерфейс provider, який реалізує кожен adapter.

**Why rejected:** Orders знав би про вибір і життєвий цикл provider, хоча це деталь Payments.

**Trade-off:** З'явився додатковий шар перетворення PaymentRequest у payload Stripe.

**Verification:** Тест контракту перевіряє форму результату, а функціональні тести Checkout проходять без змін.

## Decision №5: Напрям залежностей Orders → Payments

**Problem:** Payments імпортував orders/internal, а Orders імпортував Payments, тому утворився цикл, а createCharge приховано змінював замовлення.

**Evidence:** StripeClient.ts:1-2 і 20, OrderService.ts:4 у початковому коді.

**Decision:** Payments повертає PaymentResult і нічого не знає про Orders; статус замовлення встановлює лише Orders; orderMutations.ts видалено.

**Why:** Замовлення належить Orders, а залежність іде від модуля, що викликає, до модуля, що виконує.

**Alternative:** Залишити callback, який Payments викликає після оплати.

**Why rejected:** Це зберігає зворотну залежність і ускладнює міркування про порядок змін статусу.

**Trade-off:** Orders отримує результат синхронно, тому асинхронне підтвердження платежу потребуватиме нового рішення.

**Verification:** Пошук імпортів у src не знаходить шляху з Payments в Orders; усі тести проходять.

## Decision №6: Inventory захищає available ≥ 0

**Problem:** Orders напряму змінював database.stock по рядках, тому помилка в другому рядку лишала перший уже зменшеним.

**Evidence:** OrderService.ts:15-26 і StockRepository.ts:9-11 у початковому коді.

**Decision:** Inventory експортує reserveStock: вона спершу перевіряє всі позиції з урахуванням дублікатів, потім змінює залишки; InsufficientStockError не залишає змін.

**Why:** Інваріант має захищати його власник, бо зовнішній запис його обходить.

**Alternative:** Відкочувати вже списані позиції після помилки.

**Why rejected:** Відкат потребує компенсації й ламається, якщо збій стається між кроками; перевірка до змін цього не потребує.

**Trade-off:** Перевірка й запис не атомарні за паралельних запитів.

**Verification:** Unit-тести: часткова зміна, невідомий товар, дублікати, некоректна кількість.

## Decision №7: calculateTotal без прихованого стану

**Problem:** calculateTotal читала глобальний runtimeConfig, змінювала рядки кошика й писала в auditLog, тому результат залежав від прихованого стану.

**Evidence:** calculateTotal.ts:15 і 19-21 у початковому коді.

**Decision:** tax і discount передаються аргументом rules, рядки не змінюються, а запис в auditLog виконує CheckoutController після обчислення.

**Why:** Функцію можна зрозуміти й перевірити лише за аргументами, а side effect залишається на рівні orchestration.

**Alternative:** Передавати в функцію logger.

**Why rejected:** Side effect лишився б усередині обчислення, а залежність була б зайвою.

**Trade-off:** CheckoutController тепер знає про runtimeConfig і auditLog.

**Verification:** Тести із замороженими рядками, зміненим runtimeConfig і незмінним auditLog.
