# DMS SOULUTION - Full Production Gap Audit

تاريخ التدقيق: 2026-05-09

هذا التقرير ينفذ المرحلة 0 من `docs/prombt.md` قبل أي تعديل برمجي جوهري. الهدف هو تحديد الفجوات التي تمنع تحويل النظام إلى نسخة Production Candidate قابلة للتجربة داخل مطعم حقيقي.

## 1. بنية المشروع

المستودع الحالي Monorepo يعتمد Node/TypeScript وليس Python. التطبيقات والحزم الموجودة:

- `apps/api`: Fastify API مع `better-sqlite3`.
- `apps/web`: React/Vite web POS/admin.
- `apps/desktop`: Electron shell.
- `packages/shared`: أنواع وZod schemas مشتركة.
- `packages/ui`: مكونات واجهة مشتركة.

Workspaces معرفة في `package.json`:

- `apps/*`
- `packages/*`

سكريبتات الجذر المهمة:

- `npm run dev`: يشغل API وWeb وDesktop بالتوازي.
- `npm run build`: يبني `@dms/shared` ثم `@dms/ui` ثم `@dms/api` ثم `@dms/web` ثم `@dms/desktop`.
- `npm run typecheck`: typecheck لكل workspaces عند توفره.
- `npm run lint`: lint لكل workspaces عند توفره.

تشغيل التطبيقات:

- API development: `npm run dev --workspace=@dms/api`.
- API production-ish: `npm run build --workspace=@dms/api` ثم `npm run start --workspace=@dms/api`.
- Web development: `npm run dev --workspace=@dms/web`.
- Web production build: `npm run build --workspace=@dms/web`.
- Desktop development: `npm run dev --workspace=@dms/desktop`.
- Desktop build: `npm run build --workspace=@dms/desktop`.
- Desktop installer/packaging موجود عبر `dist` و`pack` في `apps/desktop/package.json`.

الحزم المحلية المطلوبة موجودة:

- `@dms/shared`: موجودة وتبني بنجاح.
- `@dms/ui`: موجودة وتبني بنجاح.

ملاحظات بنيوية:

- `apps/api/dist`, `apps/web/dist`, `packages/*/dist` موجودة، ويجب عدم تعديلها يدوياً.
- لا يوجد مجلد `.git` داخل `D:\dms-soulution`، لذلك لا يمكن الاعتماد على `git status` أو history من هذا المجلد.

## 2. حالة البناء

الأوامر المنفذة:

- `npm install`: نجح.
- `npm run build --workspace=@dms/shared`: نجح.
- `npm run build --workspace=@dms/ui`: نجح.
- `npm run build --workspace=@dms/api`: فشل.
- `npm run build --workspace=@dms/web`: فشل.
- `npm run build --workspace=@dms/desktop`: نجح.
- `npm run build`: فشل عند `@dms/api`.

نتائج `npm install`:

- التثبيت نجح.
- npm سجل 24 vulnerability: 9 moderate و15 high. لم يتم تشغيل `npm audit fix --force` لأن ذلك قد يغير التبعيات بشكل كاسر.

أخطاء API P0:

- `apps/api/src/services/invoiceService.ts:185`: القيمة `PURCHASE_INVOICE` غير مدعومة في نوع `source_type` المحاسبي.
- `apps/api/src/services/invoiceService.ts:345`: القيمة `SALES_INVOICE` غير مدعومة في نوع `source_type` المحاسبي.

أخطاء Web P0:

- `PurchaseInvoiceFormPage.tsx` و`SalesInvoiceFormPage.tsx` يستخدمان `user.branchId` بدل `user.branch_id`.
- طلبات `api(...)` في صفحات الفواتير تمرر object مباشر في `body` بدل `JSON.stringify(...)`.
- أعمدة الجداول في صفحات الفواتير تستخدم callback بوسيطين بينما نوع `Column` الحالي يتوقع وسيطاً واحداً.
- يوجد implicit `any` في callbacks الخاصة بالفواتير.
- صفحات الفواتير تستخدم `Product.cost_price` و`Product.sale_price` بينما النوع الحالي يبدو أنه يستخدم حقولاً مختلفة مثل `cost` و`price`.
- `CardHeader` و`CardTitle` مستخدمان في صفحات الفواتير بدون import.
- `PurchaseInvoicesPage.tsx` و`SalesInvoicesPage.tsx` فيهما متغير `error` غير مستخدم.
- `UserManagementPage.tsx` يستورد `CardTitle` دون استخدامه.

الخلاصة: البناء غير صالح للإنتاج حالياً. المرحلة 1 يجب أن تبدأ بإصلاح هذه الأخطاء دون تغيير سلوك POS أو قاعدة البيانات.

## 3. قاعدة البيانات

الملفات المفحوصة:

- `apps/api/src/database.ts`
- `apps/api/src/db/connection.ts`
- `apps/api/src/db/migrate.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/verify.ts`
- `apps/api/src/db-resources/schema.sql`
- `apps/api/src/db/migrations/*`
- `dms.db`

الوضع الحالي:

- يوجد نظام migrations في `apps/api/src/db/migrations`.
- يوجد `schema_migrations` في قاعدة `dms.db`.
- توجد آلية backup قبل migration في `apps/api/src/db/backup.ts` وتستخدم داخل `migrate.ts` عند وجود pending migrations.
- `connection.ts` يفعّل PRAGMA المطلوبة: `foreign_keys`, `journal_mode = WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`.
- `database.ts` يعتمد migrations ثم seed عند التشغيل.

Migrations الموجودة والمطبقة في `dms.db`:

- `0001 baseline`
- `0002 core_indexes`
- `0003 add_missing_operational_tables`
- `0004 add_audit_and_settings_history`
- `0005 add_delivery_support`
- `0006 add_category_color`
- `0007 add_discounts`
- `0008 add_station_id_to_sessions`
- `0009 accounting_control_policies`
- `0010 payment_status`
- `0011 add_invoices`

الجداول الإنتاجية المطلوبة موجودة في `dms.db`:

- `payments`: موجود.
- `inventory_stock`: موجود.
- `audit_logs`: موجود.
- `settings_history`: موجود.
- `manager_approvals`: موجود.
- `fiscal_periods`: موجود.
- `sequences`: موجود.
- `returns`: موجود.
- `return_lines`: موجود.
- `print_jobs`: موجود.
- `printer_routes`: موجود.
- `print_templates`: موجود.

فجوة P0 في التحقق:

- `npm run db:verify --workspace=@dms/api` يفشل لأن `verify.ts` يتوقع migrations `0001` إلى `0004` فقط، بينما الواقع الصحيح يطبق `0001` إلى `0011`.

مخاطر P1:

- يجب التأكد لاحقاً أن `apps/api/src/db-resources/schema.sql` لا يناقض migrations، لأن migrations يجب أن تكون مصدر الحقيقة الوحيد.
- `verify.ts` لا يتحقق حالياً من كل الجداول الجديدة مثل `manager_approvals`, `returns`, `return_lines`, `print_jobs`, `printer_routes`, `print_templates`, وجداول الفواتير.

## 4. نقطة البيع POS

الملفات المفحوصة:

- `apps/web/src/context/POSContext.tsx`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/pos-components/*`
- `apps/api/src/services/pos.service.ts`
- `apps/api/src/routes/pos.routes.ts`

ما هو موجود:

- فتح وردية: موجود عبر `POST /pos/sessions/open`.
- إغلاق وردية: موجود عبر `POST /pos/sessions/close`.
- المنتجات: موجودة عبر `GET /pos/products` وتدعم `search`, `page`, `pageSize`, `categoryId`.
- التصنيفات في POS: موجودة في الواجهة عبر `ProductCategoryTabs`.
- حفظ الطلب: موجود عبر `POST /pos/orders`.
- آخر طلب محفوظ `lastOrder`: موجود في `POSContext`.
- زر طباعة مستقل في `POSToolbar`: موجود ويستدعي `POST /pos/orders/:orderId/print`.
- طلبات ديلفري معلقة: موجودة عبر `GET /pos/orders/pending-delivery`.
- تحصيل الديلفري: موجود عبر `POST /pos/orders/:orderId/collect-delivery`.
- المرتجعات: endpoint وdrawer موجودان.
- الإلغاء Void: endpoint موجود.
- إعادة الطباعة: endpoint موجود.

فجوات P0/P1:

- `POSContext.submitOrder()` يرسل حالياً `printNow: true` و`printTypes: ['RECEIPT', 'KOT']`. هذا يخالف شرط "حفظ الطلب لا يطبع".
- في `pos.service.ts`, `submitOrder()` يمرر البيانات إلى `createOrder()`, و`createOrder()` ينشئ print jobs إذا `printNow` true. إذن الحفظ قد يطبع فعلياً.
- تعليق في الواجهة يقول إن الطباعة أزيلت من مسار الحفظ، لكن السلوك الفعلي لا يزال يرسل `printNow: true`.
- زر الطباعة المستقل موجود، لكنه يعتمد على `lastOrder` فقط؛ يجب لاحقاً دعم طباعة أي طلب محفوظ من قائمة المبيعات دون إنشاء طلب جديد.
- إغلاق الجلسة في `POSPage` يمنع أي فرق صندوق من الواجهة برسالة خطأ، بينما السياسة الإنتاجية تحتاج سبباً وموافقة مدير إذا كان الفرق كبيراً.
- يجب اختبار double-submit في حفظ الطلب؛ توجد `isSubmitting` في الصفحة، لكن يجب التأكد أنها تغطي كل أزرار الحفظ.

## 5. الطباعة

الملفات المفحوصة:

- `apps/api/src/services/printingService.ts`
- `apps/web/src/services/printer.service.ts`
- `apps/desktop/src/main.ts`
- `PrinterTemplatesPage`
- `PrinterRoutesPage`
- `PrinterJobsPage`
- `PrintersPage`

ما هو موجود:

- `print_templates`: موجودة.
- `printer_routes`: موجودة.
- `print_jobs`: موجودة.
- صفحات إدارة الطابعات والقوالب والمسارات والوظائف موجودة.
- `POST /pos/orders/:orderId/print` موجود.
- `PrintingService.enqueueJob()` يحل route ويستخدم template عند توفره.
- إعادة الطباعة تزيد `reprint_count` وتستخدم مسار audit/policy.

فجوات P1:

- endpoint الطباعة لا يبدو أنه يتعامل مع `processNow` كما يطلب الملف.
- `printOrder()` في POS service يلتقط أخطاء enqueue ويكتب `console.warn`، ما قد ينتج استجابة غير صارمة بدلاً من فشل واضح للمستخدم.
- يجب التأكد أن payload يحتوي كل حقول الإيصال المطلوبة للديلفري والإعادة والفرع والكاشير.
- يجب اختبار أن تعديل template يظهر فعلاً في POS receipt.

## 6. الصندوق والجلسات

ما هو موجود:

- `pos_sessions` يحتوي opening/closing cash وحقول actual/expected/difference حسب الخدمة.
- `PolicyService.calculateExpectedCash()` يعتمد على `payments` النقدية وrefunds.
- `closeSession()` يحسب `expectedCash` و`cashDifference` ويحفظها.
- توجد سياسة موافقة مدير في `PolicyService.validateCloseSession()`.

فجوات P1:

- واجهة POS تمنع الإغلاق عند أي زيادة أو نقص قبل أن تصل إلى سياسة API، لذلك لا يمكن إدخال سبب الفرق أو مسار موافقة مدير من POS الرئيسي.
- يجب توحيد حسابات الجلسة والتقارير على `payments` وليس إجمالي الطلبات فقط.
- يجب اختبار أن البطاقة والتحويل لا يدخلان النقد.

## 7. المخزون

ما هو موجود:

- `inventory_stock` موجود كمصدر رصيد.
- `inventory_movements` موجود كدفتر حركة.
- `InventoryService` يحتوي دوال مهمة مثل `ensureStockAvailable`, `consumeRecipe`, `processSale`, `rebuildStockSnapshot`.
- إعداد `allowNegativeStock` موجود في settings ويستخدم في التحقق.
- recipes موجودة وتستهلك المكونات.
- `products.stock_quantity` ما زال موجوداً كحقل legacy/display.

فجوات P1:

- يجب اختبار منع البيع تحت الصفر من خلال POS end-to-end.
- يجب اختبار أن المرتجع يعيد المخزون حسب السياسة.
- يجب توثيق أن `inventory_stock` هو المصدر الرسمي وأن `products.stock_quantity` للعرض/legacy فقط.

## 8. المحاسبة

ما هو موجود:

- `journal_entries` و`journal_lines` موجودة.
- `AccountingService.createJournalEntry()` يمنع القيد غير المتوازن افتراضياً.
- `postEntry()` يمنع ترحيل قيد غير متوازن.
- `updateJournalEntry()` يمنع تعديل القيد المرحل.
- `reverseEntry()` موجود.
- Trial Balance وLedger موجودان.
- POS ينشئ قيود بيع/مرتجع/تحصيل ديلفري حسب policy.

فجوات P0/P1:

- API build مكسور لأن أنواع `source_type` لا تشمل `PURCHASE_INVOICE` و`SALES_INVOICE` رغم أن `invoiceService` يستخدمهما.
- يجب توحيد قائمة أنواع source_type في shared/API/UI حتى لا تتكرر أخطاء النوع.
- يجب اختبار سياسة الديلفري: لا يدخل Cash قبل التحصيل.

## 9. العربية و UX

ما هو موجود:

- يوجد دعم i18n في `apps/web/src/i18n`.
- توجد خطوط Cairo في build assets.
- POS يحتوي نصوص مترجمة ومفاتيح عربية/إنجليزية.
- RTL يبدو مدعوماً في البنية العامة، لكن يحتاج اختبار بصري.

فجوات P1/P2:

- بعض fallbacks في الواجهة ما زالت إنجليزية مثل `Loading categories...`, `No products found in this category`, و`Opening`.
- يجب توحيد لغة رسائل الصندوق والديلفري والمرتجعات بلغة موظف مطعم.
- يجب اختبار عدم كسر النصوص العربية في القوالب والطباعة.

## 10. تصنيف المشاكل

### P0 - تمنع التشغيل الإنتاجي

- فشل `npm run build --workspace=@dms/api`.
- فشل `npm run build --workspace=@dms/web`.
- فشل `npm run build` من الجذر.
- فشل `npm run db:verify --workspace=@dms/api` بسبب تحقق متقادم.
- حفظ الطلب في POS يرسل `printNow: true`، ما يخالف فصل الحفظ عن الطباعة.

### P1 - تمنع الاعتماد الرسمي

- تقرير الثغرات من `npm install`: 24 vulnerability.
- مسار إغلاق الجلسة في الواجهة لا يدعم سبب فرق الصندوق وموافقة المدير بشكل عملي.
- endpoint الطباعة لا يدعم `processNow` بوضوح.
- فشل الطباعة قد لا يرجع خطأ صارماً للمستخدم في كل الحالات.
- `verify.ts` لا يغطي كل الجداول والمخاطر الحالية.
- تحتاج الدفعات والديلفري والمرتجعات والمخزون والمحاسبة إلى اختبارات end-to-end أوسع.

### P2 - تحسينات لاحقة

- تنظيف النصوص الإنجليزية fallback داخل POS والتقارير.
- توثيق تشغيل المطعم والنسخ الاحتياطي والاستعادة.
- تحسين تقارير Z والصندوق بصياغة عربية أوضح.
- تقليل حجم `packages/ui/dist/ui.css` إذا أثر على الأداء.

## خطة التنفيذ المقترحة بعد التدقيق

المرحلة التالية يجب أن تكون المرحلة 1 فقط:

1. إصلاح أنواع `source_type` في المحاسبة/الفواتير حتى يبني API.
2. إصلاح صفحات فواتير المبيعات والمشتريات حتى يبني Web دون `any` كسول.
3. تحديث `db:verify` ليتوقع كل migrations الحالية والجداول الأساسية الجديدة.
4. تشغيل أوامر البناء والتحقق مرة أخرى.

بعد نجاح المرحلة 1، تبدأ المرحلة 2/3:

1. إصلاح فصل حفظ الطلب عن الطباعة بإزالة `printNow: true` من الحفظ الافتراضي.
2. جعل زر الطباعة هو المسار الوحيد لإنشاء print jobs من POS.
3. إضافة/تحديث اختبارات API لحفظ الطلب بدون طباعة وطباعة الطلب المحفوظ.

