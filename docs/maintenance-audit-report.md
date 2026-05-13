# تقرير الصيانة العميقة - DMS SOULUTION

تاريخ الفحص: 2026-05-13  
النطاق المقروء: `apps/api`, `apps/web`, `apps/desktop`, `packages/shared`, `packages/ui`.

## ملخص تنفيذي

المشروع Monorepo TypeScript/Node يعمل عبر npm workspaces، والـ API مبني على Fastify و `better-sqlite3`. البنية تحتوي طبقات خدمات ومخزون ومحاسبة واضحة جزئيًا، لكنها تحتاج فصل routes من `apps/api/src/index.ts`، وتشديد قيود قاعدة البيانات، وإصلاحات محاسبية ومخزنية تمنع الترحيل المكرر، التعديل على مستندات مرحلة، واستخدام FIFO بصورة صامتة كـ WAC.

أول تشغيل للاختبارات فشل قبل الوصول لمنطق التطبيق بسبب عدم توافق binary `better-sqlite3` مع نسخة Node الحالية:

`NODE_MODULE_VERSION 143` مقابل المطلوب `NODE_MODULE_VERSION 137`.

## المشاكل الحرجة

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| `index.ts` يحتوي routes محاسبة ومخزون وتقارير وإعدادات مستخدم مباشرة | `apps/api/src/index.ts` | نقل routes إلى ملفات مستقلة مع حقن الخدمات والـ db من Fastify | كل endpoint الحالي يبقى بنفس المسار والاستجابة، و`index.ts` يصبح bootstrap فقط |
| عدم وجود قيود DB كافية لمنع duplicate posting | `accountingService.ts`, migrations | إضافة unique partial index على `journal_entries(source_type, source_id)` للقيود المرحلة غير العكسية | محاولة ترحيل مستند بنفس المصدر مرتين تفشل برسالة واضحة |
| فشل التحقق بسبب binary dependency غير متوافق | `node_modules/better-sqlite3` | تشغيل `npm rebuild better-sqlite3` قبل التحقق النهائي | `npm run test --workspace=@dms/api` يدخل الاختبارات بدل فشل ABI |

## المشاكل المحاسبية

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| السماح بإنشاء draft غير متوازن بلا سبب مسجل | `accountingService.ts`, migrations | إضافة `unbalanced_reason` وفرضه عند `allowUnbalanced` | draft غير متوازن بلا سبب يفشل، ومع السبب يبقى غير posted |
| `postEntry` لا يميز بين Entry مفقود وEntry مرحلة سابقًا | `accountingService.ts` | فحص حالة القيد قبل التحديث | posting لقيد posted يرجع خطأ double posting واضح |
| حذف الحساب يمنع فقط وجود journal lines | `accountingService.ts` | منع الحذف إذا له رصيد، أبناء، party link، أو روابط عملاء/موردين | حساب مرتبط أو له حركة/رصيد لا يحذف |
| Trial Balance يعرض net فقط | `accountingService.ts`, shared/web types | إضافة `debit_balance`, `credit_balance`, `normal_side`, `signed_balance` | التقرير يوضح مجموع المدين/الدائن وأرصدة حسب طبيعة الحساب |
| Ledger لا يدعم party account صراحة | `accountingService.ts`, routes | إضافة فلتر `partyType/partyId` مع branchId وopening balance قبل startDate | Ledger لحساب عميل/مورد يرجع opening دقيق وحركات الفترة |

## مشاكل العملاء والموردين

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| أسماء الحسابات العربية مخزنة كمحتوى mojibake في الخدمات والمigrations | `invoiceService.ts`, migrations 0023/0025 | تصحيح النصوص إلى UTF-8 عربي واضح في الكود الجديد | حسابات العملاء/الموردين الجديدة تظهر بأسماء عربية سليمة |
| `opening_balance` يخزن رقمًا فقط | `invoiceService.ts` | منع opening balance غير صفر إلا عبر قيد افتتاحي واضح | إنشاء عميل/مورد برصيد افتتاحي بلا سياسة يفشل برسالة واضحة |
| ضعف منع التكرار | `invoiceService.ts`, migrations | إضافة فحص tax/phone/name حسب المتاح وفهارس unique جزئية حيث ممكن | لا يمكن تكرار عميل/مورد بنفس tax number أو phone |
| لا توجد statement للعميل/المورد | `invoiceService.ts`, routes | إضافة statement من ledger المرتبط | statement يعرض opening, invoices, payments, returns, closing |

## مشاكل المخزون

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| FIFO مضبوط في settings لكنه يستخدم WAC فعليًا | `inventoryService.ts`, shared settings | تعطيل FIFO مؤقتًا برسالة صريحة أو تنفيذه بطبقات | إذا valuationMethod=FIFO لا يتم استخدام WAC بصمت |
| الحركات لا تخزن `source_type` ولا بيانات الوحدة المدخلة | migrations, repository, service | إضافة أعمدة `source_type`, `entered_unit_id`, `entered_quantity`, `base_quantity` | كل حركة جديدة تحتوي مصدرًا ووحدة وكمية أساس |
| لا يوجد تقرير valuation حسب التاريخ والفرع | `inventoryService.ts`, reports routes | إضافة endpoint وتقرير يعتمد على movements حتى تاريخ محدد | valuation يرجع quantity/value لكل منتج وفرع |

## مشاكل POS

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| العلاقة بين POS Order وSales Invoice غير معرفة في schema | POS/Invoice migrations/services | إضافة `source_document_type/source_document_id` أو ربط فاتورة مرجعية غير مرحلة | لا يمكن double posting بين POS والفواتير |
| Z Report غير مكتمل في الخدمة والطباعة | `POSService`, `ReportingService` | توحيد حساب opening/cash/card/transfer/credit/returns/cash in/out/expected/actual/difference | تقرير الجلسة يعرض كل الحقول المطلوبة بدقة |

## مشاكل الأمان

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| حماية أسرار production وCORS موجودة جزئيًا وتحتاج مركزية bootstrap | `config/security.ts`, `index.ts` | استدعاء validation قبل server start وتوثيق env | production يفشل عند الأسرار الافتراضية أو CORS مفتوح |
| admin الافتراضي لا يجبر تغيير كلمة المرور | seed/auth/user schema | إضافة `must_change_password` ورفض login طبيعي حتى تغييرها أو إرجاع flag | أول دخول admin افتراضي يعيد `mustChangePassword=true` ولا يمر كجلسة إنتاجية عادية |
| rate limit الحالي in-memory window بلا lockout مستخدم | `routes/auth.ts`, migrations | إضافة أعمدة login attempts/locked_until أو جدول auth events | بعد محاولات فاشلة يتم lockout مؤقت وترجع 429 |

## مشاكل قابلية الصيانة

| المشكلة | الملفات المتأثرة | الخطة | Acceptance Criteria |
|---|---|---|---|
| routes كبيرة في bootstrap | `index.ts` | فصل accounting/inventory/reports/branches/userSettings | `index.ts` لا يحتوي business route handlers كبيرة |
| `any` مستخدم بكثرة في routes/services | أغلب routes | تقليل تدريجي عبر zod schemas وtypes مشتركة | لا يضاف `any` جديد إلا عند boundary واضح |
| audit logging يفشل بصمت مع `console.error` | `audit.ts` | إتاحة strict audit للعمليات الحساسة أو إرجاع failure محسوب | العمليات الحساسة لا تفقد audit بدون معرفة |

## خطة الإصلاح المرحلية

1. فصل routes من `index.ts` مع الحفاظ على endpoints.
2. تشديد production security وadmin default password flow.
3. إضافة migration للقيود المحاسبية والأمنية والمخزنية اللازمة.
4. إصلاح AccountingService والتقارير.
5. إصلاح InvoiceService للعملاء/الموردين وفواتير الشراء/المبيعات.
6. إصلاح POS double posting وZ Report.
7. إصلاح InventoryService والوحدات وvaluation.
8. إضافة الاختبارات المطلوبة وتشغيل typecheck/build/test.

## ملاحظات بيئية

- قاعدة البيانات الحالية SQLite وليست PostgreSQL؛ الإصلاح سيحافظ على الستاك الحالي لأن أوامر المشروع واختباراته مبنية عليه.
- يوجد محتوى عربي ظاهر كم mojibake في بعض ملفات الخدمات، ويجب تصحيحه تدريجيًا مع أي تعديل في نفس النطاق.
