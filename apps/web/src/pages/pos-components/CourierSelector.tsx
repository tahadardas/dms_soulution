import React, { useState, useEffect, useRef } from 'react';
import { Input, Modal, Button } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { useApi } from '../../hooks/useApi';
import './CourierSelector.css';

export const CourierSelector: React.FC = () => {
    const { t } = useTranslation();
    const { deliveryInfo, setDeliveryInfo } = usePOS();
    const api = useApi();
    
    const [searchQuery, setSearchQuery] = useState(deliveryInfo.personName || '');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showNewCourierModal, setShowNewCourierModal] = useState(false);
    const [newCourierData, setNewCourierData] = useState({ name: '', phone: '' });
    
    const suggestionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchQuery.length >= 2 && !deliveryInfo.courierId) {
            const timeoutId = setTimeout(async () => {
                try {
                    const results = await api<any[]>(`/delivery-couriers/search?q=${searchQuery}`);
                    setSuggestions(results);
                    setShowSuggestions(results.length > 0);
                } catch (err) {
                    console.error('Failed to search couriers', err);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchQuery, api, deliveryInfo.courierId]);

    const handleSelectCourier = (courier: any) => {
        setDeliveryInfo({
            courierId: courier.id,
            personName: courier.name,
            phone: courier.phone,
            courierOneTime: false,
            commissionAmount: undefined, // Will be calculated by backend
            commissionType: courier.commissionType
        });
        setSearchQuery(courier.name);
        setShowSuggestions(false);
    };

    const handleClearCourier = () => {
        setDeliveryInfo({
            courierId: undefined,
            personName: '',
            phone: '',
            courierOneTime: false
        });
        setSearchQuery('');
    };

    const handleInputBlur = () => {
        // Small delay to allow clicking a suggestion
        setTimeout(() => setShowSuggestions(false), 200);
    };

    const handleAddNewCourier = () => {
        setNewCourierData({ name: searchQuery, phone: deliveryInfo.phone || '' });
        setShowNewCourierModal(true);
    };

    const confirmNewCourier = async (savePermanently: boolean) => {
        if (savePermanently) {
            try {
                const saved = await api<any>('/delivery-couriers', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: newCourierData.name,
                        phone: newCourierData.phone,
                        commissionEnabled: false,
                        commissionType: 'NONE',
                        commissionValue: 0
                    })
                });
                handleSelectCourier(saved);
            } catch (err: any) {
                alert(err.message || 'Failed to save courier');
                return;
            }
        } else {
            setDeliveryInfo({
                courierId: undefined,
                personName: newCourierData.name,
                phone: newCourierData.phone,
                courierOneTime: true
            });
            setSearchQuery(newCourierData.name);
        }
        setShowNewCourierModal(false);
    };

    return (
        <div className="courier-selector">
            <div className="courier-selector__input-wrapper">
                <Input
                    label={t('pos.delivery.courier')}
                    placeholder={t('pos.delivery.searchCourier')}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (deliveryInfo.courierId) {
                            setDeliveryInfo({ courierId: undefined });
                        }
                        setDeliveryInfo({ personName: e.target.value });
                    }}
                    onBlur={handleInputBlur}
                    onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                />
                {deliveryInfo.courierId && (
                    <button 
                        className="courier-selector__clear" 
                        onClick={handleClearCourier}
                        style={{ position: 'absolute', right: '10px', top: '35px', zIndex: 10 }}
                    >
                        ×
                    </button>
                )}
                
                {showSuggestions && (
                    <div className="courier-selector__suggestions" ref={suggestionsRef}>
                        {suggestions.map(c => (
                            <div 
                                key={c.id} 
                                className="courier-selector__suggestion-item"
                                onClick={() => handleSelectCourier(c)}
                            >
                                <span className="courier-selector__suggestion-name">{c.name}</span>
                                <span className="courier-selector__suggestion-phone">{c.phone}</span>
                            </div>
                        ))}
                        <div 
                            className="courier-selector__suggestion-item courier-selector__suggestion-add"
                            onClick={handleAddNewCourier}
                        >
                            + {t('pos.delivery.addNewCourier')} "{searchQuery}"
                        </div>
                    </div>
                )}
            </div>

            <div className="courier-selector__phone">
                <Input
                    label={t('pos.delivery.phone')}
                    placeholder={t('pos.delivery.phonePlaceholder')}
                    value={deliveryInfo.phone || ''}
                    onChange={(e) => setDeliveryInfo({ phone: e.target.value })}
                    disabled={!!deliveryInfo.courierId && !deliveryInfo.courierOneTime}
                />
            </div>

            <Modal
                isOpen={showNewCourierModal}
                onClose={() => setShowNewCourierModal(false)}
                title={t('pos.delivery.newCourierTitle')}
            >
                <div className="courier-modal">
                    <p>{t('pos.delivery.newCourierConfirm', { name: newCourierData.name })}</p>
                    <div className="courier-modal__inputs">
                        <Input 
                            label={t('pos.delivery.personName')}
                            value={newCourierData.name}
                            onChange={e => setNewCourierData(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input 
                            label={t('pos.delivery.phone')}
                            value={newCourierData.phone}
                            onChange={e => setNewCourierData(prev => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>
                    <div className="courier-modal__actions">
                        <Button 
                            variant="secondary" 
                            onClick={() => confirmNewCourier(false)}
                        >
                            {t('pos.delivery.useOnce')}
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => confirmNewCourier(true)}
                        >
                            {t('pos.delivery.savePermanently')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
