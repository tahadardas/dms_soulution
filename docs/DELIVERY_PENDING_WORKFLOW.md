# دليفري دفع عند التسليم

## إنشاء طلب معلق

1. اختر نوع الطلب `DELIVERY`.
2. اختر الدفع عند التسليم.
3. أدخل بيانات التوصيل.
4. احفظ الطلب.

النتيجة:

- `orders.status = PENDING_DELIVERY`
- `orders.payment_status = UNPAID`
- لا يتم إدخال المبلغ إلى الصندوق.
- يتم ترحيل تكلفة المخزون فقط إذا كانت السياسة فورية.

## عرض الطلبات المعلقة

```http
GET /pos/orders/pending-delivery
```

يمكن التصفية بالفرع أو الجلسة.

## التحصيل

```http
POST /pos/orders/:orderId/collect-delivery
```

Payload:

```json
{
  "amount": 100,
  "paymentMethod": "CASH",
  "sessionId": "<current-session-id>"
}
```

طرق الدفع:

- CASH: يزيد النقد المتوقع في جلسة التحصيل.
- CARD: يرحل للبنك ولا يزيد النقد.
- TRANSFER: يرحل للبنك ولا يزيد النقد.

## منع التحصيل مرتين

السياسة تمنع تحصيل طلب لم يعد `PENDING_DELIVERY` أو لم يعد `UNPAID`.

## الأثر المحاسبي

عند التحصيل:

- Debit: الصندوق أو البنك.
- Credit: الإيرادات.
- يحفظ سجل في `payments` بنوع `DELIVERY_COLLECTION`.

## ملاحظة مهمة

طريقة الدفع النهائية تحفظ في `orders.payment_method` عند التحصيل، لذلك تقارير المبيعات حسب طريقة الدفع تعتمد على القيمة الفعلية لا الافتراضية.
