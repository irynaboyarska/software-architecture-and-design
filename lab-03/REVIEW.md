# Architecture review

| #   | Principle            | Evidence (file:line)                                                                                                                      | Practical risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                        |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Information hiding   | `src/checkout/CheckoutController.ts:3`, `:22-28`                                                                                          | Controller імпортує `StripePayload` з `payments/internal` і сам збирає Stripe-специфічний payload (`id`, `amount`, `metadata`). Другий provider матиме інший формат запиту, тому довелося б змінювати Checkout, хоча він не має знати нічого про provider. Будь-яка зміна полів Stripe ламає transport-шар.                                                                                                                                                                                       | Checkout передає provider-neutral запит (orderId, paymentToken, amount, currency) у публічний API Payments. Побудову provider payload переносимо в adapter усередині Payments.                                             |
| 2   | Explicit contracts   | `src/orders/OrderService.ts:4`, `:8-12`, `:14`, `:29-30`                                                                                  | Orders імпортує `StripeClient` з internal-папки, сам створює його в конструкторі і приймає `StripePayload` в сигнатурі `placeOrder`. Публічного контракту Payments немає, тому щоб додати provider, треба змінювати Orders (конструктор, сигнатуру, виклик). Тести Orders не можна запустити без Stripe-типів.                                                                                                                                                                                    | Створити публічний контракт Payments (наприклад `authorize(request) -> PaymentResult` зі стабільним статусом). Orders залежить лише від нього; конкретний provider підставляється ззовні.                                  |
| 3   | Dependency direction | `src/payments/internal/StripeClient.ts:1-2`, `:20`; `src/orders/internal/orderMutations.ts:3-8`; `src/orders/OrderService.ts:4`, `:32-33` | Виникає цикл Orders ↔ Payments: Orders імпортує Stripe (`OrderService.ts:4`), Stripe імпортує `orders/internal` (`StripeClient.ts:2`). `createCharge` приховано змінює замовлення (`:20`), тобто виклик «створити платіж» має side effect у чужому модулі. Логіка `paid → confirmed, інакше payment_pending` дубльована в `orderMutations.ts:6` і `OrderService.ts:33`: нова гілка `processing` вимагає правок у двох місцях, і при розбіжності статус замовлення залежить від порядку виконання. | Payments не знає про Orders: adapter лише повертає результат. Статус замовлення оновлює тільки Orders після отримання `PaymentResult`. Видалити `orderMutations.ts` як окремий шлях запису.                                |
| 4   | Ownership            | `src/orders/OrderService.ts:15-26`; `src/inventory/StockRepository.ts:9-11`; `src/database.ts:9-12`                                       | Orders напряму читає і пише `database.stock`; `updateAvailable` дозволяє записати будь-яке значення без перевірки. Інваріант `available >= 0` ніхто не захищає. Цикл списує товар по рядках: якщо другий рядок кошика недоступний, виняток (`:18`) вже після того, як перший рядок зменшено (`:22-25`). Результат: часткова зміна залишків і втрата товару без замовлення. Глобальний `database` доступний усім модулям, тому будь-який з них може обійти правила власника.                       | Inventory отримує публічну операцію `reserve(lines)` усе-або-нічого: спершу перевіряє всі позиції, потім змінює. Orders більше не торкається `database.stock`; `updateAvailable` стає internal.                            |
| 5   | Design for change    | `src/orders/mapPaymentStatus.ts:3-7`; `src/reports/mapPaymentStatus.ts:3-7`; `src/notifications/mapPaymentStatus.ts:3-7`                  | Три ідентичні копії перетворення Stripe-відповіді в статус, і кожна імпортує `StripeResponse` з `payments/internal` (рядок 1). Новий статус `processing` або другий provider потребує однакової правки в трьох модулях; якщо забути одну копію, Orders, Reports і Notifications покажуть різні статуси для того самого платежу. Невідомий `state` стає `failed` (`:6`).                                                                                                                           | Одна функція нормалізації всередині Payments, яка перетворює provider response на стабільний статус системи. Для невідомого значення визначити безпечну поведінку й зафіксувати її тестом. Копії в інших модулях видалити. |
| 6   | Local reasoning      | `src/shared/calculateTotal.ts:15`, `:19-20`, `:21`; `tests/checkout.functional.test.ts:9-11`                                              | Функція читає глобальний `runtimeConfig` (`taxRate`, `discountPercent`), змінює вхідні рядки (`line.lineTotal`, `:15`) і пише в `auditLog` (`:21`). Результат залежить від прихованого стану, тож тест мусить скидати глобальні змінні перед кожним запуском (`tests:9-11`). Виклик непомітно змінює `request.lines` у Checkout, а зміна конфігу з іншого місця змінює суму оплати.                                                                                                               | Передавати `taxRate` і `discountPercent` аргументами, не мутувати рядки (рахувати локально й повертати значення), логування винести на рівень orchestration після обчислення.                                              |

## Change impact prediction (заповнити до реалізації change request)

**Requirement:** Підтримати другий навчальний payment provider і новий нормалізований статус `processing` без зміни публічного Checkout API та поведінки сценаріїв `paid` і `failed`. Provider-specific payload, response і назви статусів не виходять за межі Payments.

**Expected files:**

- `src/payments/**`: новий публічний API Payments, єдина функція нормалізації статусу, adapter для Stripe (поточний `StripeClient`), другий adapter, спосіб вибору provider;
- `src/orders/OrderService.ts`: залежність лише від публічного контракту Payments і Inventory, статус замовлення для `processing`;
- `src/checkout/CheckoutController.ts`: прибрати побудову `StripePayload`, викликати provider-neutral контракт;
- `src/inventory/**`: публічна операція `reserve`, приховування `updateAvailable`;
- `src/shared/calculateTotal.ts`: явні `taxRate` і `discountPercent`, без мутації та логування;
- `src/orders/mapPaymentStatus.ts`, `src/reports/mapPaymentStatus.ts`, `src/notifications/mapPaymentStatus.ts`: видалення дублікатів (споживачі беруть стабільний статус із Payments);
- `src/orders/internal/orderMutations.ts`: видалення або перетворення на internal-код Orders без виклику з Payments;
- `package.json` і новий скрипт перевірки архітектури;
- `tests/**`: нові unit-тести, наявні функціональні тести залишаються без змін.

**Modules that should not change:**

- `src/database.ts` (схема сховища не змінюється);
- `src/demo.ts` і форма публічної відповіді Checkout (`orderId`, `status`, `total`, `paymentStatus`);
- наявні тести в `tests/checkout.functional.test.ts`;
- Reports і Notifications: після видалення локальних копій мапінгу їхня поведінка не залежить від того, скільки provider підключено;
- додавання третього provider має торкатися лише `src/payments/**`.

## Actual impact (заповнити після реалізації)

**Actual files changed:**

- src/payments: нові index.ts, types.ts, internal/provider.ts, internal/registry.ts, internal/stripeAdapter.ts, internal/stripeStatus.ts, internal/AcmePayClient.ts, internal/acmePayAdapter.ts, internal/acmePayStatus.ts; змінено internal/StripeClient.ts;
- src/orders/OrderService.ts; видалено src/orders/internal/orderMutations.ts;
- src/checkout/CheckoutController.ts;
- src/inventory: новий index.ts; видалено StockRepository.ts;
- src/shared/calculateTotal.ts;
- видалено mapPaymentStatus.ts в orders, reports і notifications;
- scripts/architecture-checks.ts і scripts/check-architecture.ts; у package.json додано скрипт check:architecture;
- ADR-001-payments-boundary.md і README.md;
- нові тести: paymentStatus.unit, acmePayStatus.unit, payments.contract, payments.providers, inventory.unit, calculateTotal.unit, checkout.contract, architecture;
- package.json, package-lock.json, tsconfig.json: типи Node для редактора.

**Difference from prediction and explanation:**

- Reports і Notifications: прогноз передбачав видалення дублікатів, і це єдина зміна в них; після неї в цих папках немає коду, бо вони містили лише копії мапінгу.
- src/inventory: StockRepository.ts не перетворено на internal, а видалено, бо ніхто його не використовував, а його updateAvailable дозволяв обійти інваріант.
- src/payments: окрім прогнозованих файлів знадобився types.ts, щоб публічні типи не залежали від internal-коду, а також provider.ts і registry.ts для вибору provider.
- OrderService змінився сильніше за прогноз: прибрано залежність від provider, і конструктор приймає функцію authorizePayment.
- Другий provider змінив лише src/payments/\*\* і тести: Checkout, Orders, Reports і Notifications не змінювалися, як і прогнозувалося.
- src/database.ts, src/demo.ts, config.ts і форма відповіді Checkout не змінилися, як і прогнозувалося.
