import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { OrderType } from '../../types/orders';

export const OrderTypeSelector: React.FC = () => {
    const { t } = useTranslation();
    const { orderType, setOrderType, setPaymentMode, paymentMode, paymentMethod, setPaymentMethod } = usePOS();

    const types: OrderType[] = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
    const methods: Array<'CASH' | 'CARD' | 'TRANSFER'> = ['CASH', 'CARD', 'TRANSFER'];

    const handleTypeChange = (type: OrderType) => {
        setOrderType(type);
        if (type !== 'DELIVERY') {
            setPaymentMode('PAY_NOW');
        }
    };

    return (
        <div className="order-type-selector">
            <label className="order-type-selector__label">{t('pos.orderType.label')}</label>
            <div className="order-type-selector__options">
                {types.map((type) => (
                    <button
                        key={type}
                        type="button"
                        className={`order-type-btn ${orderType === type ? 'active' : ''}`}
                        onClick={() => handleTypeChange(type)}
                    >
                        <span className="order-type-btn__icon">
                            {type === 'DINE_IN' && '🍽️'}
                            {type === 'TAKEAWAY' && '🥡'}
                            {type === 'DELIVERY' && '🚚'}
                        </span>
                        <span className="order-type-btn__text">{t(`pos.orderType.${type}`)}</span>
                    </button>
                ))}
            </div>

            {orderType === 'DELIVERY' && (
                <div className="payment-mode-selector">
                    <label className="payment-mode-selector__label">{t('pos.paymentMode.label')}</label>
                    <div className="payment-mode-selector__options">
                        <button
                            type="button"
                            className={`payment-mode-btn ${paymentMode === 'PAY_NOW' ? 'active' : ''}`}
                            onClick={() => setPaymentMode('PAY_NOW')}
                        >
                            {t('pos.paymentMode.PAY_NOW')}
                        </button>
                        <button
                            type="button"
                            className={`payment-mode-btn ${paymentMode === 'PAY_LATER' ? 'active' : ''}`}
                            onClick={() => setPaymentMode('PAY_LATER')}
                        >
                            {t('pos.paymentMode.PAY_LATER')}
                        </button>
                    </div>
                </div>
            )}

            {paymentMode === 'PAY_NOW' && (
                <div className="payment-mode-selector">
                    <label className="payment-mode-selector__label">{t('pos.paymentMethod.label')}</label>
                    <div className="payment-mode-selector__options">
                        {methods.map((method) => (
                            <button
                                key={method}
                                type="button"
                                className={`payment-mode-btn ${paymentMethod === method ? 'active' : ''}`}
                                onClick={() => setPaymentMethod(method)}
                            >
                                {t(`pos.paymentMethod.${method}`)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
