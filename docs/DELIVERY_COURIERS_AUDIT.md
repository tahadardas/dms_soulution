# DELIVERY COURIERS AUDIT - DMS SOULUTION

## 1. Current Delivery Entry in POS
Currently, delivery data is entered through the `DeliveryPanel` component in the POS interface.
When the user selects `OrderType.DELIVERY`, the `DeliveryPanel` is displayed (likely inside a drawer or a specific section of the POS).
It allows entering:
- **Person Name** (Text Input)
- **Phone** (Text Input)
- **Address** (Text Input)
- **Notes** (Text Input)

## 2. Existing Delivery Fields
In the `orders` table, the following fields already exist:
- `delivery_person_name`: Stores the name of the person/courier (currently just text).
- `delivery_phone`: Stores the phone number.
- `delivery_address`: Stores the address.
- `delivery_notes`: Stores delivery-specific notes.

## 3. Storage in `orders` Table
Data is saved in the `orders` table via the `submitOrder` method in `POSService`.
The fields are mapped as follows:
- `deliveryPersonName` -> `delivery_person_name`
- `deliveryPhone` -> `delivery_phone`
- `deliveryAddress` -> `delivery_address`
- `deliveryNotes` -> `delivery_notes`

## 4. Current Couriers Table
**Does NOT exist.** There is no dedicated table for couriers. They are currently treated as simple text metadata on each order.

## 5. Pending Delivery Orders
Pending deliveries are displayed via `PendingDeliveryDrawer.tsx` in the frontend.
The backend has an endpoint `GET /pos/orders/pending-delivery` which calls `service.listPendingDeliveryOrders()`.
An order is considered "Pending Delivery" if:
- `status` = 'PENDING_DELIVERY'
- `payment_status` = 'UNPAID'

## 6. Delivery Collection
Delivery orders are collected (collected) via the `collectDeliveryOrder` method in `POSService`.
This:
- Updates `status` to 'COMPLETED'.
- Updates `payment_status` to 'PAID'.
- Updates `delivery_status` to 'DELIVERED'.
- Records a payment of type `DELIVERY_COLLECTION`.
- Creates an accounting entry (debiting Cash/Bank and crediting Sales).

## 7. Current Delivery Reports
The current reporting system (e.g., `ReportsSessionsZPage.tsx`) likely includes delivery totals as part of the session stats or general sales reports, but there is no specific "Courier Report".

## 8. Files to be Modified
### Backend (apps/api):
- `src/db/migrations/`: New migration for `delivery_couriers` and updating `orders`.
- `src/services/deliveryCourier.service.ts`: **New Service.**
- `src/services/pos.service.ts`: Update `submitOrder` and `collectDeliveryOrder` to link couriers and calculate commissions.
- `src/routes/pos.routes.ts`: Add new routes for couriers.
- `src/config/permissions.ts`: Add new permissions.

### Frontend (apps/web):
- `src/context/POSContext.tsx`: Update state to include courier ID and handle courier logic.
- `src/pages/pos-components/DeliveryPanel.tsx`: Implement autocomplete and courier selection.
- `src/pages/DeliveryCouriersPage.tsx`: **New Dashboard Page.**
- `src/pages/CourierDetailsPage.tsx`: **New Details Page.**
- `src/types/orders.ts`: Update types.

## 9. Required Tables
- `delivery_couriers`: To store courier profiles, contact info, and commission settings.

## 10. Potential Risks
- **Data Migration**: Existing orders with text names won't automatically link to new courier records.
- **Breaking POS Flow**: Adding a Dialog for saving couriers might slow down fast-paced operations if not implemented smoothly.
- **Accounting Complexity**: Commission logic needs to be carefully handled to avoid phantom expenses in the ledger until they are actually paid.
- **Concurrency**: Multiple stations adding the same courier simultaneously.
