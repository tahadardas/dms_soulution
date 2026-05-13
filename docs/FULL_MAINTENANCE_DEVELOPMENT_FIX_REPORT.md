# DMS SOULUTION - Full Maintenance Development Fix Report

تاريخ بدء الإصلاحات: 2026-05-09

## Phase 1 - Build and Packages

الحالة: مكتملة.

ما كان مكسوراً:

- لا توجد أخطاء بناء حالية.
- توجد ملاحظة غير مانعة: حزمة Web تنتج chunk أكبر من 500KB بعد minification.

ما تم إصلاحه:

- لم يتطلب الأمر تعديل كود في هذه المرحلة لأن كل معايير البناء نجحت.
- تم تشغيل `npm install` بنجاح، ولم تظهر vulnerabilities من npm audit.

نتائج التحقق:

```bash
npm run build --workspace=@dms/shared
npm run build --workspace=@dms/ui
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run build
```

كل الأوامر أعلاه نجحت.

الملفات المعدلة:

- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

Migrations جديدة:

- لا يوجد.

Endpoints جديدة:

- لا يوجد.

ما يبقى:

- معالجة ملاحظات Phase 2 الخاصة بتوحيد مسار قاعدة البيانات وعزل ملفات DB القديمة.

## Phase 2 - Database Cleanup and Migrations

الحالة: مكتملة.

ما كان مكسوراً:

- كانت توجد ملفات قاعدة بيانات قديمة أو غير معتمدة بجانب القاعدة الفعلية:
  - `database.sqlite`
  - `apps/api/dms.db`
  - `apps/api/database.sqlite`
  - `apps/api/src/db/database.db`
- هذه الملفات كانت فارغة بحجم 0 bytes، لكنها قد تسبب ارتباكاً في التشغيل والصيانة.

ما تم إصلاحه:

- تم الإبقاء على القاعدة الفعلية:
  - `dms.db`
  - `dms.db-wal`
  - `dms.db-shm`
- تم نقل الملفات القديمة غير المعتمدة إلى:
  - `legacy-db-backups/20260509-183601/database.sqlite`
  - `legacy-db-backups/20260509-183601/apps__api__dms.db`
  - `legacy-db-backups/20260509-183601/apps__api__database.sqlite`
  - `legacy-db-backups/20260509-183601/apps__api__src__db__database.db`
- لم يتم حذف أي ملف قاعدة بيانات.
- تم تأكيد أن مصدر الحقيقة للـschema هو `apps/api/src/db/migrations`.
- تم تأكيد أن `DMS_DB_PATH` هو مسار قاعدة البيانات المعتمد عند ضبطه، وأن الافتراضي التطويري الحالي يقرأ من `dms.db` في جذر المشروع.

نتائج التحقق:

```bash
npm run db:verify --workspace=@dms/api
```

النتيجة: نجح.

الملفات المعدلة أو المنقولة:

- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`
- `database.sqlite` -> `legacy-db-backups/20260509-183601/database.sqlite`
- `apps/api/dms.db` -> `legacy-db-backups/20260509-183601/apps__api__dms.db`
- `apps/api/database.sqlite` -> `legacy-db-backups/20260509-183601/apps__api__database.sqlite`
- `apps/api/src/db/database.db` -> `legacy-db-backups/20260509-183601/apps__api__src__db__database.db`

Migrations جديدة:

- لا يوجد، لأن هذه المرحلة لم تحتج تغيير schema.

Endpoints جديدة:

- لا يوجد.

ما يبقى:

- Phase 3: إصلاح route prefix للطباعة وتوحيد حالات `print_jobs`.

## Phase 3 - Printing Route Prefix and Job Statuses

الحالة: مكتملة.

ما كان مكسوراً:

- كان `apps/api/src/index.ts` يسجل `printingRoutes` مع prefix `/printing`.
- كان `apps/api/src/routes/printing.routes.ts` يعرّف المسارات داخلياً أيضاً بـ`/printing/...`.
- النتيجة كانت مسارات زائدة مثل `/printing/printing/jobs`.
- كان `index.ts` يحتوي نسخة ثانية مباشرة من مسارات `/printing/...`.
- كانت حالات print jobs مختلطة بين `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
- كانت jobs الخاصة بـUSB قد تعلق في `PROCESSING` عند تشغيل `processQueue`.
- كانت endpoints مثل test print وDesktop Agent تعيد نجاحاً شكلياً أو placeholder.

ما تم إصلاحه:

- تم تحويل `printing.routes.ts` إلى مسارات داخلية بدون prefix:
  - `/printers`
  - `/routes`
  - `/templates`
  - `/jobs`
  - `/jobs/pending-local`
  - `/jobs/:id/lock`
  - `/jobs/:id/complete`
  - `/jobs/:id/fail`
  - `/workstations/register`
  - `/workstations/:deviceKey/heartbeat`
- بقي التسجيل الوحيد في `index.ts` عبر:
  - `fastify.register(printingRoutes, { prefix: '/printing' })`
- تم حذف بلوك routes المكرر للطباعة من `index.ts`.
- تم توحيد حالات print jobs إلى:
  - `PENDING`
  - `LOCKED`
  - `PRINTING`
  - `SUCCESS`
  - `FAILED`
  - `CANCELLED`
- تم تعديل `PrintingService.processQueue()` ليعالج طابعات `NETWORK` فقط، ويترك USB/WINDOWS للـDesktop Agent.
- تم تحويل نجاح الطابعة التجريبي إلى job فعلي عبر `PrintingService.testPrinter()`.
- تم إضافة وظائف فعلية لمسارات Desktop Agent الأساسية:
  - register workstation
  - heartbeat
  - pending local jobs
  - lock job
  - complete job
  - fail job
- تم تحديث صفحة `PrinterJobsPage` لتقرأ الحالات الجديدة وحقول `attempts/error_message`.
- تم تحديث أنواع الطابعات في الواجهة إلى `NETWORK`, `USB`, `WINDOWS`, `PDF`.

Migrations الجديدة:

- `apps/api/src/db/migrations/0015_printing_jobs_and_workstations.ts`

الجداول/الأعمدة المضافة:

- جدول جديد:
  - `workstations`
- أعمدة جديدة/مؤكدة في `printers`:
  - `display_name`
  - `windows_printer_name`
  - `device_id`
  - `paper_width`
  - `last_seen_at`
- أعمدة جديدة/مؤكدة في `print_jobs`:
  - `attempts`
  - `device_id`
  - `locked_by`
  - `locked_at`
  - `processed_at`
  - `error_message`
  - `retry_count`

Backup قبل migration:

- تم إنشاء:
  - `backups/dms-before-migration-20260509-184407.db`

Endpoints الجديدة أو المصححة:

- `GET /printing/printers`
- `POST /printing/printers`
- `PUT /printing/printers/:id`
- `DELETE /printing/printers/:id`
- `POST /printing/printers/:id/test`
- `GET /printing/routes`
- `POST /printing/routes`
- `PUT /printing/routes/:id`
- `DELETE /printing/routes/:id`
- `GET /printing/templates`
- `POST /printing/templates`
- `PUT /printing/templates/:id`
- `DELETE /printing/templates/:id`
- `GET /printing/jobs`
- `GET /printing/jobs/pending-local`
- `GET /printing/jobs/:id`
- `POST /printing/jobs/:id/retry`
- `POST /printing/jobs/:id/lock`
- `POST /printing/jobs/:id/complete`
- `POST /printing/jobs/:id/fail`
- `POST /printing/process-queue`
- `POST /printing/workstations/register`
- `POST /printing/workstations/:deviceKey/heartbeat`

نتائج التحقق:

```bash
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
npm run build
```

كلها نجحت. لا يزال تحذير Web chunk size موجوداً فقط.

الملفات المعدلة:

- `apps/api/src/db/migrations/0015_printing_jobs_and_workstations.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/verify.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/printing.routes.ts`
- `apps/api/src/services/printingService.ts`
- `apps/web/src/pages/PrinterJobsPage.tsx`
- `apps/web/src/pages/PrintersPage.tsx`
- `apps/web/src/types/printing.ts`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/ar/common.json`
- `packages/shared/src/schemas/printing.ts`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

ما يبقى:

- Phase 4/5 التالية: تفعيل Electron Desktop Print Agent polling فعلياً وربطه بـIPC وواجهة إعداد USB/Windows بشكل كامل.

## Phase 4 - USB / Windows Desktop Print Agent

الحالة: مكتملة جزئياً ضمن نطاق Agent الأساسي. شاشة الربط التفصيلية للطابعات المحلية ستأتي في المرحلة التالية الخاصة بواجهة إعداد USB/Windows.

ما كان مكسوراً:

- `apps/desktop` كان يوفر IPC مباشر للطباعة فقط، ولا يقرأ `print_jobs`.
- لم يكن يوجد `device_key` ثابت للجهاز.
- لم يكن يوجد heartbeat.
- لم يكن يوجد polling للمهام المحلية.
- لم يكن يوجد lock قبل الطباعة، ما يعني أن منع الطباعة المكررة غير مضمون.
- `preload.ts` لم يعرّض IPC المطلوب في البرومبت.

ما تم إصلاحه:

- تمت إضافة Desktop Agent في `apps/desktop/src/main.ts`.
- أصبح الجهاز ينشئ أو يقرأ `deviceKey` ثابتاً من `electron-store`.
- تمت إضافة قراءة `API_URL` من:
  - `DMS_API_URL`
  - أو إعداد `apiUrl` المخزن
  - أو `http://localhost:3000` افتراضياً
- تمت إضافة register + heartbeat عبر:
  - `POST /printing/workstations/register`
  - `POST /printing/workstations/:deviceKey/heartbeat`
- تمت إضافة polling للمهام المحلية:
  - `GET /printing/jobs/pending-local?deviceKey=...`
- تمت إضافة lock قبل الطباعة:
  - `POST /printing/jobs/:id/lock`
- تمت إضافة complete/fail بعد نتيجة Windows printing:
  - `POST /printing/jobs/:id/complete`
  - `POST /printing/jobs/:id/fail`
- تمت إضافة الطباعة الصامتة عبر:
  - `webContents.print({ silent: true, deviceName, printBackground: true })`
- إذا فشلت الطباعة يتم إرسال `fail` وتخزين `error_message`.
- لا يبدأ polling إلا بعد وجود access token من الواجهة، حتى لا يعمل Agent بدون سياق مستخدم.
- تم تشغيل polling تلقائياً من `AuthProvider` عند تسجيل الدخول داخل Desktop.
- تمت إضافة صلاحية Agent لاستخدام `POS_ORDER_PRINT` أو صلاحية إدارة الطباعة.

IPC المضاف:

- `printers:list`
- `printers:printHtml`
- `printers:printText`
- `device:getInfo`
- `device:setKey`
- `printJobs:startPolling`
- `printJobs:stopPolling`

الملفات المعدلة:

- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`
- `apps/web/src/types/window.d.ts`
- `apps/web/src/services/printer.service.ts`
- `apps/web/src/context/AuthContext.tsx`
- `apps/api/src/routes/printing.routes.ts`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run test --workspace=@dms/api
```

كلها نجحت.

ما يبقى:

- إضافة واجهة ربط USB/Windows printer بسجل `printers.device_id`.
- إضافة زر Test Print من صفحة الطابعات يستدعي API test endpoint بدلاً من طباعة محلية مباشرة.
- اختبار ميداني فعلي على جهاز Windows مع طابعة معرفة في النظام.

## Phase 5 - POS Save / Print / KOT / Categories

الحالة: مكتملة ضمن النطاق الحرج لهذه المرحلة.

ما كان مكسوراً أو ناقصاً:

- واجهة POS لم تعرض زر مستقل لإرسال طلب المطبخ KOT.
- زر الطباعة لم يكن يتحقق من صلاحية طباعة مستقلة في الواجهة.
- شاشة المنتجات كانت تبدأ عملياً بدون تثبيت أول تصنيف نشط، ما يسمح بعرض كل المنتجات عند وجود تصنيفات.
- `GET /inventory/categories` كان يتطلب `PRD.View` فقط، بينما الكاشير يحتاج التصنيفات داخل POS بدون صلاحيات إدارة المنتجات.
- endpoint طباعة الطلب كان يقبل أنواع طباعة غير موحدة إذا وصلت من الواجهة.
- قاعدة البيانات الحالية لم تكن مضمونة بوجود `POS.OrderPrint` و `POS.OrderReprint` في أدوار التشغيل.

ما تم إصلاحه:

- بقي `submitOrder()` حفظاً فقط ولا ينشئ print jobs.
- تمت إضافة زر `إرسال للمطبخ` في `POSToolbar`.
- زر `طباعة الإيصال` يستدعي `POST /pos/orders/:orderId/print` مع `types: ['RECEIPT']`.
- زر `إرسال للمطبخ` يستدعي نفس endpoint مع `types: ['KOT']` فقط.
- كلا الزرين يعملان على `lastOrder` ولا ينشئان طلباً جديداً ولا يغيران الدفع أو المخزون أو القيود.
- تمت إضافة فحص `POS_ORDER_PRINT` في الواجهة.
- تمت إضافة تحقق backend لأنواع الطباعة المسموحة: `RECEIPT` و `KOT`.
- إذا فشل job بعد `processNow` يرجع endpoint خطأ `502` برسالة واضحة بدلاً من نجاح كاذب.
- عند تحميل التصنيفات في POS يتم اختيار أول تصنيف نشط تلقائياً.
- إذا توجد تصنيفات لا يتم تحميل كل المنتجات مع `selectedCategoryId = null`.
- تمت إزالة زر `All` من تبويبات تصنيفات POS حتى لا يكون الافتراضي كل المنتجات.
- أصبح endpoint التصنيفات يسمح بـ `PRD.View` أو `POS.Sale`، حتى يستطيع الكاشير تحميل تصنيفات POS.
- أضيفت migration آمنة لإدخال صلاحيات الطباعة وربطها بالأدوار.

Migration الجديدة:

- `apps/api/src/db/migrations/0016_pos_print_permissions.ts`

Backup قبل تطبيق migration على قاعدة التطوير الحالية:

- `backups/dms-before-migration-20260509-185734.db`

الملفات المعدلة:

- `apps/api/src/index.ts`
- `apps/api/src/routes/pos.routes.ts`
- `apps/api/src/db/migrations/0016_pos_print_permissions.ts`
- `apps/web/src/lib/permissions.ts`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/pos-components/POSToolbar.tsx`
- `apps/web/src/pages/pos-components/ProductCategoryTabs.tsx`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/ar/common.json`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
node -e "JSON.parse(... en/ar common.json)"
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. تحذير Vite المتبقي فقط عن حجم chunk أكبر من 500KB.

ما يبقى:

- إعادة تصميم payload الطباعة في `buildOrderPrintPayload` ليشمل كل الحقول المطلوبة في البرومبت.
- حذف/عزل دوال `printReceipt` و `printKOT` القديمة في `printer.service.ts` بعد التأكد من عدم استخدامها في أي مسار POS.
- إضافة اختبارات API مباشرة لمسار `POST /pos/orders/:orderId/print` بأنواعه `RECEIPT` و `KOT`.

## Phase 6 - Order Numbers from Sequences

الحالة: مكتملة.

ما كان مكسوراً:

- رقم الطلب كان يولد من الوقت:
  - `ORD-${Date.now().toString().slice(-6)}`
- هذا الأسلوب غير آمن عند الضغط السريع، وغير واضح في التقارير والطباعة.
- لم يكن يوجد قيد فريد يضمن عدم تكرار `orders.order_number`.

ما تم إصلاحه:

- تمت إضافة مولّد داخل `POSService` يستخدم جدول `sequences`.
- صيغة رقم الطلب أصبحت:
  - `BR1-YYYYMMDD-000001`
- يتم تحديد:
  - `branchId` من جلسة الكاشير.
  - تاريخ اليوم بصيغة `YYYYMMDD`.
  - scope ثابت: `ORDER`.
- يتم إنشاء/تحديث sequence داخل نفس transaction الخاصة بحفظ الطلب.
- إذا وُجد رقم سابق بنفس الصيغة يتم تجاوز التصادم بزيادة sequence مرة أخرى.
- أصبح حفظ الطلب يرفض الجلسة التي لا تملك فرعاً واضحاً، لأن رقم الطلب الإنتاجي يعتمد على الفرع.
- تمت إضافة فهرس فريد:
  - `idx_orders_order_number_unique`

Migrations الجديدة:

- `apps/api/src/db/migrations/0017_unique_order_numbers.ts`

Backup قبل تطبيق migration على قاعدة التطوير الحالية:

- `backups/dms-before-migration-20260509-190054.db`

الملفات المعدلة:

- `apps/api/src/services/pos.service.ts`
- `apps/api/src/db/migrations/0017_unique_order_numbers.ts`
- `apps/api/tests/pos-flow.test.js`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
npm run build --workspace=@dms/api
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. عدد اختبارات API أصبح 30.

ما يبقى:

- عرض الصيغة الجديدة في دليل POS والطباعة النهائي.
- عند تنفيذ مرحلة التقارير النهائية يجب التأكد أن كل التقارير تعرض `order_number` الجديد كما هو.

## Phase 7 - Delivery Collection Validation

الحالة: مكتملة.

ما كان مكسوراً:

- تحصيل الديلفري كان يتحقق من وجود جلسة ومبلغ أكبر من صفر فقط.
- لم يكن يقارن المبلغ المحصل بالمبلغ المتبقي فعلياً.
- لم يكن يرفض المبلغ الناقص أو الزائد برسائل واضحة.
- كان تحديث الطلب عند التحصيل غير مشروط بـ `PENDING_DELIVERY / UNPAID` داخل transaction.

ما تم إصلاحه:

- `validateDeliveryCollection()` أصبح يحسب:
  - `remaining_amount = order.total_amount - completed_payments`
- إذا كان المبلغ أقل من المتبقي يتم الرفض برسالة:
  - `المبلغ المحصل أقل من المبلغ المطلوب.`
- إذا كان المبلغ أكبر من المتبقي يتم الرفض برسالة:
  - `المبلغ المحصل أكبر من المبلغ المطلوب.`
- إذا كان المتبقي صفراً أو الطلب `PAID` يتم الرفض برسالة:
  - `هذا الطلب تم تحصيله مسبقاً.`
- لا يسمح التحصيل إلا لطلب `DELIVERY` بحالة:
  - `status = PENDING_DELIVERY`
  - `payment_status = UNPAID`
- تحديث الطلب داخل transaction أصبح مشروطاً بالحالة نفسها، لمنع تحصيل مزدوج عند الضغط أو التزامن.
- يتم إنشاء payment واحد فقط عند التحصيل الصحيح.

الملفات المعدلة:

- `apps/api/src/services/policy.service.ts`
- `apps/api/src/services/pos.service.ts`
- `apps/api/tests/pos-flow.test.js`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
npm run build --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. عدد اختبارات API أصبح 31.

ما يبقى:

- تطبيق صلاحية مستقلة `POS_DELIVERY_COLLECT` بدلاً من استخدام صلاحية البيع العامة في route.
- إظهار المتبقي في واجهة تحصيل الديلفري بشكل أوضح عند مرحلة UX النهائية.

## Phase 8 - Returns / Void / Sensitive POS Permissions

الحالة: مكتملة ضمن نطاق المرتجعات والإلغاء والصلاحيات الدقيقة لهذه المرحلة.

ما كان مكسوراً:

- `createReturn()` كان يستدعي `validateReturn()` بقيمة:
  - `returnTotal = 0`
- هذا يعني أن سياسة موافقة المدير على المرتجعات الكبيرة لا تعمل فعلياً.
- حساب سطور المرتجع كان داخل transaction بعد السياسة، بدلاً من حسابه قبل السياسة.
- مسارات حساسة كانت تعتمد على صلاحيات عامة:
  - المرتجع: `POS_RETURNS`
  - تحصيل الديلفري: `POS_SALE`
  - إلغاء الطلب: `POS_SALE`

ما تم إصلاحه:

- تمت إضافة `prepareReturnLines()` لحساب المرتجع من سطور الطلب الأصلية قبل السياسة.
- يتم تجميع الكميات المطلوبة حسب `orderLineId` لمنع تجاوز الكمية عبر تكرار نفس السطر في payload.
- يتم حساب:
  - `totalRefund`
  - `totalCogs`
  - الكميات المتاحة بعد المرتجعات السابقة
- يتم استدعاء `validateReturn()` بعد حساب `totalRefund` الحقيقي.
- داخل transaction يعاد تجهيز سطور المرتجع مرة ثانية قبل الإدخال، لتقليل خطر التعارض أو الإرجاع المتزامن.
- أضيف اختبار يثبت أن المرتجع الكبير يطلب مديراً بناءً على قيمة المرتجع الحقيقية لا على صفر.
- تمت إضافة صلاحيات دقيقة:
  - `POS.OrderVoid`
  - `POS.ReturnCreate`
  - `POS.DeliveryCollect`
- تم تطبيق الصلاحيات على routes:
  - `POST /pos/returns` -> `POS.ReturnCreate`
  - `POST /pos/orders/:orderId/void` -> `POS.OrderVoid`
  - `POST /pos/orders/:orderId/collect-delivery` -> `POS.DeliveryCollect`
- واجهة POS أصبحت تفحص صلاحية `POS.ReturnCreate` للمرتجعات.
- واجهة الديلفري المعلق تعطل زر التحصيل إذا لم يملك المستخدم `POS.DeliveryCollect`.

Migration الجديدة:

- `apps/api/src/db/migrations/0018_pos_sensitive_permissions.ts`

Backup قبل تطبيق migration على قاعدة التطوير الحالية:

- `backups/dms-before-migration-20260509-190818.db`

الملفات المعدلة:

- `apps/api/src/config/permissions.ts`
- `apps/api/src/routes/pos.routes.ts`
- `apps/api/src/services/pos.service.ts`
- `apps/api/src/db/migrations/0018_pos_sensitive_permissions.ts`
- `apps/api/tests/pos-flow.test.js`
- `apps/web/src/lib/permissions.ts`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/pos-components/POSToolbar.tsx`
- `apps/web/src/pages/pos-components/PendingDeliveryDrawer.tsx`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. عدد اختبارات API أصبح 32.

ما يبقى:

- تشديد `requireManagerApproval()` بحيث يتحقق من صلاحية الموافقة المطلوبة فعلياً، لا مجرد قبول أي مدير.
- توثيق سياسة void مع الطلبات التي عليها مرتجعات قبل فتحها بشكل أوسع.

## Phase 9 - Cash In / Cash Out and Expected Cash

الحالة: مكتملة لمسار Cash In / Cash Out وحساب `expected_cash` وتقرير Z التشغيلي.

ما كان مكسوراً أو ناقصاً:

- لم يكن يوجد مسار واضح لتسجيل Cash In / Cash Out.
- حساب `expectedCash` لم يكن يحتوي على حركات صندوق يدوية.
- إغلاق الجلسة لم يكن قادراً على احتساب cash in/out ضمن الفرق المتوقع.

ما تم إصلاحه:

- تمت إضافة جدول:
  - `cash_movements`
- تمت إضافة endpoints:
  - `POST /pos/cash-in`
  - `POST /pos/cash-out`
- تمت إضافة صلاحيات:
  - `POS.CashIn`
  - `POS.CashOut`
- تمت إضافة تسجيل Audit عبر:
  - `POS.CASH_IN`
  - `POS.CASH_OUT`
- أصبح `PolicyService.calculateExpectedCash()` يحسب:
  - `opening_cash`
  - `cash payments`
  - `cash refunds`
  - `cash in`
  - `cash out`
- أصبح `POSService.getSessionStats()` يرجع:
  - `cashIn`
  - `cashOut`
  - `expectedCash`
- تم تطوير `GET /reports/sessions-z` ليعتمد على `payments` و `cash_movements` بدلاً من إجمالي الطلبات الخام فقط.
- تقرير Z يعرض الآن:
  - Opening Cash
  - Cash Sales
  - Card Sales
  - Transfer Sales
  - Delivery Pending
  - Delivery Collected
  - Cash Refunds
  - Discounts
  - Cash In
  - Cash Out
  - Expected Cash
  - Actual Cash
  - Cash Difference
  - Cashier
  - Session Open / Close time
- تمت إضافة أزرار Cash In / Cash Out في POS لمن يملك الصلاحية.
- تمت إضافة modal عربي لإدخال المبلغ والسبب.
- تمت إضافة اختبار API يثبت أن Cash In يزيد expected cash وأن Cash Out ينقصه.

Migrations الجديدة:

- `apps/api/src/db/migrations/0019_cash_movements.ts`
- `apps/api/src/db/migrations/0020_pos_cash_movement_permissions.ts`

Backup قبل تطبيق migrations على قاعدة التطوير الحالية:

- `backups/dms-before-migration-20260509-191643.db`

الملفات المعدلة:

- `apps/api/src/config/permissions.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/verify.ts`
- `apps/api/src/db/migrations/0019_cash_movements.ts`
- `apps/api/src/db/migrations/0020_pos_cash_movement_permissions.ts`
- `apps/api/src/routes/pos.routes.ts`
- `apps/api/src/services/policy.service.ts`
- `apps/api/src/services/pos.service.ts`
- `apps/api/src/services/reportingService.ts`
- `apps/api/tests/pos-flow.test.js`
- `apps/web/src/lib/permissions.ts`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/pos-components/POSToolbar.tsx`
- `apps/web/src/pages/ReportsSessionsZPage.tsx`
- `apps/web/src/types/reporting.ts`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/ar/common.json`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
node -e "JSON.parse(... en/ar common.json)"
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. عدد اختبارات API أصبح 33.

ما يبقى:

- إضافة سياسة موافقة مدير إلزامية لمبالغ Cash Out الكبيرة بعد تشديد `requireManagerApproval()`.
- إضافة اختبارات تقرير Z التفصيلية على مستوى API للتأكد من كل عمود مالي على حدة.

## Phase 10 - Recipe Return Policy and Inventory/Accounting Consistency

الحالة: مكتملة.

السياسة المعتمدة:

- مرتجع المنتج الذي له Recipe لا يعيد المكونات إلى المخزون.
- مرتجع المنتج الذي له Recipe لا يعكس COGS.

ما كان مكسوراً:

- `InventoryService.processReturn()` كان لا يعيد مخزون Recipe، وهذا جيد حسب السياسة المختارة.
- لكن `POSService.createReturn()` كان لا يزال ينشئ سطور محاسبية لعكس المخزون وCOGS اعتماداً على `cost_at_time`.
- النتيجة كانت احتمال وجود قيد يقول إن المخزون زاد بينما `inventory_stock` لم يزد.

ما تم إصلاحه:

- تم تعديل تجهيز سطور المرتجع ليكتشف إذا كان المنتج له Recipe.
- إذا كان المنتج له Recipe:
  - `totalCogs` للمرتجع = 0
  - لا يتم إنشاء حركة `RETURN`
  - لا يتم إنشاء سطور `Dr Inventory / Cr COGS`
- إذا كان المنتج بلا Recipe، يبقى السلوك كما هو:
  - إعادة المخزون
  - عكس COGS
- تمت إضافة اختبار يثبت:
  - بيع Recipe يستهلك المكونات.
  - المرتجع لا يعيد المكونات.
  - قيد المرتجع لا يحتوي سطور Inventory/COGS.

وثيقة السياسة:

- `docs/RECIPE_RETURN_POLICY.md`

الملفات المعدلة:

- `apps/api/src/services/pos.service.ts`
- `apps/api/tests/pos-flow.test.js`
- `docs/RECIPE_RETURN_POLICY.md`
- `docs/FULL_MAINTENANCE_DEVELOPMENT_FIX_REPORT.md`

نتائج التحقق:

```bash
npm run build --workspace=@dms/api
npm run test --workspace=@dms/api
```

كلها نجحت. عدد اختبارات API أصبح 34.

ما يبقى:

- مراجعة تقارير المخزون للتأكد من عرض حركات `RECIPE_CONSUMPTION` بوضوح.
- إضافة شرح السياسة إلى دليل POS/Inventory النهائي.

## Final Verification Snapshot - 2026-05-09

تم تشغيل:

```bash
npm install
npm run build --workspace=@dms/shared
npm run build --workspace=@dms/ui
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run build
npm run test --workspace=@dms/api
npm run db:verify --workspace=@dms/api
```

النتيجة:

- كل أوامر البناء نجحت.
- اختبارات API نجحت: 34 اختباراً.
- `db:verify` نجح.
- `npm install` نجح بدون vulnerabilities.
- بقي تحذير Vite عن حجم chunk أكبر من 500KB في web build.

أوامر غير متاحة:

```bash
npm run test --workspace=@dms/web
npm run test --workspace=@dms/desktop
```

السبب:

- لا يوجد script باسم `test` في workspaces:
  - `@dms/web`
  - `@dms/desktop`
