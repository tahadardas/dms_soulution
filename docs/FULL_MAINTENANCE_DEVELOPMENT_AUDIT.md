# DMS SOULUTION - Full Maintenance Development Audit

تاريخ التدقيق: 2026-05-09

هذه الوثيقة هي نتيجة المرحلة 0 فقط. لم يتم تنفيذ إصلاحات منطقية في API أو Web أو Desktop ضمن هذه المرحلة. الأوامر التي تم تشغيلها للتدقيق:

```bash
npm install
npm run build --workspace=@dms/shared
npm run build --workspace=@dms/ui
npm run build --workspace=@dms/api
npm run build --workspace=@dms/web
npm run build --workspace=@dms/desktop
npm run build
npm run db:verify --workspace=@dms/api
npm run test --workspace=@dms/api
```

## 1. بنية المشروع

التطبيقات الموجودة:

- `apps/api`: Fastify + TypeScript + better-sqlite3 API.
- `apps/web`: React + Vite POS/Admin web app.
- `apps/desktop`: Electron desktop shell.

الحزم الموجودة:

- `packages/shared`: أنواع و Zod schemas مشتركة.
- `packages/ui`: مكونات UI مشتركة.

Workspaces:

```json
["apps/*", "packages/*"]
```

سكربتات الجذر:

- `dev`: تشغيل API و Web و Desktop معاً.
- `dev:api`, `dev:web`, `dev:desktop`: تشغيل كل تطبيق تطويرياً.
- `build`: يبني `shared`, ثم `ui`, ثم `api`, ثم `web`, ثم `desktop`.
- `typecheck`, `lint`, `format`.

طريقة تشغيل API:

- تطويرياً: `npm run dev --workspace=@dms/api`
- إنتاجياً حالياً: `npm run start --workspace=@dms/api` بعد البناء، لكن ملفات `start*.bat` تستخدم `npm run dev` وليست Production-ready.

طريقة تشغيل Web:

- تطويرياً: `npm run dev --workspace=@dms/web`
- إنتاجياً: `npm run build --workspace=@dms/web` ينتج `apps/web/dist`.

طريقة تشغيل Desktop:

- تطويرياً: `npm run dev --workspace=@dms/desktop`
- بناء TypeScript: `npm run build --workspace=@dms/desktop`
- تغليف: `npm run dist --workspace=@dms/desktop`

ملاحظات البنية:

- `packages/shared` و `packages/ui` موجودتان وتبنيان بنجاح.
- `packages/ui` يحتوي المكونات المطلوبة فعلياً مثل `Button`, `Card`, `Input`, `Select`, `Table`, `Modal`, `Switch`, `Tabs`, `StatusBadge`, `PageHeader`, `DateRangePicker`, `AdminLayout`, `Sidebar`, `TopBar`, `POSLayout`, `ToastProvider`, `ThemeProvider`, `useToast`, `useTheme`, `Column`.
- توجد imports عميقة إلى `@dms/shared/src/...` في API (`printingService.ts`, `settingsService.ts`). البناء ينجح، لكنها ليست ممارسة جيدة لأن `exports` الرسمية تشير إلى `dist`، وقد تكسر الإنتاج أو packaging لاحقاً.
- `apps/api/src/index.ts` لا يزال يحتوي مسارات كثيرة مباشرة بجانب route modules، وهذا يضعف الفصل المعماري ويزيد احتمال التسجيل المكرر.

## 2. حالة البناء

نتيجة `npm install`:

- نجح.
- أزال حزمتين وعدّل 3 حزم.
- `npm audit`: لا توجد vulnerabilities معلنة.

نتائج البناء:

- `@dms/shared`: نجح.
- `@dms/ui`: نجح.
- `@dms/api`: نجح.
- `@dms/web`: نجح مع تحذير Vite أن chunk واحد أكبر من 500KB.
- `@dms/desktop`: نجح.
- `npm run build` من الجذر: نجح.

TypeScript:

- لا توجد TypeScript errors في أوامر البناء الحالية.
- لا توجد imports مكسورة ظاهرة من البناء.

Tests:

- `npm run test --workspace=@dms/api`: نجح.
- 29 اختباراً ناجحاً، 0 فشل.
- التغطية الحالية جيدة جزئياً للمخزون، القيود، POS basic flow، الديلفري، المرتجع، والـvoid، لكنها لا تغطي USB Desktop Agent الحقيقي ولا توحيد print job statuses ولا route prefix.

## 3. قاعدة البيانات

الملفات الرئيسية:

- `apps/api/src/database.ts`: يفتح DB، يشغل migrations، ثم seed.
- `apps/api/src/db/connection.ts`: يقرأ `DMS_DB_PATH` أو يستخدم افتراضياً `dms.db` في جذر المشروع.
- `apps/api/src/db/migrate.ts`: نظام migrations فعلي.
- `apps/api/src/db/backup.ts`: backup قبل migration عند وجود pending migrations وقاعدة غير فارغة.
- `apps/api/src/db/verify.ts`: تحقق من migrations و pragmas والنسخ الاحتياطي.
- `apps/api/src/db-resources/schema.sql`: توثيق فقط ويصرح أن مصدر الحقيقة هو migrations.
- `apps/api/src/db/migrations`: يحتوي migrations من `0001` إلى `0014`.

مصدر الحقيقة:

- المصدر العملي هو `apps/api/src/db/migrations`.
- `schema.sql` ليس مصدر تنفيذ، وهو موثق كمرجع فقط.

قاعدة البيانات المعتمدة فعلياً:

- عند عدم ضبط `DMS_DB_PATH`: `d:\dms-soulution\dms.db`.
- في الإنتاج يجب ضبط `DMS_DB_PATH=C:\DMS\data\dms.db`.

Pragmas:

- `foreign_keys = ON`
- `journal_mode = WAL`
- `busy_timeout = 5000`
- `synchronous = NORMAL`

`schema_migrations`:

- موجود.
- يحتوي إصدارات `0001` إلى `0014`.
- `db:verify` نجح.

Backup قبل migration:

- موجود في `apps/api/src/db/backup.ts`.
- توجد backups سابقة في `backups/`.
- المسار الحالي للـbackup قبل migration يكون داخل مجلد بجانب ملف DB الفعلي، وعملياً مع `dms.db` الحالي يظهر في `backups/`.

ملفات DB الموجودة:

- `dms.db`: قاعدة فعالة غير فارغة.
- `dms.db-shm`, `dms.db-wal`: ملفات WAL فعالة.
- `database.sqlite`: صفر bytes.
- `apps/api/dms.db`: صفر bytes.
- `apps/api/database.sqlite`: صفر bytes.
- `apps/api/src/db/database.db`: صفر bytes.
- `apps/api/backups/dms-backup-2026-05-05T16-55-51-823Z.sqlite`: backup قديم.

الجداول المطلوبة:

- `payments`: موجود.
- `inventory_stock`: موجود.
- `audit_logs`: موجود.
- `settings_history`: موجود.
- `manager_approvals`: موجود.
- `fiscal_periods`: موجود.
- `sequences`: موجود، لكنه غير مستخدم حالياً لتوليد أرقام الطلبات.
- `workstations`: غير موجود.

مشاكل قاعدة البيانات:

- P0: لا يوجد جدول `workstations` رغم وجود endpoints شكلية له.
- P0: `print_jobs` يحتوي حقولاً مزدوجة (`retry_count/error_message` و `retries/last_error`) وغير موحدة.
- P0: statuses الموجودة فعلياً في `print_jobs`: `FAILED`, `PROCESSING`. النظام المطلوب يريد `PENDING`, `LOCKED`, `PRINTING`, `SUCCESS`, `FAILED`, `CANCELLED`.
- P1: توجد ملفات DB قديمة/فارغة يجب عزلها أو توثيقها في `legacy-db-backups` بعد فحصها.

## 4. POS

الملفات:

- `apps/web/src/context/POSContext.tsx`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/pos-components/*`
- `apps/api/src/services/pos.service.ts`
- `apps/api/src/routes/pos.routes.ts`

الوضع الحالي:

- حفظ الطلب لا يطبع تلقائياً حالياً. تم تعليق منطق `printNow` في `createOrder`.
- زر "طباعة" يستدعي `POST /pos/orders/:orderId/print` على آخر طلب محفوظ.
- لا يوجد زر مستقل واضح لإرسال المطبخ KOT في `POSToolbar`.
- POS مفكك جزئياً إلى components: `POSToolbar`, `CartPanel`, `SalesDrawer`, `ReturnsDrawer`, `PendingDeliveryDrawer`, `ProductCategoryTabs`, `OrderTypeSelector`, `DeliveryPanel`.
- `POSPage.tsx` لا يزال كبيراً جداً ويحتوي منطق تحميل منتجات، مرتجعات، جلسات، وطباعة.
- التصنيفات تظهر، لكن زر "All" موجود وهو الافتراضي (`selectedCategoryId = null`)، وهذا يعرض كل المنتجات افتراضياً عند وجود تصنيفات.
- Backend يدعم `GET /pos/products?categoryId=` ويطبق التصنيف والبحث معاً.
- `lastOrder` محفوظ بعد نجاح الحفظ.
- توجد حماية double submit جزئياً عبر `isSubmitting` في الواجهة، لكن لا يوجد idempotency key في API.

الديلفري:

- يدعم `orderType = DELIVERY` و `paymentMode = PAY_LATER`.
- ينشئ status `PENDING_DELIVERY` و `payment_status = UNPAID`.
- لا ينشئ payment ولا cash entry للديلفري المعلق.
- توجد قائمة pending delivery.
- تحصيل الديلفري يرسل دائماً `amount = collectingOrder.total` من الواجهة، ولا يسمح للمستخدم بإدخال مبلغ مختلف، لكن API لا يتحقق من remaining amount بدقة.

الصندوق والجلسات:

- فتح الجلسة موجود.
- منع فتح جلستين لنفس المستخدم موجود.
- إغلاق الجلسة يحسب `expected_cash`, `actual_cash`, `cash_difference`.
- لا يوجد Cash In / Cash Out.
- `expected_cash` لا يحتسب Cash In / Cash Out لأنها غير موجودة.
- `getSessionStats` يتعامل مع refunds عبر `payments.status = 'REFUNDED'` بينما جدول `payments` يستخدم أيضاً `type = 'REFUND'`.
- تقرير Z الحالي في `queueZReport` بسيط ولا يعتمد بالكامل على payments.

## 5. الطباعة

الملفات:

- `apps/api/src/services/printingService.ts`
- `apps/api/src/routes/printing.routes.ts`
- `apps/web/src/services/printer.service.ts`
- `apps/web/src/pages/PrinterTemplatesPage.tsx`
- `apps/web/src/pages/PrinterRoutesPage.tsx`
- `apps/web/src/pages/PrinterJobsPage.tsx`
- `apps/web/src/pages/PrintersPage.tsx`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`

الوضع الحالي:

- POS يستخدم backend endpoint للطباعة، والـbackend يبني payload ويستخدم `print_templates` في `PrintingService.enqueueJob`.
- لا يزال `apps/web/src/services/printer.service.ts` يحتوي HTML hardcoded للإيصال و KOT. لا يظهر أنه مستخدم مباشرة في POS الحالي، لكنه خطر معماري ويجب إزالته أو عزله.
- `print_jobs` موجودة.
- `printer_routes` موجودة.
- route resolution موجود في `PrintingService.resolveRoute`.
- NETWORK printing موجود عبر TCP socket.
- USB/Windows ليس منفذاً فعلياً كـqueue agent؛ الموجود فقط IPC مباشر `printers:print` من الواجهة.
- Electron لا يقرأ `print_jobs` ولا يعمل polling ولا lock/complete/fail.
- endpoints الخاصة بالـDesktop Agent في `printing.routes.ts` placeholders صريحة.
- endpoint test printer يرجع success شكلياً ولا يطبع فعلياً.
- `processQueue` يغيّر job إلى `PROCESSING` قبل معرفة نوع الطابعة، ثم إذا كانت USB/WINDOWS يتركها دون إعادتها إلى `PENDING`، ما ينتج jobs عالقة في `PROCESSING`.

Route prefix:

- `apps/api/src/index.ts` يسجل `printingRoutes` مع prefix `/printing`.
- `apps/api/src/routes/printing.routes.ts` يعرّف داخلياً `/printing/printers`, `/printing/jobs`, إلخ.
- النتيجة: مسارات فعلية من نوع `/printing/printing/printers`.
- `index.ts` يحتوي أيضاً مسارات مباشرة `/printing/...`.
- P0: route duplication وprefix bug يجب إصلاحهما قبل بناء Agent.

Templates:

- DB يحتوي `KOT`, `RECEIPT`, `Z_REPORT`.
- لا يوجد `RETURN_RECEIPT`.
- لا يوجد `DELIVERY_RECEIPT`.
- `buildOrderPrintPayload` يحتوي نصوص عربية mojibake في `payment_notice` و `footer_message`.
- الكاشير يؤخذ من `o.collected_by`، وليس من مستخدم session، فيطبع `Staff` للطلبات غير المحصلة.
- payload لا يحتوي كل الحقول المطلوبة مثل `paid_amount`, `remaining_amount`, `receipt_items`, `kitchen_items`, `is_reprint`, `reprint_notice`.

## 6. الصندوق والجلسات

الموجود:

- `openSession`
- `closeSession`
- `opening_cash`
- `expected_cash`
- `actual_cash`
- `cash_difference`
- `cash_difference_reason`
- موافقة مدير عند فرق كبير حسب settings.

غير موجود أو ناقص:

- Cash In / Cash Out endpoints غير موجودة.
- لا يوجد `cash_movements` أو استخدام مضبوط لـpayments لهذا الغرض.
- `expected_cash` لا يتضمن cash_in/cash_out.
- `close_approval_reason` موجود في schema لكنه لا يعبأ في closeSession.
- سياسة pending delivery تسمح حالياً بإغلاق الجلسة إذا setting `allowCloseSessionWithPendingDelivery=true`، دون تحذير موثق في الواجهة.
- Z Report لا يعرض الحقول المطلوبة كاملة.

## 7. الديلفري

الموجود:

- `PENDING_DELIVERY`.
- `UNPAID`.
- `GET /pos/orders/pending-delivery`.
- `POST /pos/orders/:orderId/collect-delivery`.
- pending delivery لا يدخل الصندوق عند الحفظ.
- التحصيل ينشئ payment type `DELIVERY_COLLECTION`.

المشاكل:

- P0: API لا يحسب `remaining_amount = total_amount - paid_amount`.
- P0: API لا يرفض المبلغ الناقص أو الزائد.
- P0: API يمنع التحصيل الثاني فقط عبر `payment_status === 'PAID'`، لكنه لا يتحقق من payments السابقة أو race condition داخل transaction.
- P1: لا يوجد unique/control واضح يمنع أكثر من collection لنفس order إذا حدث ضغط متزامن.
- P1: Z Report لا يعزل pending delivery وdelivery collected بشكل كاف.

## 8. المخزون

الموجود:

- `InventoryService`.
- `inventory_movements` كدفتر حركات.
- `inventory_stock` كمصدر snapshot.
- WAC موجود.
- `consumeRecipe` يخصم المكونات.
- `returnStock` موجود.
- `processSale` يستخدم recipe consumption.
- منع البيع تحت الصفر موجود عند `allowNegativeStock=false`.

المشاكل:

- P0: إعداد قاعدة البيانات الحالي `inventory.allowNegativeStock=true`، وهذا يسمح بسالب المخزون ميدانياً ما لم يغيره المدير.
- P0: سياسة مرتجع Recipe غير متسقة: `processReturn` لا يعيد مخزون recipe ولا يعكس حركات المكونات، لكن `createReturn` ينشئ قيداً محاسبياً يعكس المخزون و COGS بناءً على `cost_at_time`. هذا يجعل المحاسبة تقول إن المخزون زاد بينما `inventory_stock` لم يزد.
- P1: لا توجد وثيقة `docs/RECIPE_RETURN_POLICY.md` في المشروع.
- P1: تقرير المخزون فيه bug في ترتيب parameters عند `getInventoryMovementTransactions` مع `branchId`: يضيف `branchId` قبل `filters.key` بينما SQL يتوقع key قبل branch.

## 9. المحاسبة

الموجود:

- `journal_entries`, `journal_lines`.
- `createJournalEntry` يمنع القيد غير المتوازن افتراضياً.
- `postEntry` يمنع ترحيل قيد غير متوازن.
- `updateJournalEntry` يمنع تعديل القيد posted.
- `reverseEntry` موجود.
- POS sale posting موجود.
- delivery pending لا يدخل cash عند الحفظ.
- delivery collection يعترف بالإيراد عند التحصيل فقط.

المشاكل:

- P1: endpoint إنشاء قيد يدوي يسمح بـ`allowUnbalanced` لعمل draft غير متوازن. هذا مقبول كمسودة فقط، لكن يجب التأكد من وضوحه في الواجهة والسياسات.
- P1: سياسة الديلفري المحاسبية موجودة ضمنياً (الإيراد عند التحصيل فقط) لكنها تحتاج توثيق في `docs/ACCOUNTING_POSTING_RULES.md` وتدقيق مع Z Report.
- P0: مرتجع Recipe يسبب عدم اتساق بين المحاسبة والمخزون كما ذُكر أعلاه.
- P1: `CostAccountingService` يحتوي in-memory/mock logic ولا يصلح كجزء إنتاجي.

## 10. الصلاحيات والسياسات

الموجود:

- RBAC middleware.
- JWT access + refresh.
- secure password hashing عبر bcryptjs.
- Permissions أساسية موجودة.
- `POS_ORDER_PRINT` و `POS_ORDER_REPRINT` موجودتان.
- `PRINTING_MANAGE` و `PRINTER_TEST` موجودتان في API config.

المشاكل:

- P0: عمليات حساسة كثيرة لا تزال تستخدم `POS_SALE` أو `POS_RETURNS` بدلاً من صلاحيات دقيقة:
  - void يستخدم `POS_SALE`.
  - collect delivery يستخدم `POS_SALE`.
  - return يستخدم `POS_RETURNS` لا `POS_RETURN_CREATE`.
  - close session يستخدم `POS_CLOSE_SESSION` بدلاً من الاسم المطلوب `POS_SESSION_CLOSE`.
- P0: الصلاحيات المطلوبة غير مكتملة:
  - لا يوجد `POS_ORDER_VOID`.
  - لا يوجد `POS_RETURN_CREATE`.
  - لا يوجد `POS_DELIVERY_COLLECT`.
  - لا يوجد `POS_DISCOUNT_APPLY`.
  - لا يوجد `POS_SESSION_CLOSE` بالاسم المطلوب.
  - لا يوجد `POS_CASH_IN`.
  - لا يوجد `POS_CASH_OUT`.
  - لا يوجد `MANAGER_APPROVAL`.
- P0: `requireManagerApproval` يتحقق من كلمة المرور فقط، ثم يحسب `hasManagerPerm` لكنه لا يستخدمه للرفض.
- P0: لا يوجد منع self-approval.
- P1: رسائل RBAC للكاشير تقنية مثل `Forbidden: Missing permission ...`.

## 11. العربية و UX

الإيجابيات:

- توجد ملفات i18n عربية في `apps/web/src/i18n/locales/ar/common.json`.
- الخط العربي Cairo موجود في build assets.
- `chcp 65001` موجود في batch files.
- الواجهة تستخدم `react-i18next`.

المشاكل:

- P0: توجد نصوص عربية mojibake داخل TypeScript و batch files:
  - `policy.service.ts`
  - `pos.service.ts`
  - `POSPage.tsx`
  - `POSToolbar.tsx`
  - `PendingDeliveryDrawer.tsx`
  - `BackupManagementPage.tsx`
  - `start.bat`
- P0: نص `payment_notice` و `footer_message` في print payload تالف، وهذا سيظهر في الإيصالات.
- P1: بعض صفحات الطابعات تستخدم نصوص إنجليزية hardcoded مثل `System Printers (Device)`, `Test Print`, `Save Configuration`.
- P1: POS لا يحتوي زر واضح لإرسال المطبخ، وهذا UX مهم للكاشير.
- P1: رسائل أخطاء backend كثيرة تقنية أو mojibake.

## 12. تصنيف المشاكل

### P0 - تمنع التشغيل الميداني

1. Route prefix للطباعة ينتج `/printing/printing/...` مع وجود routes مكررة في `index.ts`.
2. endpoints Desktop Agent للـUSB/Windows placeholders ولا تنفذ register/pending/lock/complete/fail.
3. لا يوجد جدول `workstations`.
4. USB/Windows printers ليست Queue Agent فعلية، وElectron لا يقرأ `print_jobs`.
5. print job statuses غير موحدة وتستخدم `PROCESSING/COMPLETED` بدلاً من المجموعة المطلوبة.
6. `processQueue` يعلق USB jobs في `PROCESSING`.
7. endpoint اختبار الطابعة يرجع success شكلياً.
8. `print_jobs` schema يحتوي حقولاً مزدوجة وغير موحدة.
9. POS لا يحتوي زر KOT مستقل.
10. التصنيفات تعرض كل المنتجات افتراضياً عبر زر All الافتراضي.
11. أرقام الطلبات تستخدم `ORD-${Date.now().toString().slice(-6)}` ولا تستخدم `sequences`.
12. تحصيل الديلفري لا يتحقق من remaining amount ولا يرفض الناقص/الزائد.
13. لا يوجد Cash In / Cash Out.
14. Z Report لا يعتمد بالكامل على payments ولا يعرض المتطلبات كاملة.
15. مرتجع Recipe غير متسق بين المخزون والمحاسبة.
16. صلاحيات العمليات الحساسة غير دقيقة.
17. Manager Approval لا يفرض صلاحية المدير ولا يمنع self-approval.
18. نصوص عربية تالفة في مسارات أساسية وطباعة.
19. ملفات التشغيل `start*.bat` تعتمد على `npm run dev`.

### P1 - تمنع الاعتماد الرسمي

1. `buildOrderPrintPayload` ناقص ولا يفرق بين `receipt_items` و `kitchen_items`.
2. reprint لا يدعم endpoint الموحد `/pos/orders/:orderId/print` مع `isReprint/reason` كما هو مطلوب.
3. templates ناقصة: `RETURN_RECEIPT`, `DELIVERY_RECEIPT`.
4. `PrinterService` في web يحتوي HTML hardcoded يجب عزله.
5. قاعدة البيانات تحتوي ملفات DB قديمة/فارغة يجب عزلها وتوثيقها.
6. تقرير inventory transactions يملك bug في ترتيب parameters مع branch filter.
7. لا توجد وثيقة Recipe Return Policy.
8. سياسة الديلفري المحاسبية غير موثقة بوضوح.
9. `CostAccountingService` mock/in-memory.
10. backup/restore لا يطبق Daily Auto Backup ولا تأكيد قوي متعدد الخطوات.
11. لا توجد خدمة Windows/PM2 production setup جاهزة.

### P2 - تحسينات لاحقة

1. تقسيم `POSPage.tsx` إلى hooks/components إضافية.
2. code splitting للـWeb لتقليل chunk أكبر من 500KB.
3. تحسين نصوص صفحات الطابعات والbackup لتكون عربية بالكامل.
4. توحيد imports من `@dms/shared` بدلاً من `@dms/shared/src/...`.
5. إضافة idempotency لحفظ الطلب والطباعة تحت الضغط.

## ملخص المرحلة 0

الملفات التي تم إنشاؤها:

- `docs/FULL_MAINTENANCE_DEVELOPMENT_AUDIT.md`

الموديولات المكتملة:

- لا يوجد تنفيذ موديولات في هذه المرحلة. هذا تدقيق فقط.

جداول قاعدة البيانات المضافة:

- لا يوجد.

Endpoints مضافة:

- لا يوجد.

Migrations مضافة:

- لا يوجد.

حالة القبول للمرحلة التالية:

- البناء الحالي ناجح.
- الاختبارات الحالية ناجحة.
- الأولوية التنفيذية التالية يجب أن تكون المرحلة 1/2 بشكل محدود، ثم إصلاح P0 للطباعة: route prefix, statuses, schema cleanup, workstations, Desktop Agent flow.
