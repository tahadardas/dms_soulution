# سياسة إغلاق الجلسة

## الحساب

النقد المتوقع:

```txt
opening_cash + cash_payments - cash_refunds
```

لا تدخل البطاقة أو التحويل في النقد المتوقع.

## الفرق

```txt
cash_difference = closing_cash - expected_cash
```

إذا كان الفرق غير صفر:

- يجب إدخال سبب إذا كانت السياسة مفعلة.
- يحتاج مديراً إذا تجاوز الحد المحدد.

## إعدادات افتراضية

- `requireReasonForCashDifference = true`
- `cashDifferenceRequiresManager = true`
- `managerRequiredCashDifferenceAmount = 25`
- `allowCloseSessionWithPendingDelivery = true`

## Endpoint

```http
POST /pos/sessions/close
```

Payload:

```json
{
  "sessionId": "...",
  "closingCash": 500,
  "reason": "فرق صرف",
  "managerUsername": "manager",
  "managerPassword": "secret"
}
```

## Audit

إغلاق الجلسة يسجل:

- المستخدم.
- الجلسة.
- النقد المتوقع.
- النقد الفعلي.
- الفرق.
- السبب.
- المدير الموافق عند وجوده.
