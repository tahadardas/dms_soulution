# تشغيل النظام على كمبيوتر المطعم

هذا الدليل يصف تشغيل Production Candidate على جهاز مطعم محلي. لا تستخدم `npm run dev` للإنتاج.

## المتطلبات

- Windows 10/11 أو Windows Server حديث.
- Node.js LTS مناسب للمشروع.
- صلاحيات كتابة داخل مجلد التطبيق والنسخ الاحتياطية.
- شبكة محلية ثابتة للطابعات وأجهزة الكاشير.

## بنية المجلد المقترحة

```txt
C:\DMS\
  app\
  data\dms.db
  backups\
  logs\
  config\
```

## متغيرات البيئة

```txt
NODE_ENV=production
DMS_DB_PATH=C:\DMS\data\dms.db
JWT_SECRET=<strong-random-secret>
REFRESH_SECRET=<strong-random-refresh-secret>
DMS_CORS_ORIGINS=http://localhost:4173,http://127.0.0.1:4173
```

في الإنتاج لن يعمل API إذا بقيت أسرار JWT افتراضية أو إذا لم يتم ضبط CORS.

## البناء

```bash
npm install
npm run build
```

## تشغيل API

```bash
npm run start --workspace=@dms/api
```

يفضل تشغيل API كخدمة Windows أو عبر PM2:

```bash
npm install -g pm2
pm2 start apps/api/dist/index.js --name dms-api
pm2 save
```

اختبار صحة سريع بعد التشغيل:

```http
GET http://127.0.0.1:3000/health
```

يجب أن يرجع:

```json
{
  "status": "ok"
}
```

## تشغيل الواجهة

الواجهة تبنى عبر:

```bash
npm run build --workspace=@dms/web
```

يمكن خدمتها من خادم ثابت داخلي أو عبر تطبيق Desktop/Electron حسب بيئة المطعم.

## تشغيل Desktop

```bash
npm run build --workspace=@dms/desktop
```

بعد البناء، اضبط رابط API في إعدادات الجهاز إن كانت الواجهة لا تتصل تلقائياً.

## الطابعات

- أعط كل طابعة IP ثابتاً.
- أضف الطابعات من صفحة الإعدادات.
- اربط KOT بالمطبخ والإيصال بالكاشير عبر Printer Routes.
- نفذ اختبار طباعة قبل فتح أول وردية.

## قاعدة البيانات

- استخدم مساراً ثابتاً في `DMS_DB_PATH`.
- لا تنقل ملف قاعدة البيانات أثناء تشغيل API.
- migrations تعمل عند تشغيل API وتنتج backup قبل الترحيل عند وجود قاعدة بيانات غير فارغة.

## التشغيل اليومي

1. شغل API.
2. افتح POS.
3. تحقق من الاتصال بالطابعات.
4. افتح وردية.
5. نفذ المبيعات.
6. أغلق الوردية وراجع تقرير الجلسة.
7. أنشئ backup نهاية اليوم.

## نقل النظام لجهاز آخر

1. أغلق كل الجلسات.
2. أنشئ backup.
3. أوقف API.
4. انسخ مجلد `data` و`backups` و`config`.
5. شغل النظام على الجهاز الجديد بنفس متغيرات البيئة.
6. نفذ `db:verify`.
