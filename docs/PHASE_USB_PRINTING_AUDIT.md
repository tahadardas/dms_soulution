# DMS SOULUTION — برومبت صيانة نهائي مع دعم طباعة USB / Windows Printers

## مرحلة 0 — تدقيق الطباعة والنواقص قبل التعديل

### 1. ملفات الطباعة الحالية

#### Backend (API)
- `apps/api/src/services/printingService.ts` - خدمة الطباعة الأساسية
- `apps/api/src/services/pos.service.ts` - خدمة نقطة البيع (تستخدم printingService)
- `apps/api/src/routes/pos.routes.ts` - مسارات نقطة البيع (تحتوي على endpoint للطباعة)
- **لا يوجد** `apps/api/src/routes/printing.routes.ts` (مسارات طباعة منفصلة)

#### ويب (Web)
- `apps/web/src/services/printer.service.ts` - خدمة الطابعة (تتكامل مع Electron)
- `apps/web/src/pages/PrinterTemplatesPage.tsx` - صفحة إدارة قوالب الطباعة
- `apps/web/src/pages/PrinterRoutesPage.tsx` - صفحة إدارة مسارات الطباعة
- `apps/web/src/pages/PrinterJobsPage.tsx` - صفحة إدارة وظائف الطباعة
- `apps/web/src/pages/PrintersPage.tsx` - صفحة إدارة الطابعات

#### سطح المكتب (Desktop)
- `apps/desktop/src/main.ts` - العملية الرئيسية لـ Electron
- `apps/desktop/src/preload.ts` - السكربت المسبق التحميل لـ Electron
- لا توجد ملفات أخرى محددة للطباعة في المجلد src

### 2. الوضع الحالي

#### Backend
- **Backend يدعم NETWORK فقط**: نعم، في `printingService.ts` تُرسل وظائف الطباعة فقط للطابعات الشبكية عبر sockets (المنفذ 9100). 
  - في الدالة `processQueue()`، يتم التحقق من `printer.type !== 'NETWORK'` وإلقاء خطأ إذا لم تكن NETWORK.
  - لا يوجد دعم لأنواع الطابعات USB/WINDOWS في backend.
- **USB / WINDOWS printer موجودة كنوع فقط أم تنفذ فعلياً؟** 
  - في جدول `printers`، لا يوجد حقل `type` في الوقت الحالي (من فحص الكود: في `createPrinter` و `updatePrinter` يتم استخدام الحقول `type`، لكن لا نراه في قائمة المختارات في `listPrinters`?实际上，在`listPrinters`中选择了`p.*`，所以如果表中有`type`列，它就会被选中。但是我们没有看到表结构。从代码中可以看到在`createPrinter`和`updatePrinter`中有`type`字段，所以它存在。然而，在`resolveFallbackPrinter`和`processQueue`中，只有NETWORK类型被处理，其他类型会导致错误或被忽略。
  - في الواجهة (`PrintersPage.tsx`)، يتم دعم أنواع `NETWORK`, `USB`, `BLUETOOTH` (انظر السطر 14). لكن عند حفظ الطابعة، يتم إرسال النوع إلى backend، ومع ذلك backend لا يتعامل مع الأنواع غير NETWORK بشكل صحيح.
- **Electron لديه IPC للطباعة؟** 
  - نعم، في `apps/web/src/services/printer.service.ts` توجد وظائف مثل `getPrinters`, `getConfig`, `saveConfig`, `printTest`, `printReceipt`, `printKOT` التي تستخدم `window.electronAPI`.
  - ومع ذلك، لا يوجد IPC مخصص لوظائف الطباعة (`print_jobs`) من backend إلى Electron.
- **Electron مربوط بـ `print_jobs`?** 
  - لا، لا يوجد ربط. Electron يُستخدم فقط للطباعة المباشرة عبر الإعدادات التي يحفظها المستخدم في الواجهة (عبر `PrinterService.getConfig` و `PrinterService.saveConfig`). لا يتم استلام وظائف الطباعة من backend.
- **POS يستخدم `print_templates`?** 
  - لا، في `pos.service.ts`، الدالة `buildOrderPrintPayload` تبني payload بسيطًا، لكن لا يتم تطبيق أي قالب. وفي `printOrder` -> `queueOrderPrintJobs` -> `printingService.enqueueJob` يتم استخدام payload دون تطبيق قالب.
  - في `printingService.enqueueJob`، إذا لم يتم توفير `templateId`، يتم استخدام محتوى افتراضي: `this.renderTemplate('{{payload}}', { payload: JSON.stringify(input.payload, null, 2) });` مما يعني أن القالب ليس هو المتحكم في التصميم.
- **POS يبني HTML hardcoded؟** 
  - لا، POS لا يبني HTML. ومع ذلك، فإن `PrinterService` في الويب (الذي يستخدمه Electron) يبني HTML hardcoded في وظائف `printReceipt` و `printTest` و `printKOT`. هذا يخالف المتطلب الذي يمنع استخدام HTML hardcoded للإيصال داخل POS (لكنه في Electron، وليس في POS المباشر).
- **زر حفظ الطلب يطبع؟** 
  - في `pos.routes.ts`، عند إنشاء الطلب (`/pos/orders`)، إذا كان `data.printNow` صحيحًا، يتم استدعاء `service.queueOrderPrintJobs` (السطر 473-476). لذلك، نعم، زر حفظ الطلب يطبع إذا تم تفعيل `printNow`.
  - لكن في الواجهة، لا نرى زر حفظ يطلب الطباعة تلقائيًا. ومع ذلك، فإن الكود في backend يدعم ذلك.
- **زر الطباعة ينشئ Print Job؟** 
  - نعم، في `pos.routes.ts`، endpoint `/pos/orders/:orderId/print` (السطر 276-289) يستدعي `service.printOrder` والذي بدوره يستدعي `queueOrderPrintJobs` والذي ينشئ وظائف طباعة عبر `printingService.enqueueJob`.
- **حالة Print Job تتحدث؟** 
  - نعم، في `printingService.processQueue()`، يتم تحديث الحالة من `PENDING` إلى `PROCESSING` ثم إلى `COMPLETED` أو `FAILED`. ومع ذلك، هذا يعمل فقط للطابعات الشبكية.
  - للطابعات USB/WINDOWS، لا يتم معالجة الوظائف من قبل backend، لذلك تظل في الحالة `PENDING` إلى أن تُعاد المحاولة وتفشل في النهاية (لأن backend يحاول معالجتها ويفشل لأنها ليست NETWORK).
- **توجد إعادة طباعة؟** 
  - نعم، في `pos.routes.ts` هناك endpoint `/pos/orders/:orderId/reprint` (السطر 258-274) والذي يستدعي `service.reprintReceipt`.
  - في `pos.service.ts`، الدالة `reprintReceipt` تزيد من `reprint_count` وتستدعي `queueOrderPrintJobs` لإيصال فقط.
- **يوجد Audit للطباعة؟** 
  - لا، لا يوجد Audit خاص بالطباعة. هناك Audit عام في middleware، لكن لا يوجد تسجيل محدد لEvents الطباعة (مثل إنشاء وظيفة طباعة، بدء الطباعة، نجاح/Failure).

### 3. النواقص

#### P0 = تمنع الطباعة الإنتاجية
1. لا يدعم backend طابعات USB/WINDOWS فعليًا - عند محاولة طباعة وظيفة لطابعة USB/WINDOWS، يخلف backend خطأ ويضع الوظيفة في حالة FAILED (بعد إعادة المحاولات).
2. لا يوجد نظام ربط بين backend وElectron لتنفيذ وظائف الطباعة على الطابعات المحلية (USB/WINDOWS).
3. POS يستخدم `printNow` عند حفظ الطلب (مما يؤدي إلى طباعة تلقائية) - يجب أن يكون الحفظ فقط دون طباعة.
4. لا يوجد تأثير لقوالب الطباعة (`print_templates`) على محتوى الوظيفة - يتم استخدام payload الخام أو قالب افتراضي بسيط.
5. لا يوجد نظام لمحطات العمل (workstation/device) لتحديد أي جهاز يجب أن يطبع وظيفة USB/WINDOWS.

#### P1 = مهمة قبل الاعتماد
1. عدم وجود Audit مفصل لعمليات الطباعة (إنشاء، بدء، نجاح/Failure، إعادة طباعة).
2. عدم وجود طريقة لإظهار خطأ واضح للمستخدم عند فشل الطباعة (إلا من خلال حالة الوظيفة التي قد لا تُShown في الواجهة بشكل بارز).
3. لا يدعم endpoint `/pos/orders/:orderId/print` خاصية `processNow` بشكل صحيح للطابعات USB/WINDOWS (حيث يجب ترك الوظيفة في حالة PENDING للجهاز).
4. لا توجد شاشة اختبار للطابعات في الواجهة تختبر من خلال إنشاء وظيفة طباعة ومتابعة حالتها (الاختبار الحالي في `PrinterService` يرسل HTML مباشرًا عبر Electron، وليس عبر backend).
5. لا يتم تحديث حالة الوظيفة بنجاح أو فشل من قبل Electron للطابعات USB/WINDOWS.

#### P2 = تحسينات لاحقة
1. تحسين보고ات الطباعة والإحصائيات.
2. دعم المزيد من أنواع الطابعات (مثل Bluetooth).
3. تحسين واجهة إعدادات الطابعات لتظهر الحالات المتقدمة (مثل livello dell'inchiostro).
4. إضافة دعم لخيارات الورق المتقدمة (مثل الألوان، الجودة).
5. أرشفة وظائف الطباعة القديمة.
