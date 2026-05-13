````md
# DMS SOULUTION — برومبت كامل لحل النواقص وتحويل البرنامج إلى نظام مطعم إنتاجي حقيقي

أنت تعمل داخل مشروع:

DMS SOULUTION

وهو نظام مطعم / نقطة بيع POS / مخزون / محاسبة / طباعة / جلسات كاشير.

المطلوب منك تنفيذ صيانة وتطوير شاملين لحل النواقص الأساسية التي تمنع البرنامج من تشغيل مطعم حقيقي بشكل إنتاجي، بدون إعادة بناء المشروع من الصفر، وبدون تغيير التقنية الأساسية، وبدون حذف المنطق الموجود إلا إذا كان خاطئاً ويجب إصلاحه.

---

# الهدف النهائي

تحويل البرنامج إلى نسخة Production Candidate صالحة للتجربة داخل مطعم حقيقي، بحيث يدعم الحد الأدنى الإنتاجي التالي:

1. تشغيل المشروع من الصفر بدون أخطاء Build.
2. نقطة بيع POS عربية وسهلة وسريعة.
3. تصنيفات منتجات داخل POS.
4. حفظ الطلب بدون طباعة تلقائية.
5. طباعة الطلب بزر مستقل.
6. ربط الطباعة بقوالب الإيصال و KOT.
7. إدارة الطابعات والمسارات Print Routes.
8. فتح وإغلاق جلسات الكاشير بشكل محاسبي مضبوط.
9. حساب الصندوق المتوقع والفعلي وفروقات الصندوق.
10. منع إغلاق الجلسة بفرق كبير بدون موافقة مدير.
11. دعم الدفع النقدي والبطاقة والتحويل.
12. دعم طلبات الديلفري المعلقة.
13. عدم إدخال طلب الديلفري المعلق إلى الصندوق قبل التحصيل.
14. تحصيل طلبات الديلفري لاحقاً.
15. منع تحصيل نفس طلب الديلفري مرتين.
16. دعم المرتجعات بشكل مضبوط.
17. دعم إلغاء الطلب Void بشكل مضبوط.
18. منع الخصومات الكبيرة بدون صلاحية مدير.
19. ضبط المخزون ومنع البيع تحت الصفر عند منع ذلك.
20. دعم المنتجات المركبة Recipes واستهلاك مكوناتها.
21. إنشاء قيود محاسبية متوازنة.
22. منع تعديل القيود المرحلة.
23. تقارير تشغيل أساسية: Z Report، الصندوق، المبيعات، المرتجعات، الديلفري، المخزون.
24. Audit Log لكل العمليات الحساسة.
25. Backup / Restore.
26. تشغيل إنتاجي على كمبيوتر المطعم بدون الاعتماد على `npm run dev`.
27. واجهة عربية واضحة للكاشير والمدير.

---

# قواعد صارمة جداً

## ممنوع

- ممنوع إعادة بناء المشروع من الصفر.
- ممنوع حذف `apps/api`.
- ممنوع حذف `apps/web`.
- ممنوع حذف `apps/desktop`.
- ممنوع حذف قاعدة البيانات الحالية بدون Backup.
- ممنوع تصفير البيانات.
- ممنوع تعديل ملفات `dist` يدوياً.
- ممنوع استخدام بيانات وهمية.
- ممنوع ترك أزرار شكلية لا تعمل.
- ممنوع ترك TODO أو Placeholder في المسارات الأساسية.
- ممنوع تجاهل TypeScript Errors.
- ممنوع استخدام `any` كحل كسول.
- ممنوع كسر تسجيل الدخول.
- ممنوع كسر RTL أو اللغة العربية.
- ممنوع كسر صفحات المخزون.
- ممنوع كسر صفحات المحاسبة.
- ممنوع كسر صفحات الطباعة.
- ممنوع أن يقوم زر حفظ الطلب بالطباعة.
- ممنوع أن يقوم زر الطباعة بإنشاء طلب جديد.
- ممنوع إدخال طلب ديلفري معلق إلى الصندوق قبل التحصيل.
- ممنوع تحصيل طلب ديلفري مرتين.
- ممنوع إغلاق جلسة كاشير بفروقات صندوق غير موثقة.
- ممنوع إغلاق جلسة بفروقات كبيرة بدون موافقة مدير.
- ممنوع السماح برصيد مخزون سالب إذا `allowNegativeStock=false`.
- ممنوع ترحيل قيد محاسبي غير متوازن.
- ممنوع تعديل أو حذف قيد محاسبي POSTED.
- ممنوع تشغيل الإنتاج عبر `npm run dev`.
- ممنوع إظهار رسالة نجاح كاذبة للطباعة أو الحفظ أو التحصيل.

## مسموح

- إصلاح الحزم المفقودة أو إنشاؤها.
- إضافة migrations آمنة.
- إنشاء Backup قبل أي migration.
- تعديل API والواجهة بقدر الحاجة.
- تفكيك POS إلى Components وHooks.
- إضافة endpoints ضرورية.
- إضافة Services للسياسات والتحقق.
- إضافة Audit Log.
- تحسين الطباعة.
- تحسين العربية و RTL.
- إضافة Tests أو Manual Tests.
- إضافة وثائق تشغيل وصيانة.

---

# المرحلة 0 — تدقيق شامل قبل أي تعديل

قبل تعديل أي ملف، أنشئ:

```txt
docs/FULL_PRODUCTION_GAP_AUDIT.md
````

يجب أن يحتوي التقرير على:

## 1. بنية المشروع

افحص واكتب:

* التطبيقات الموجودة.
* الحزم الموجودة.
* الحزم المفقودة.
* Workspaces.
* سكربتات `package.json`.
* طريقة تشغيل API.
* طريقة تشغيل Web.
* طريقة تشغيل Desktop.

## 2. حالة البناء

نفّذ أو حلّل:

```bash
npm install
npm run build
```

وسجّل:

* هل البناء ينجح؟
* ما الأخطاء؟
* هل توجد imports مكسورة؟
* هل توجد TypeScript errors؟
* هل توجد حزم مفقودة مثل `@dms/shared` أو `@dms/ui`؟

## 3. قاعدة البيانات

افحص:

```txt
apps/api/src/database.ts
apps/api/src/db-resources/schema.sql
apps/api/src/db/migrations
dms.db إن وجد
```

وسجّل:

* هل يوجد نظام migrations؟
* هل يوجد `schema_migrations`؟
* هل يوجد Backup قبل migration؟
* هل يوجد تضارب بين schema sources؟
* هل الجداول التالية موجودة:

  * `payments`
  * `inventory_stock`
  * `audit_logs`
  * `settings_history`
  * `manager_approvals`
  * `fiscal_periods`
  * `sequences`

## 4. نقطة البيع POS

افحص:

```txt
apps/web/src/context/POSContext.tsx
apps/web/src/pages/POSPage.tsx
apps/web/src/pages/pos-components/*
apps/api/src/services/pos.service.ts
apps/api/src/routes/pos.routes.ts
```

وسجّل:

* هل حفظ الطلب يطبع؟
* هل زر الطباعة يطبع فعلياً؟
* هل التصنيفات تظهر؟
* هل الديلفري المعلق موجود؟
* هل يوجد تحصيل ديلفري؟
* هل يوجد دفع حقيقي؟
* هل إغلاق الجلسة محاسبي؟
* هل يوجد تقرير Z حقيقي؟

## 5. الطباعة

افحص:

```txt
apps/api/src/services/printingService.ts
apps/web/src/services/printer.service.ts
apps/desktop/src/main.ts
PrinterTemplatesPage
PrinterRoutesPage
PrinterJobsPage
PrintersPage
```

وسجّل:

* هل POS يستخدم `print_templates`؟
* هل يوجد HTML hardcoded للإيصال؟
* هل يوجد Print Jobs؟
* هل يوجد Printer Routes؟
* هل فشل الطباعة يظهر للمستخدم؟
* هل إعادة الطباعة تسجل Audit؟

## 6. الصندوق والجلسات

افحص:

* فتح الجلسة.
* إغلاق الجلسة.
* Opening Cash.
* Closing Cash.
* Expected Cash.
* Actual Cash.
* Cash Difference.
* Cash Payments.
* Delivery Collections.
* Refunds.

## 7. المخزون

افحص:

* `InventoryService`.
* `inventory_movements`.
* `inventory_stock`.
* `products.stock_quantity`.
* recipes.
* WAC.
* منع البيع تحت الصفر.

## 8. المحاسبة

افحص:

* journal entries.
* journal lines.
* POS posting.
* return posting.
* delivery posting.
* trial balance.
* ledger.

وسجّل:

* هل القيود متوازنة؟
* هل يوجد منع تعديل قيد مرحّل؟
* هل الديلفري المعلق يدخل الصندوق خطأ؟
* هل المرتجعات تعكس القيود؟

## 9. العربية و UX

افحص:

* نصوص POS.
* نصوص الطباعة.
* نصوص التقارير.
* رسائل الأخطاء.
* RTL.

وسجّل النصوص الركيكة أو غير الواضحة.

## 10. تصنيف المشاكل

قسّم المشاكل إلى:

```txt
P0 = تمنع التشغيل الإنتاجي
P1 = تمنع الاعتماد الرسمي
P2 = تحسينات لاحقة
```

لا تبدأ التنفيذ قبل كتابة هذا التقرير.

---

# المرحلة 1 — إصلاح البناء والحزم

## الهدف

يجب أن يعمل المشروع من جهاز جديد بهذا التسلسل:

```bash
npm install
npm run build
```

## المطلوب

إذا كان المشروع يستورد:

```ts
@dms/shared
@dms/ui
```

فتأكد أن الحزمتين موجودتان وتبنيان.

## packages/shared

يجب أن تحتوي على:

* Common types.
* API response types.
* Auth schemas.
* POS schemas.
* Inventory schemas.
* Accounting schemas.
* Printing schemas.
* Settings schemas.
* Zod schemas إذا كان المشروع يعتمد عليها.

ويجب أن تصدّر كل الرموز المستخدمة فعلياً في API والواجهة.

## packages/ui

يجب أن تحتوي على المكونات المستخدمة فعلياً، مثل:

```txt
Button
Card
Input
Select
Table
Modal
Switch
Tabs
StatusBadge
PageHeader
DateRangePicker
AdminLayout
Sidebar
TopBar
POSLayout
ToastProvider
ThemeProvider
useToast
useTheme
Column
```

## معيار القبول

الأوامر التالية يجب أن تنجح:

```bash
npm run build --workspace=@dms/shared
npm run build --workspace=@dms/ui
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run build
```

---

# المرحلة 2 — توحيد قاعدة البيانات و Migrations

## الهدف

إلغاء التشتت بين `database.ts` و `schema.sql` وأي schema آخر.

## المطلوب

اعتمد migrations كمصدر حقيقة.

أنشئ أو أصلح:

```txt
apps/api/src/db/
  connection.ts
  migrate.ts
  backup.ts
  introspect.ts
  seed.ts
  verify.ts
  migrations/
```

## connection.ts

يجب تفعيل:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

## schema_migrations

أنشئ جدول:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT
);
```

## Backup قبل migration

قبل تشغيل أي migration على قاعدة موجودة، أنشئ نسخة:

```txt
backups/dms-before-migration-YYYYMMDD-HHmmss.db
```

إذا فشل backup، لا تشغّل migration.

## الجداول المطلوبة للإنتاج

تأكد من وجود:

```txt
branches
users
roles
permissions
role_permissions
accounts
journal_entries
journal_lines
categories
units
unit_conversions
products
recipes
inventory_movements
inventory_stock
customers
pos_sessions
orders
order_lines
order_notes
payments
returns
return_lines
printers
printer_routes
print_jobs
print_templates
settings
settings_history
audit_logs
manager_approvals
fiscal_periods
sequences
```

## ممنوع

* لا تحذف بيانات.
* لا تصفر قاعدة البيانات.
* لا تغير نوع IDs بطريقة تكسر العلاقات.
* لا تستخدم DROP TABLE على جداول بها بيانات.

## معيار القبول

* migrations تعمل على قاعدة فارغة.
* migrations تعمل على قاعدة موجودة.
* migrations idempotent.
* `database.ts` لا ينشئ schema مختلفاً عن migrations.
* `schema.sql` لا يناقض migrations.

---

# المرحلة 3 — إصلاح نقطة البيع POS

## الهدف

نقطة البيع يجب أن تكون بسيطة وعملية للكاشير.

## الواجهة المطلوبة

يجب أن تحتوي POS على:

```txt
فتح وردية / حالة الوردية
تصنيفات المنتجات
بحث
شبكة منتجات
سلة
نوع الطلب: صالة / سفري / ديلفري
طريقة الدفع
حفظ الطلب
طباعة
إرسال للمطبخ
كل المبيعات
كل المرتجعات
طلبات الديلفري المعلقة
إغلاق الوردية
```

## تفكيك POS

إذا كان `POSPage.tsx` ضخماً، فككه إلى:

```txt
apps/web/src/features/pos/
  components/
    POSHeader.tsx
    POSToolbar.tsx
    OrderTypeSelector.tsx
    PaymentPanel.tsx
    ProductCategoryTabs.tsx
    ProductGrid.tsx
    ProductCard.tsx
    CartPanel.tsx
    CartItemRow.tsx
    OrderSummary.tsx
    SalesDrawer.tsx
    ReturnsDrawer.tsx
    PendingDeliveryDrawer.tsx
    CollectDeliveryDialog.tsx
    SessionCloseDialog.tsx
    POSStatusBar.tsx
  hooks/
    usePOSSession.ts
    usePOSCart.ts
    usePOSOrders.ts
    usePOSPrinting.ts
    usePendingDeliveryOrders.ts
  services/
    posApi.ts
  types.ts
```

أو استخدم بنية المشروع الحالية، لكن لا تترك كل المنطق في ملف واحد.

---

# المرحلة 4 — فصل الحفظ عن الطباعة

## المشكلة المطلوب حلها

إذا كان `submitOrder()` يستدعي:

```ts
PrinterService.printReceipt(...)
PrinterService.printKOT(...)
```

احذف ذلك من مسار الحفظ.

إذا كان `createOrder()` في backend يستدعي:

```ts
queueOrderPrintJobs(...)
```

اجعل ذلك مشروطاً بخيار واضح:

```ts
printNow === true
```

والافتراضي:

```txt
printNow = false
```

## السلوك المطلوب

```txt
زر حفظ الطلب = يحفظ فقط
زر طباعة = يطبع الإيصال فقط
زر إرسال للمطبخ = يطبع KOT فقط
```

## زر حفظ الطلب

يجب أن:

* يتحقق من وجود جلسة مفتوحة.
* يتحقق من أن السلة غير فارغة.
* يتحقق من توفر المخزون.
* يتحقق من صحة الدفع.
* يحفظ الطلب.
* لا يطبع.
* لا ينشئ Print Jobs.
* لا يمسح السلة إلا بعد نجاح الحفظ.
* يمنع الضغط المكرر Double Submit.
* يحفظ `lastOrder`.

## زر الطباعة

يجب أن:

* لا ينشئ طلباً جديداً.
* لا يغير المخزون.
* لا يغير الدفع.
* لا يغير القيد.
* يطبع آخر طلب محفوظ.
* يستخدم endpoint طباعة واضح.
* يعرض نجاح أو خطأ حقيقي.

---

# المرحلة 5 — إصلاح الطباعة وربطها بالقوالب

## endpoint مطلوب

أضف:

```txt
POST /pos/orders/:orderId/print
```

Payload:

```json
{
  "types": ["RECEIPT"],
  "processNow": false
}
```

أو:

```json
{
  "types": ["RECEIPT", "KOT"],
  "processNow": true
}
```

## السلوك

* تحقق أن الطلب موجود.
* لا تنشئ order جديد.
* لا تعدّل الطلب مالياً.
* لا تعدّل المخزون.
* استخدم `print_templates`.
* استخدم `printer_routes`.
* أنشئ `print_jobs`.
* أعد نتيجة واضحة.

## تصميم الإيصال

مصدر تصميم الإيصال يجب أن يكون:

```txt
print_templates
```

وليس HTML hardcoded داخل POS.

## payload للطباعة

وسّع `buildOrderPrintPayload(orderId)` ليحتوي:

```txt
restaurant_name
branch_name
order_number
created_at
cashier
order_type
payment_status
delivery_status
table_number
delivery_phone
delivery_address
items
receipt_items
kitchen_items
subtotal
discount
tax
total
payment_notice
footer_message
is_reprint
```

## للديلفري المعلق

إذا الطلب ديلفري غير مدفوع، يجب أن يظهر في الإيصال:

```txt
طلب ديلفري — غير مدفوع
يتم التحصيل عند التسليم
```

## إعادة الطباعة

إذا كان الطلب قد طُبع سابقاً، يجب أن يظهر:

```txt
نسخة إعادة طباعة
```

ويتم تسجيل Audit.

## معيار القبول

* تعديل قالب RECEIPT من صفحة القوالب يغير طباعة POS.
* لا توجد رسالة نجاح كاذبة للطباعة.
* فشل الطابعة أو عدم وجود route يظهر بوضوح.
* Print Jobs تسجل الحالة.
* إعادة الطباعة تزيد `reprint_count` وتسجل Audit.

---

# المرحلة 6 — التصنيفات داخل POS

## المطلوب

أضف تصنيفات المنتجات في POS.

يجب أن يتم تحميل التصنيفات من:

```txt
GET /inventory/categories
```

أو endpoint مناسب.

## Backend

عدّل:

```txt
GET /pos/products
```

ليدعم:

```txt
categoryId
search
page
pageSize
```

مثال:

```txt
/pos/products?categoryId=3&search=cola&page=1&pageSize=24
```

## السلوك

* إذا توجد تصنيفات، اعرضها أعلى المنتجات.
* عند اختيار تصنيف، اعرض منتجاته فقط.
* البحث يجب أن يحترم التصنيف المختار.
* لا تعرض كل المنتجات عند اختيار تصنيف محدد.
* إذا لا توجد تصنيفات، اعرض كل المنتجات كـ fallback.
* اجعل التصنيفات مناسبة للمس و RTL.

## معيار القبول

* الضغط على تصنيف يعرض منتجاته فقط.
* البحث داخل التصنيف لا يجلب منتجات تصنيفات أخرى.
* الواجهة لا تعرض كل المنتجات عشوائياً عند وجود تصنيفات.

---

# المرحلة 7 — الدفع والصندوق

## الهدف

الصندوق يجب أن يعتمد على payments والحركات النقدية، لا على إجمالي الطلبات فقط.

## جدول payments

تأكد من وجود أو أضف:

```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL DEFAULT 'PAYMENT',
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  amount REAL NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  exchange_rate REAL NOT NULL DEFAULT 1,
  reference TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## type

```txt
PAYMENT
REFUND
DELIVERY_COLLECTION
CASH_IN
CASH_OUT
```

## method

```txt
CASH
CARD
TRANSFER
```

## payment_status للطلب

```txt
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
VOID
```

## القواعد

* الطلب المدفوع نقداً يدخل الصندوق.
* البطاقة لا تدخل النقد.
* التحويل لا يدخل النقد.
* الديلفري المعلق لا يدخل الصندوق.
* المرتجع النقدي ينقص الصندوق.
* تقرير الجلسة يعتمد على `payments`.

## الدفع المختلط

إذا تم دعم الدفع المختلط:

```txt
Cash: 60,000
Card: 40,000
Total: 100,000
```

يجب أن:

* مجموع المدفوعات يساوي total.
* النقد فقط يدخل الصندوق.
* البطاقة تظهر في تقرير منفصل.

---

# المرحلة 8 — الديلفري المعلق

## المطلوب

دعم دورة العمل:

```txt
طلب ديلفري
→ دفع عند التسليم
→ يحفظ كطلب معلق
→ لا يدخل الصندوق
→ يظهر في قائمة المعلقات
→ عند استلام المال يتم تحصيله
→ يدخل الصندوق
→ يصبح مدفوعاً
```

## fields في orders

تأكد من وجود:

```sql
order_type TEXT DEFAULT 'DINE_IN'
payment_status TEXT DEFAULT 'UNPAID'
delivery_status TEXT DEFAULT NULL
collected_at TEXT DEFAULT NULL
collected_by INTEGER DEFAULT NULL
delivery_person_name TEXT DEFAULT NULL
delivery_phone TEXT DEFAULT NULL
delivery_address TEXT DEFAULT NULL
delivery_notes TEXT DEFAULT NULL
```

## order_type

```txt
DINE_IN
TAKEAWAY
DELIVERY
```

## delivery_status

```txt
PENDING
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
```

## Endpoint للمعلقات

```txt
GET /pos/orders/pending-delivery
```

## Endpoint للتحصيل

```txt
POST /pos/orders/:orderId/collect-delivery
```

Payload:

```json
{
  "amount": 25000,
  "paymentMethod": "CASH",
  "notes": "تم استلام المبلغ"
}
```

## شروط التحصيل

* الطلب موجود.
* الطلب من نوع DELIVERY.
* الطلب غير مدفوع.
* الطلب ليس ملغى.
* توجد جلسة كاشير مفتوحة.
* المبلغ أكبر من صفر.
* المبلغ يساوي المتبقي إذا لا يوجد دفع جزئي.
* لا يمكن التحصيل مرتين.

## عند التحصيل

* أنشئ payment من نوع `DELIVERY_COLLECTION`.
* حدّث `payment_status = PAID`.
* حدّث `delivery_status = DELIVERED`.
* حدّث `collected_at`.
* حدّث `collected_by`.
* أدخل المبلغ في الصندوق.
* سجل Audit.

## معيار القبول

* الديلفري المعلق لا يدخل الصندوق.
* يظهر في قائمة المعلقات.
* يمكن طباعته كغير مدفوع.
* يمكن تحصيله لاحقاً.
* بعد التحصيل يدخل الصندوق.
* لا يمكن تحصيله مرتين.

---

# المرحلة 9 — إغلاق الجلسة وسياسات الصندوق

## المطلوب

إغلاق الجلسة يجب أن يكون محاسبياً.

## احسب

```txt
expected_cash =
opening_cash
+ cash_payments
+ delivery_cash_collections
+ cash_in
- cash_refunds
- cash_out
```

ثم:

```txt
cash_difference = actual_cash - expected_cash
```

## pos_sessions

تأكد من وجود:

```sql
opening_cash REAL NOT NULL DEFAULT 0
expected_cash REAL DEFAULT 0
actual_cash REAL DEFAULT NULL
cash_difference REAL DEFAULT 0
cash_difference_reason TEXT DEFAULT NULL
closed_by INTEGER DEFAULT NULL
closed_at TEXT DEFAULT NULL
close_approved_by INTEGER DEFAULT NULL
close_approval_reason TEXT DEFAULT NULL
status TEXT NOT NULL DEFAULT 'OPEN'
```

## قواعد الإغلاق

* لا يمكن الإغلاق بدون `actual_cash`.
* لا يمكن `actual_cash < 0`.
* إذا الفرق صفر، أغلق.
* إذا الفرق غير صفر، يجب تسجيل السبب.
* إذا الفرق أكبر من حد السماح، يجب موافقة مدير.
* إذا توجد طلبات ديلفري معلقة، اتبع الإعداد:

  * امنع الإغلاق.
  * أو اسمح فقط بموافقة مدير.
  * أو اسمح مع تحذير وتوثيق.

## إعدادات مطلوبة

```txt
cash_difference_tolerance_amount
cash_difference_requires_manager
allow_close_session_with_pending_delivery
pending_delivery_close_requires_manager
require_reason_for_cash_difference
```

## معيار القبول

* لا يمكن إغلاق جلسة بفرق صندوق غير موثق.
* لا يمكن إغلاق جلسة بفرق كبير دون مدير.
* تقرير الجلسة يعرض:

  * opening cash
  * cash sales
  * delivery collections
  * refunds
  * expected cash
  * actual cash
  * difference
  * reason
  * approved by

---

# المرحلة 10 — Manager Approval

## الهدف

أي عملية مالية خطرة تحتاج موافقة مدير.

## جدول manager_approvals

أضف إن لم يكن موجوداً:

```sql
CREATE TABLE IF NOT EXISTS manager_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  requested_by INTEGER NOT NULL,
  approved_by INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## العمليات التي تحتاج مدير

```txt
إغلاق جلسة بفرق كبير
إغلاق جلسة مع ديلفري معلق
خصم كبير
مرتجع كبير
إلغاء طلب مدفوع
إعادة طباعة
تعديل مخزون
فتح فترة مالية مغلقة
```

## طريقة الموافقة

يمكن كبداية استخدام:

```json
{
  "managerUsername": "admin",
  "managerPassword": "****",
  "reason": "فرق صندوق"
}
```

أو PIN إذا موجود.

## تحقق

* المدير موجود.
* كلمة المرور صحيحة.
* المدير لديه صلاحية.
* سجل approval.
* سجل Audit.

---

# المرحلة 11 — المرتجعات

## المطلوب

المرتجع يجب أن يكون مضبوطاً.

## قبل المرتجع تحقق من

* الطلب الأصلي موجود.
* الطلب مكتمل أو مدفوع.
* الطلب ليس ملغى.
* الكمية المرجعة لا تتجاوز الكمية المباعة ناقص المرجع سابقاً.
* السبب موجود.
* إذا المبلغ كبير، يحتاج مدير.
* إذا المرتجع نقدي، توجد جلسة مفتوحة.
* إذا المرتجع نقدي، يسجل كـ `REFUND` في payments.

## عند المرتجع

* أنشئ return.
* أنشئ return_lines.
* أعد المخزون حسب السياسة.
* أنشئ payment/refund.
* أنشئ قيد عكسي.
* سجل Audit.

## معيار القبول

* لا يمكن إرجاع كمية أكثر من المبيع.
* لا يوجد مرتجع بدون سبب.
* المرتجع النقدي يظهر في تقرير الصندوق.
* المخزون يعود بشكل صحيح.
* القيد المحاسبي العكسي متوازن.

---

# المرحلة 12 — إلغاء الطلب Void

## المطلوب

أضف أو أصلح endpoint:

```txt
POST /pos/orders/:orderId/void
```

Payload:

```json
{
  "reason": "طلب بالخطأ",
  "managerApproval": {
    "managerUsername": "admin",
    "managerPassword": "****"
  }
}
```

## قبل الإلغاء تحقق

* الطلب موجود.
* الطلب ليس ملغى مسبقاً.
* السبب موجود.
* إذا الطلب مدفوع، يحتاج مدير.
* إذا الطلب مطبوع للمطبخ، يحتاج مدير.
* إذا الطلب له مرتجعات، لا تسمح إلا بسياسة واضحة.

## عند الإلغاء

* status = VOID.
* عكس الدفع إن وجد.
* عكس المخزون.
* عكس القيد.
* سجل Audit.

## معيار القبول

* لا يمكن إلغاء طلب مدفوع بدون مدير.
* لا يمكن إلغاء طلب مرتين.
* الإلغاء يظهر في التقارير.
* الإلغاء لا يختفي من السجل.

---

# المرحلة 13 — الخصومات

## إعدادات مطلوبة

```txt
max_cashier_discount_percent
max_cashier_discount_amount
manager_required_discount_percent
require_reason_for_discount
```

## القواعد

* الخصم لا يكون سالباً.
* الخصم لا يتجاوز إجمالي الطلب.
* إذا الخصم فوق حد الكاشير، يحتاج مدير.
* إذا السبب مطلوب، يجب إدخاله.
* الخصم يسجل في Audit.

## معيار القبول

* خصم صغير يمر.
* خصم كبير لا يمر بدون مدير.
* الخصومات تظهر في تقرير الجلسة.

---

# المرحلة 14 — المخزون

## المصدر الصحيح

```txt
inventory_movements = دفتر الحركات
inventory_stock = الرصيد الحالي
products.stock_quantity = legacy/display فقط
```

## المطلوب

تأكد من وجود دوال:

```ts
getStockLevel(...)
ensureStockAvailable(...)
stockIn(...)
stockOut(...)
adjustStock(...)
transferStock(...)
returnStock(...)
consumeRecipe(...)
rebuildStockSnapshot(...)
```

## قواعد

* كل تعديل مخزون داخل Transaction.
* لا بيع تحت الصفر إذا `allowNegativeStock=false`.
* Recipe يتحقق من المكونات.
* Recipe يخصم المكونات.
* COGS للـRecipe من تكلفة المكونات.
* المرتجع يعيد المخزون حسب السياسة.
* التحويل بين الفروع ينتج TRANSFER_OUT و TRANSFER_IN.

## معيار القبول

* لا يمكن بيع منتج بلا رصيد إذا السالب ممنوع.
* بيع Recipe يخصم المكونات.
* المرتجع يعيد المخزون.
* يمكن إعادة بناء الرصيد من الحركات.
* COGS منطقي ومبني على WAC أو تكلفة المكونات.

---

# المرحلة 15 — المحاسبة

## القواعد

كل قيد يجب أن يحقق:

```txt
Total Debit = Total Credit
```

## ممنوع

* ترحيل قيد غير متوازن.
* تعديل قيد POSTED.
* حذف قيد POSTED.
* استخدام حذف القيد لتصحيح خطأ.

## التصحيح

يكون عبر:

```txt
Reversal Entry
```

## POS Posting

### بيع نقدي

```txt
Dr Cash Drawer
Cr Sales Revenue
Cr Tax Payable إن وجدت

Dr COGS
Cr Inventory
```

### ديلفري معلق — اختر سياسة واحدة

#### السياسة المبسطة

إذا قررت الاعتراف بالإيراد عند التحصيل فقط:

* لا تدخل Cash عند الحفظ.
* عند التحصيل:

  * Dr Cash
  * Cr Sales
  * Dr COGS
  * Cr Inventory

#### السياسة المحاسبية الأدق

إذا قررت الاعتراف بالإيراد عند خروج الطلب:

```txt
Dr Delivery Receivable
Cr Sales Revenue

Dr COGS
Cr Inventory
```

وعند التحصيل:

```txt
Dr Cash
Cr Delivery Receivable
```

اختر سياسة واحدة وطبّقها ووثّقها. لا تخلط بين السياستين.

## معيار القبول

* Trial Balance يبقى متوازناً.
* كل عملية POS لها أثر محاسبي واضح أو موثق.
* الديلفري المعلق لا يظهر كنقد قبل التحصيل.
* القيود POSTED لا يمكن تعديلها.

---

# المرحلة 16 — التقارير الإنتاجية

## المطلوب

أضف أو أصلح التقارير التالية:

```txt
Z Report
Session Closing Report
Cash Drawer Report
Sales Report
Pending Delivery Report
Delivery Collections Report
Returns Report
Voids Report
Discounts Report
Inventory Movement Report
Print Jobs Report
```

## Z Report يجب أن يعرض

```txt
Opening Cash
Cash Sales
Card Sales
Transfer Sales
Delivery Pending
Delivery Collected
Returns
Voids
Discounts
Expected Cash
Actual Cash
Cash Difference
Cash Difference Reason
Approved By
Cashier
Session Open Time
Session Close Time
```

## معيار القبول

* لا يخلط التقرير بين إجمالي المبيعات والنقد المحصل.
* الديلفري المعلق يظهر منفصل.
* المرتجعات تظهر منفصلة.
* فروقات الصندوق تظهر بوضوح.
* التقرير قابل للطباعة.

---

# المرحلة 17 — Audit Log

## أنشئ أو أصلح خدمة

```txt
apps/api/src/services/audit.service.ts
```

بدالة:

```ts
logAction({
  userId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  reason,
  approvedBy,
  request
})
```

## يجب تسجيل

```txt
login success
login failure
open session
close session
create order
print order
reprint order
void order
return order
collect delivery
apply discount
cash in
cash out
inventory adjustment
journal post
journal reverse
settings update
template update
printer route update
```

## معيار القبول

كل عملية حساسة لها سجل واضح.

---

# المرحلة 18 — الأمان والصلاحيات

## المطلوب

* `JWT_SECRET` إلزامي في production.
* CORS لا يكون `*` في production.
* Rate limit على login.
* لا توجد أسرار افتراضية في production.
* صلاحيات دقيقة.
* Manager approval موجود.

## صلاحيات مقترحة

```txt
POS_SESSION_OPEN
POS_SESSION_CLOSE
POS_ORDER_CREATE
POS_ORDER_PRINT
POS_ORDER_REPRINT
POS_ORDER_VOID
POS_RETURN_CREATE
POS_DISCOUNT_APPLY
POS_DELIVERY_COLLECT
INVENTORY_ADJUST
REPORT_VIEW
SETTINGS_UPDATE
ACCOUNTING_POST
```

## معيار القبول

* الكاشير لا يستطيع تنفيذ عمليات مدير.
* المدير يستطيع الموافقة.
* Audit يسجل الموافقات.
* أي عملية حساسة تتحقق من الصلاحية.

---

# المرحلة 19 — العربية و RTL

راجع كل النصوص العربية في:

```txt
POS
الجلسات
الطباعة
الديلفري
المرتجعات
الإلغاء
الصندوق
التقارير
الإعدادات
المخزون
المحاسبة
```

## المطلوب

استخدم لغة موظف مطعم، وليس لغة مبرمج.

أمثلة معتمدة:

```txt
Actual Cash = المبلغ الفعلي في الصندوق
Expected Cash = المبلغ المتوقع في الصندوق
Cash Difference = فرق الصندوق
Pending Delivery = طلبات ديلفري معلقة
Collect Delivery = تحصيل طلب ديلفري
Void Order = إلغاء الطلب
Return Order = تنفيذ مرتجع
Reprint = إعادة طباعة
```

## معيار القبول

* لا توجد عبارات مختلطة مثل "printing افتراضي".
* الواجهة RTL سليمة.
* الأزرار واضحة للكاشير.
* رسائل الخطأ مفهومة.

---

# المرحلة 20 — Backup و Restore

## المطلوب

أضف أو أصلح:

```txt
Backup Now
Daily Auto Backup
Last Backup Status
Backup Folder
Restore Backup
```

## قواعد

* لا Restore بدون تأكيد قوي.
* لا Restore أثناء وجود جلسة مفتوحة.
* لا Restore بدون Backup حالي.
* كل backup يسجل في log.

## مكان مقترح

```txt
C:\DMS\backups
```

أو حسب إعداد `DMS_BACKUP_PATH`.

## معيار القبول

* يوجد Backup يدوي.
* يوجد Backup تلقائي.
* يظهر آخر Backup.
* يوجد دليل Restore.

---

# المرحلة 21 — التشغيل على كمبيوتر المطعم

## لا تستخدم npm run dev للإنتاج

جهّز تشغيل إنتاجي:

```txt
C:\DMS\
  api\
  web\
  desktop\
  data\dms.db
  backups\
  logs\
  config\
```

## API

* يعمل كـ Windows Service أو PM2.
* يقرأ env من ملف واضح.
* DB path ثابت:

```txt
DMS_DB_PATH=C:\DMS\data\dms.db
```

## Web

* production build.
* يخدم من API أو Electron.

## Desktop

* Electron installer.
* API URL configurable.
* شاشة إعداد إذا API غير متصل.
* لا يفتح DevTools في production.

## Docs

أنشئ:

```txt
docs/DEPLOYMENT_RESTAURANT_PC.md
```

يشرح:

* تثبيت النظام.
* إعداد قاعدة البيانات.
* إعداد الطابعات.
* تشغيل API.
* تشغيل POS.
* النسخ الاحتياطي.
* استعادة النسخة.
* نقل النظام لجهاز آخر.

---

# المرحلة 22 — Setup أولي

أنشئ Wizard أو وثيقة إعداد أولي:

```txt
docs/INITIAL_SETUP_GUIDE.md
```

يجب أن يغطي:

```txt
اسم المطعم
العملة
الفرع
المستخدم المدير
الكاشيرين
الصلاحيات
التصنيفات
المنتجات
الأسعار
الرصيد الافتتاحي
الطابعات
قوالب الإيصال
قوالب المطبخ
طرق الدفع
إعدادات الصندوق
```

إذا أمكن، أضف شاشة داخل البرنامج لاحقاً.

---

# المرحلة 23 — الاختبارات

## API Tests مطلوبة

أضف أو أصلح اختبارات لـ:

```txt
فتح جلسة
منع فتح جلستين
حفظ طلب بدون طباعة
طباعة طلب محفوظ
تصنيفات POS
دفع نقدي
دفع بطاقة
ديلفري معلق
تحصيل ديلفري
منع تحصيل مرتين
إغلاق جلسة بدون فرق
إغلاق جلسة بفرق صغير
منع إغلاق جلسة بفرق كبير بدون مدير
مرتجع
منع مرتجع أكبر من المبيع
Void
خصم بصلاحية
منع بيع تحت الصفر
Recipe consumption
قيد متوازن
منع قيد غير متوازن
إعادة طباعة
Audit Log
```

## Manual Tests

إذا لا توجد اختبارات واجهة، أنشئ:

```txt
docs/FULL_PRODUCTION_MANUAL_TEST.md
```

ويجب أن يحتوي سيناريوهات:

### سيناريو 1: بيع عادي

```txt
افتح وردية
اختر تصنيف
أضف منتج
احفظ الطلب
تأكد أنه لا يطبع
اضغط طباعة
تأكد من الإيصال
```

### سيناريو 2: ديلفري معلق

```txt
اختر ديلفري
اختر دفع عند التسليم
احفظ الطلب
تأكد أنه لا يدخل الصندوق
افتح المعلقات
اطبع الطلب
حصّل الطلب
تأكد أنه دخل الصندوق
```

### سيناريو 3: إغلاق وردية

```txt
أدخل actual cash صحيح
أغلق الجلسة
افتح تقرير Z
تأكد من الأرقام
```

### سيناريو 4: فرق صندوق

```txt
أدخل actual cash أقل من expected
تأكد أن النظام يطلب سبب
إذا الفرق كبير، يطلب مدير
```

### سيناريو 5: مرتجع

```txt
نفّذ مرتجع
تأكد من الصندوق
تأكد من المخزون
تأكد من التقرير
```

---

# المرحلة 24 — التوثيق النهائي

أنشئ أو حدّث:

```txt
docs/FULL_PRODUCTION_GAP_AUDIT.md
docs/FULL_PRODUCTION_FIX_REPORT.md
docs/FULL_PRODUCTION_MANUAL_TEST.md
docs/DEPLOYMENT_RESTAURANT_PC.md
docs/INITIAL_SETUP_GUIDE.md
docs/BACKUP_RESTORE.md
docs/POS_WORKFLOW.md
docs/PRINTING_WORKFLOW.md
docs/DELIVERY_PENDING_WORKFLOW.md
docs/SESSION_CLOSE_POLICY.md
docs/ACCOUNTING_CONTROL_POLICIES.md
docs/INVENTORY_WORKFLOW.md
docs/ACCOUNTING_POSTING_RULES.md
docs/AUDIT_LOG_POLICY.md
docs/RISK_REGISTER.md
```

## تقرير الإصلاح يجب أن يحتوي

1. ماذا كان مكسوراً.
2. ماذا تم إصلاحه.
3. الملفات المعدلة.
4. migrations الجديدة.
5. endpoints الجديدة.
6. تغييرات POS.
7. تغييرات الطباعة.
8. تغييرات الدفع.
9. تغييرات الديلفري.
10. تغييرات الجلسات.
11. تغييرات المخزون.
12. تغييرات المحاسبة.
13. نتائج build.
14. نتائج tests.
15. المشاكل المؤجلة.
16. مخاطر التشغيل المتبقية.

---

# المرحلة 25 — أوامر التحقق النهائية

نفّذ:

```bash
npm install
npm run build --workspace=@dms/shared
npm run build --workspace=@dms/ui
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run build
```

ثم:

```bash
npm run test --workspace=@dms/api
```

وإذا توجد اختبارات Web:

```bash
npm run test --workspace=@dms/web
```

ثم:

```bash
npm run db:verify --workspace=@dms/api
```

إذا أمر غير موجود، أضفه أو وثّق سبب عدم وجوده.

---

# معيار القبول النهائي

لا تعتبر المهمة مكتملة إلا إذا تحقق التالي:

## Build

* `npm install` يعمل.
* `npm run build` من الجذر يعمل.
* لا توجد TypeScript errors.
* لا توجد imports مكسورة.

## Database

* يوجد migrations.
* يوجد backup قبل migration.
* يوجد schema_migrations.
* لا يوجد تضارب بين schema sources.
* لا يتم حذف بيانات قديمة.

## POS

* حفظ الطلب لا يطبع.
* الطباعة لا تنشئ طلباً.
* التصنيفات تظهر.
* المنتجات تظهر حسب التصنيف.
* المبيعات والمرتجعات والمعلقات تعمل.
* لا توجد أزرار وهمية.

## Printing

* POS يستخدم print_templates.
* تعديل قالب الإيصال يظهر في POS.
* توجد print_jobs.
* توجد printer_routes.
* فشل الطباعة يظهر للمستخدم.
* إعادة الطباعة مسجلة.

## Payments & Cash

* يوجد payments table.
* الدفع النقدي يدخل الصندوق.
* البطاقة لا تدخل النقد.
* الديلفري المعلق لا يدخل الصندوق.
* المرتجع النقدي ينقص الصندوق.
* تقرير الجلسة يعتمد على payments.

## Delivery

* يمكن إنشاء ديلفري معلق.
* يظهر في المعلقات.
* لا يدخل الصندوق.
* يمكن تحصيله.
* لا يمكن تحصيله مرتين.
* بعد التحصيل يدخل الصندوق.

## Sessions

* لا يمكن فتح جلستين لنفس الكاشير.
* لا يمكن إغلاق جلسة بدون actual cash.
* expected cash يحسب صح.
* cash_difference يحفظ.
* الفرق الكبير يحتاج مدير.

## Inventory

* inventory_stock مصدر الرصيد.
* inventory_movements دفتر الحركات.
* لا بيع تحت الصفر إذا ممنوع.
* Recipe يخصم المكونات.
* المرتجع يعيد المخزون.

## Accounting

* القيود متوازنة.
* لا يمكن ترحيل قيد غير متوازن.
* لا يمكن تعديل قيد POSTED.
* POS posting منطقي.
* الديلفري لا يدخل Cash قبل التحصيل.

## Security

* لا secrets افتراضية في production.
* CORS مضبوط.
* صلاحيات دقيقة.
* Manager approval موجود.
* Audit log موجود.

## Arabic UX

* النصوص عربية واضحة.
* POS مناسب للكاشير.
* RTL سليم.
* لا توجد عبارات مختلطة أو تقنية مربكة.

## Deployment

* يوجد دليل تشغيل على كمبيوتر المطعم.
* يوجد DB path ثابت.
* يوجد backup.
* يوجد logs.
* لا يعتمد الإنتاج على npm run dev.

## Documentation

* كل الوثائق المطلوبة موجودة ومحدثة.

---

# ترتيب التنفيذ الإجباري

نفّذ بهذا الترتيب:

```txt
1. Audit
2. Build/packages
3. Database/migrations
4. POS save/print/categories
5. Printing templates/jobs/routes
6. Payments/cash
7. Delivery pending
8. Session close policies
9. Returns and voids
10. Inventory
11. Accounting
12. Reports
13. Security and permissions
14. Arabic UX
15. Backup/deployment
16. Tests
17. Docs
```

---

# ملاحظة نهائية

تعامل مع البرنامج كنظام مطعم حقيقي.

الكاشير يحتاج:

```txt
أفتح وردية
أختار تصنيف
أبيع
أحفظ
أطبع
أتابع الديلفري
أحصّل
أغلق الوردية
```

المدير يحتاج:

```txt
كم بعت؟
كم دخل كاش؟
كم بقي ديلفري معلق؟
كم رجّعنا؟
هل الصندوق مطابق؟
من وافق على الفرق؟
```

المحاسب يحتاج:

```txt
قيود متوازنة
مخزون صحيح
دفعات واضحة
تقارير قابلة للمراجعة
Audit واضح
```

أي شيء لا يخدم هذه الرحلة لا تضفه الآن.

الهدف ليس تضخيم النظام، بل جعله موثوقاً. النظام الإنتاجي ليس الذي يحتوي ميزات أكثر، بل الذي لا يكذب في الصندوق ولا يخرب المخزون ولا يطبع الفاتورة مرتين.

```
```
