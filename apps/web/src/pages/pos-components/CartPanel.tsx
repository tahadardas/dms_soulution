import React, { useState } from 'react';
import { Button, Input } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { usePOS, CartItem } from '../../context/POSContext';
import { useCurrencyFormatter } from '../../hooks/useCurrencyFormatter';
import PermissionGate from '../../components/PermissionGate';
import { PERMISSIONS } from '../../lib/permissions';
import { OrderTypeSelector } from './OrderTypeSelector';
import { DeliveryPanel } from './DeliveryPanel';
import { CustomerSelector } from './CustomerSelector';
import { useApi } from '../../hooks/useApi';

interface CartPanelProps {
    onEditItemNote: (item: CartItem) => void;
    isSubmitting: boolean;
    onSubmit?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
    onEditItemNote,
    isSubmitting,
    onSubmit
}) => {
    const { t } = useTranslation();
    const { 
        cart, notes, removeFromCart, updateQuantity, addNote, removeNote, 
        activeTable, setTable, orderType, submitOrder,
        discount, setDiscount, serviceCharge, setServiceCharge, tipsAmount, setTipsAmount,
        paymentMethod, setPaymentMethod, customerId
    } = usePOS();
    const { formatCurrency } = useCurrencyFormatter();
    const [noteInput, setNoteInput] = useState('');
    const [posSettings, setPosSettings] = useState<any>({});
    const api = useApi();

    React.useEffect(() => {
        let mounted = true;
        api<any>('/settings/pos')
            .then(data => { if (mounted && data) setPosSettings(data); })
            .catch(() => {});
        return () => { mounted = false; };
    }, [api]);

    const totalItems = cart.reduce((sum: number, item: CartItem) => sum + item.quantity * item.price, 0);
    
    let actualDiscount = 0;
    if (discount.amount) {
        actualDiscount = discount.type === 'PERCENTAGE' ? totalItems * (discount.amount / 100) : discount.amount;
        if (actualDiscount > totalItems) actualDiscount = totalItems;
    }
    const finalTotal = totalItems - actualDiscount + (serviceCharge || 0) + (tipsAmount || 0);

    const handleAddNote = () => {
        if (!noteInput.trim()) return;
        addNote(noteInput.trim());
        setNoteInput('');
    };

    const handleDiscountChange = (value: string) => {
        const amount = parseFloat(value) || 0;
        let finalAmount = amount;
        if (posSettings.allowDiscounts) {
            if (discount.type === 'PERCENTAGE' && posSettings.maxDiscountPercentage) {
                if (finalAmount > posSettings.maxDiscountPercentage) {
                    finalAmount = posSettings.maxDiscountPercentage;
                }
            }
            setDiscount(finalAmount, discount.type);
        }
    };

    return (
        <div className="pos-cart">
            <div className="pos-cart__header">
                <div>
                    <h2 className="pos-cart__title">{t('pos.currentOrder')}</h2>
                    <p className="pos-cart__subtitle">{t('pos.itemsCount', { count: cart.length })}</p>
                </div>
            </div>

            <div className="pos-cart__content">
                <div className="pos-cart__list">
                    {cart.length === 0 ? (
                        <div className="pos-empty">{t('pos.selectItems')}</div>
                    ) : (
                        cart.map((item: CartItem) => (
                            <div key={item.id} className="pos-cart-item">
                                <div className="pos-cart-item__details">
                                    <div className="pos-cart-item__name">{item.name}</div>
                                    <div className="pos-cart-item__meta">
                                        {formatCurrency(item.price)}
                                    </div>
                                    {item.note && (
                                        <div className="pos-cart-item__note">
                                            <span className="pos-cart-item__note-icon">📝</span>
                                            {item.note}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="pos-cart-item__actions">
                                    <div className="pos-quantity-controls">
                                        <button 
                                            className="pos-qty-btn" 
                                            onClick={() => updateQuantity(item.id, -1)}
                                            title={t('pos.quantity.decrease')}
                                        >
                                            -
                                        </button>
                                        <span className="pos-qty-value">{item.quantity}</span>
                                        <button 
                                            className="pos-qty-btn" 
                                            onClick={() => updateQuantity(item.id, 1)}
                                            title={t('pos.quantity.increase')}
                                        >
                                            +
                                        </button>
                                    </div>

                                    <span className="pos-cart-item__total">
                                        {formatCurrency(item.quantity * item.price)}
                                    </span>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEditItemNote(item)}
                                        title={t('pos.lineNote')}
                                    >
                                        📝
                                    </Button>
                                    
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromCart(item.id)}
                                    >
                                        {t('pos.remove')}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="pos-cart__options">
                    <CustomerSelector />
                    <OrderTypeSelector />
                    {orderType === 'DELIVERY' && <DeliveryPanel />}
                </div>

                <div className="pos-cart__payments" style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#64748b' }}>
                        {t('pos.paymentMethod', 'Payment Method')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <Button 
                            variant={paymentMethod === 'CASH' ? 'primary' : 'secondary'} 
                            size="sm"
                            onClick={() => setPaymentMethod('CASH')}
                        >
                            💵 {t('pos.payments.cash', 'Cash')}
                        </Button>
                        <Button 
                            variant={paymentMethod === 'CARD' ? 'primary' : 'secondary'} 
                            size="sm"
                            onClick={() => setPaymentMethod('CARD')}
                        >
                            💳 {t('pos.payments.card', 'Card')}
                        </Button>
                        <Button 
                            variant={paymentMethod === 'TRANSFER' ? 'primary' : 'secondary'} 
                            size="sm"
                            onClick={() => setPaymentMethod('TRANSFER')}
                        >
                            🏦 {t('pos.payments.transfer', 'Transfer')}
                        </Button>
                        {customerId && (
                            <Button 
                                variant={paymentMethod === 'CREDIT' ? 'primary' : 'secondary'} 
                                size="sm"
                                onClick={() => setPaymentMethod('CREDIT')}
                            >
                                📝 {t('pos.payments.credit', 'On Account')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="pos-cart__notes">
                    <Input
                        label={t('pos.orderNotes')}
                        placeholder={t('pos.orderNotesPlaceholder')}
                        value={noteInput}
                        onChange={(event) => setNoteInput(event.target.value)}
                    />
                    <div className="pos-note-actions">
                        <Button variant="secondary" size="sm" onClick={handleAddNote}>
                            {t('pos.addNote')}
                        </Button>
                    </div>
                    {notes.length > 0 && (
                        <div className="pos-note-list">
                            {notes.map((note: string, index: number) => (
                                <div key={`${note}-${index}`} className="pos-note">
                                    <span>{note}</span>
                                    <button className="pos-note-remove" onClick={() => removeNote(index)}>
                                        {t('pos.remove')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {(posSettings.enableTables || orderType === 'DINE_IN') && (
                    <div className="pos-cart__table">
                        <Input
                            label={t('pos.tableTicket')}
                            placeholder={t('common.optional')}
                            value={activeTable || ''}
                            onChange={(event) => setTable(event.target.value)}
                        />
                    </div>
                )}

                {posSettings.allowDiscounts && cart.length > 0 && (
                    <div className="pos-cart__discount" style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <Input
                                    label={t('pos.discount')}
                                    type="number"
                                    min={0}
                                    max={discount.type === 'PERCENTAGE' && posSettings.maxDiscountPercentage ? posSettings.maxDiscountPercentage : undefined}
                                    value={discount.amount || ''}
                                    onChange={(e) => handleDiscountChange(e.target.value)}
                                />
                            </div>
                            <Button 
                                variant={discount.type === 'PERCENTAGE' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setDiscount(discount.amount, 'PERCENTAGE')}
                            >
                                %
                            </Button>
                            <Button 
                                variant={discount.type === 'FIXED' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setDiscount(discount.amount, 'FIXED')}
                            >
                                $
                            </Button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', marginBottom: '1rem' }}>
                    {posSettings.enableServiceCharge && (
                        <div style={{ flex: 1 }}>
                            <Input
                                label={t('pos.serviceCharge') || 'Service'}
                                type="number"
                                min={0}
                                value={serviceCharge || ''}
                                onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    )}
                    {posSettings.enableTips && (
                        <div style={{ flex: 1 }}>
                            <Input
                                label={t('pos.tips') || 'Tips'}
                                type="number"
                                min={0}
                                value={tipsAmount || ''}
                                onChange={(e) => setTipsAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="pos-cart__summary">
                {actualDiscount > 0 && (
                    <div className="pos-cart__subtotal-row" style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <span>{t('pos.subtotal')}</span>
                        <span>{formatCurrency(totalItems)}</span>
                    </div>
                )}
                {actualDiscount > 0 && (
                    <div className="pos-cart__discount-row" style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <span>{t('pos.discount')}</span>
                        <span>-{formatCurrency(actualDiscount)}</span>
                    </div>
                )}
                {serviceCharge > 0 && (
                    <div className="pos-cart__extra-row" style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <span>{t('pos.serviceCharge') || 'Service'}</span>
                        <span>{formatCurrency(serviceCharge)}</span>
                    </div>
                )}
                {tipsAmount > 0 && (
                    <div className="pos-cart__extra-row" style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <span>{t('pos.tips') || 'Tips'}</span>
                        <span>{formatCurrency(tipsAmount)}</span>
                    </div>
                )}
                <div className="pos-cart__total-row">
                    <span>{t('common.total')}</span>
                    <span className="pos-cart__total">{formatCurrency(finalTotal)}</span>
                </div>
                
                <PermissionGate
                    perm={PERMISSIONS.POS_SALE}
                    tooltip={t('errors.pos.noSubmitPermission')}
                >
                    <Button
                        variant="success"
                        size="lg"
                        className="pos-submit"
                        disabled={cart.length === 0}
                        isLoading={isSubmitting}
                        onClick={onSubmit || submitOrder}
                    >
                        {paymentMethod === 'CREDIT' 
                            ? t('pos.submitCreditOrder', 'Submit as Credit')
                            : orderType === 'DELIVERY' 
                                ? t('pos.toolbar.saveDelivery') 
                                : t('pos.submitOrder')}
                    </Button>
                </PermissionGate>
            </div>
        </div>
    );
};
