# DMS SOULUTION - Production Fix Report

تاريخ التقرير: 2026-05-09

هذا التقرير يلخص ما تم تنفيذه لتحويل النظام إلى نسخة Production Candidate مناسبة للتجربة داخل مطعم حقيقي. المشروع الحالي TypeScript/Node وليس Python، لذلك تم احترام التقنية الموجودة وعدم إعادة البناء من الصفر.

## المرحلة 0 - التدقيق

تم إنشاء `docs/FULL_PRODUCTION_GAP_AUDIT.md` بعد تحليل البنية، البناء، قاعدة البيانات، POS، الطباعة، الصندوق، المخزون، المحاسبة، العربية، والتشغيل.

أهم المشاكل قبل الإصلاح:

- فشل بناء API وWeb.
- فشل `db:verify` لأنه لا يواكب migrations الحالية.
- حفظ الطلب في POS كان يرسل `printNow: true`.
- حساب الصندوق كان يحتاج توحيداً على جدول `payments`.
- تحصيل الدليفري المؤجل لم يكن يفصل النقد عن البطاقة والتحويل بشكل كامل.
- واجهة إغلاق الجلسة كانت تمنع أي فرق صندوق قبل الوصول إلى سياسة API.
- الأمان كان يسمح بأسرار افتراضية وCORS مفتوح في الإنتاج.
- التوثيق التشغيلي المطلوب غير مكتمل.

## المرحلة 1 - البناء والحزم

ما تم:

- إصلاح أنواع `source_type` المحاسبية لتدعم الفواتير والقيود العكسية.
- إصلاح صفحات فواتير الشراء والبيع في Web.
- تحديث `db:verify` ليقرأ migrations الفعلية ويتحقق من الجداول الإنتاجية.
- إصلاح سياسة توفر المخزون لتستخدم `inventory_stock`.
- تحديث اختبارات POS والمخزون والمحاسبة.

التحقق:

- `npm run build` نجح بعد الإصلاحات الأولية.
- `npm run test --workspace=@dms/api` نجح.
- `npm run db:verify --workspace=@dms/api` نجح.

## المرحلة 2 - فصل الحفظ عن الطباعة

ما تم:

- إزالة الطباعة التلقائية من `POSContext.submitOrder()`.
- جعل `POST /pos/orders/:orderId/print` هو المسار الصريح للطباعة.
- دعم `processNow` لمعالجة طابور الطباعة عند الطلب.
- إضافة اختبار يؤكد أن حفظ الطلب لا ينشئ `print_jobs`.

Endpoints متأثرة:

- `POST /pos/orders`
- `POST /pos/orders/:orderId/print`

## المرحلة 3 - المدفوعات والصندوق

ما تم:

- إضافة `payments.session_id`, `payments.type`, `payments.notes`.
- دعم طرق الدفع: `CASH`, `CARD`, `TRANSFER`.
- ترحيل البيع النقدي إلى حساب الصندوق، والبطاقة/التحويل إلى حساب البنك.
- جعل الصندوق المتوقع يعتمد على `payments` النقدية فقط.
- إضافة اختيار طريقة الدفع في POS.

Migration:

- `0012_payments_session_and_type`

اختبارات مضافة:

- الدفع بالبطاقة لا يزيد النقد المتوقع.
- تحصيل الدليفري النقدي يحسب في جلسة التحصيل فقط.

## المرحلة 4 - سياسة إغلاق الجلسة

ما تم:

- دعم سبب فرق الصندوق في واجهة POS وصفحة الجلسات.
- دعم بيانات المدير عند الحاجة للموافقة.
- السماح بالفروقات الصغيرة مع سبب.
- منع الفروقات الكبيرة دون موافقة مدير حسب الإعدادات.
- حفظ `cash_difference` و`cash_difference_reason`.

Migration:

- `0013_pos_session_close_policy_defaults`

Endpoint متأثر:

- `POST /pos/sessions/close`

## المرحلة 5 - الإلغاء والمرتجعات

ما تم:

- `voidOrder` أصبح يعيد المخزون، يلغي المدفوعات، ويعكس القيود المرحلة.
- منع إلغاء طلب مدفوع دون موافقة مدير.
- حفظ سبب الإلغاء وسجل التدقيق.
- استمرار مسار المرتجعات مع قيد عكسي ومخزون صحيح.

Endpoints متأثرة:

- `POST /pos/orders/:orderId/void`
- `POST /pos/returns`

اختبارات مضافة:

- إلغاء دليفري معلق يعيد المخزون ويعكس القيد.
- إلغاء طلب مدفوع يتطلب مديراً.

## المرحلة 6 - الدليفري المؤجل

ما تم:

- واجهة تحصيل الدليفري أصبحت تسمح باختيار نقد، بطاقة، أو تحويل.
- تحصيل الدليفري بالبطاقة لا يدخل الصندوق النقدي.
- تحديث `orders.payment_method` عند التحصيل الفعلي.
- حفظ `orders.branch_id` عند إنشاء الطلب.
- إصلاح تقارير المبيعات والصندوق لتستخدم طريقة الدفع الفعلية.

Migration:

- `0014_order_branch_and_delivery_payment_backfill`

Endpoints متأثرة:

- `GET /pos/orders/pending-delivery`
- `POST /pos/orders/:orderId/collect-delivery`

اختبارات مضافة:

- تحصيل دليفري غير نقدي يرحل إلى البنك ولا يغير النقد المتوقع.

## المرحلة 7 - الأمان والنسخ الاحتياطي

ما تم:

- منع الأسرار الافتراضية في الإنتاج عبر `JWT_SECRET` و`REFRESH_SECRET`.
- منع CORS المفتوح في الإنتاج إذا لم يتم ضبط `DMS_CORS_ORIGINS`.
- إضافة حد محاولات تسجيل الدخول.
- تأمين Restore/Delete للنسخ الاحتياطية ضد مسارات خارج مجلد النسخ.
- منع الاستعادة أثناء وجود جلسات POS مفتوحة.
- تسجيل عمليات النسخ والاستعادة والحذف وتغيير مسار النسخ في Audit Log.
- ترقية Fastify وVite وElectron والتبعيات العابرة حتى أصبح `npm audit` بلا ثغرات معروفة.
- إضافة ESLint للواجهة وجعل `npm run lint` قابلاً للتشغيل.
- تصحيح بناء API حتى يعمل `npm run start --workspace=@dms/api` من `dist/index.js` فعلياً.

Endpoints متأثرة:

- `POST /auth/login`
- `GET /admin/backups`
- `POST /admin/backups`
- `POST /admin/backups/restore`
- `DELETE /admin/backups/:filename`
- `PUT /admin/backups/config`

## ملفات مهمة تم تعديلها

- `apps/api/src/config/security.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/backup.routes.ts`
- `apps/api/src/routes/pos.routes.ts`
- `apps/api/src/services/auth.ts`
- `apps/api/src/services/backupService.ts`
- `apps/api/src/services/policy.service.ts`
- `apps/api/src/services/pos.service.ts`
- `apps/api/src/services/reportingService.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/db/verify.ts`
- `apps/api/tests/pos-flow.test.js`
- `packages/shared/src/schemas/accounting.ts`
- `packages/shared/src/schemas/pos.ts`
- `apps/web/src/context/POSContext.tsx`
- `apps/web/src/pages/POSPage.tsx`
- `apps/web/src/pages/POSSessionsPage.tsx`
- `apps/web/src/pages/pos-components/OrderTypeSelector.tsx`
- `apps/web/src/pages/pos-components/PendingDeliveryDrawer.tsx`
- `apps/web/eslint.config.js`
- `apps/web/package.json`
- `apps/web/src/i18n/locales/ar/common.json`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/desktop/package.json`
- `packages/ui/package.json`
- `package.json`
- `package-lock.json`

## Migrations مضافة

- `0012_payments_session_and_type`
- `0013_pos_session_close_policy_defaults`
- `0014_order_branch_and_delivery_payment_backfill`

## الوثائق المضافة

- `docs/DEPLOYMENT_RESTAURANT_PC.md`
- `docs/INITIAL_SETUP_GUIDE.md`
- `docs/BACKUP_RESTORE.md`
- `docs/POS_WORKFLOW.md`
- `docs/PRINTING_WORKFLOW.md`
- `docs/DELIVERY_PENDING_WORKFLOW.md`
- `docs/SESSION_CLOSE_POLICY.md`
- `docs/ACCOUNTING_CONTROL_POLICIES.md`
- `docs/INVENTORY_WORKFLOW.md`
- `docs/ACCOUNTING_POSTING_RULES.md`
- `docs/AUDIT_LOG_POLICY.md`
- `docs/RISK_REGISTER.md`
- `docs/FULL_PRODUCTION_MANUAL_TEST.md`

## حالة التحقق الحالية

- `npm run build`: نجح.
- `npm run lint`: نجح.
- `npm run typecheck`: نجح.
- `npm run test --workspace=@dms/api`: نجح، 29/29 tests.
- `npm run db:verify --workspace=@dms/api`: نجح.
- `npm audit --audit-level=moderate`: نجح، 0 vulnerabilities.
- Smoke test للإنتاج على `node apps/api/dist/index.js` مع `NODE_ENV=production`: نجح وأعاد `/health`.

## ما يبقى قبل اعتماد إنتاج نهائي

- تنفيذ اختبار بصري RTL كامل بمتصفح حقيقي.
- اختبار طابعات فعلية على شبكة المطعم.
- تجربة Restore على نسخة تدريبية قبل استخدامها على جهاز الإنتاج.
- إعداد خدمة Windows أو PM2 فعلياً على جهاز المطعم.
- إضافة Web E2E tests إن توفر وقت للاعتماد الرسمي.
