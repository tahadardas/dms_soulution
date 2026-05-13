import React from 'react';
import { Input } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { CourierSelector } from './CourierSelector';

export const DeliveryPanel: React.FC = () => {
    const { t } = useTranslation();
    const { deliveryInfo, setDeliveryInfo } = usePOS();

    return (
        <div className="delivery-panel">
            <h3 className="delivery-panel__title">{t('pos.delivery.title')}</h3>
            <div className="delivery-panel__section">
                <CourierSelector />
            </div>
            <div className="delivery-panel__grid">
            <Input
                label={t('pos.delivery.address')}
                placeholder={t('pos.delivery.addressPlaceholder')}
                value={deliveryInfo.address || ''}
                onChange={(e) => setDeliveryInfo({ address: e.target.value })}
            />
            <Input
                label={t('pos.delivery.notes')}
                placeholder={t('pos.delivery.notesPlaceholder')}
                value={deliveryInfo.notes || ''}
                onChange={(e) => setDeliveryInfo({ notes: e.target.value })}
            />
            </div>
        </div>
    );
};
