# Printer Setup Guide

## Network Printers

1. افتح إعدادات الطابعات.
2. أنشئ Printer بنوع `NETWORK`.
3. أدخل IP والمنفذ، غالباً `9100`.
4. اربطها عبر Printer Route مناسب:
   - `RECEIPT` للكاشير.
   - `KOT` للمطبخ.
5. نفذ Test Print وتأكد أن `print_job.status` يصبح `SUCCESS`.

## USB / Windows Printers

1. شغل تطبيق Desktop على جهاز الكاشير.
2. سجل الدخول حتى يبدأ Desktop Print Agent.
3. تأكد أن الجهاز سجل workstation عبر `device_key`.
4. من إعداد الطابعة، استخدم اسم طابعة Windows المحلي في `windows_printer_name`.
5. اجعل نوع الطابعة `USB` أو `WINDOWS`.
6. اربط `device_id` أو workstation الخاص بجهاز الكاشير.
7. احفظ Printer Route للإيصال أو KOT.
8. نفذ طباعة اختبار.

## قواعد مهمة

- تصميم الإيصال وKOT يأتي من `print_templates`.
- اختيار الطابعة يأتي من `printer_routes`.
- كل طباعة تنشئ `print_jobs`.
- لا تعتبر الطباعة ناجحة إلا بعد تحول المهمة إلى `SUCCESS`.
- إذا فشلت الطباعة يجب مراجعة `error_message`.
