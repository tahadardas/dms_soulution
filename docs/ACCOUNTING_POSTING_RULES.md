# قواعد الترحيل المحاسبي

## أنواع المصدر

القيم المعتمدة تشمل:

- `POS_SALES`
- `POS_RETURNS`
- `POS_DELIVERY_COLLECTION`
- `INVENTORY`
- `PURCHASE_INVOICE`
- `SALES_INVOICE`
- `MANUAL`
- `SYSTEM`
- `REVERSAL`

## البيع الفوري

```txt
Debit  Cash/Bank
Credit Sales Revenue
Debit  COGS
Credit Inventory
```

## الخصم

إذا وجد خصم:

```txt
Debit  Discounts
Credit Sales Revenue is posted on gross line total
```

## رسوم الخدمة

```txt
Credit Service Charge Revenue/Liability حسب إعداد الحساب
```

## الدليفري المؤجل

عند إنشاء الطلب:

```txt
Debit  COGS
Credit Inventory
```

عند التحصيل:

```txt
Debit  Cash/Bank
Credit Sales Revenue
```

## المرتجع

ينشئ قيداً عكسياً للإيراد والدفع والمخزون حسب كمية المرتجع.

## الإلغاء

لا يحذف القيود. يستخدم `reverseEntry` لإنشاء قيود عكسية مرتبطة بالقيد الأصلي.
