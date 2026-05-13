import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { useApi } from '../../hooks/useApi';
import './CustomerSelector.css';

export const CustomerSelector: React.FC = () => {
    const { t } = useTranslation();
    const { customerId, setCustomerId } = usePOS();
    const api = useApi();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Load initial customer if customerId exists
    useEffect(() => {
        if (customerId && !selectedCustomer) {
            api<any>(`/customers/${customerId}`)
                .then(data => {
                    setSelectedCustomer(data);
                    setSearchQuery(data.name);
                })
                .catch(err => console.error('Failed to load customer', err));
        } else if (!customerId) {
            setSelectedCustomer(null);
            setSearchQuery('');
        }
    }, [customerId, api, selectedCustomer]);

    useEffect(() => {
        if (searchQuery.length >= 2 && (!selectedCustomer || searchQuery !== selectedCustomer.name)) {
            const timeoutId = setTimeout(async () => {
                setLoading(true);
                try {
                    const results = await api<{ items: any[] }>(`/customers?search=${encodeURIComponent(searchQuery)}&pageSize=5`);
                    setSuggestions(results.items || []);
                    setShowSuggestions((results.items || []).length > 0);
                } catch (err) {
                    console.error('Failed to search customers', err);
                } finally {
                    setLoading(false);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchQuery, api, selectedCustomer]);

    const handleSelectCustomer = (customer: any) => {
        setCustomerId(customer.id);
        setSelectedCustomer(customer);
        setSearchQuery(customer.name);
        setShowSuggestions(false);
    };

    const handleClearCustomer = () => {
        setCustomerId(null);
        setSelectedCustomer(null);
        setSearchQuery('');
    };

    const handleInputBlur = () => {
        // Small delay to allow clicking a suggestion
        setTimeout(() => setShowSuggestions(false), 200);
    };

    return (
        <div className="pos-customer-selector">
            <div className="pos-customer-selector__input-wrapper">
                <Input
                    label={t('pos.customerSelection', 'Select Customer')}
                    placeholder={t('pos.customerSearchPlaceholder', 'Search by name or phone...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={handleInputBlur}
                    onFocus={() => searchQuery.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                />
                {selectedCustomer && (
                    <button className="pos-customer-selector__clear" onClick={handleClearCustomer} title={t('common.clear')}>
                        ✕
                    </button>
                )}
                {loading && <div className="pos-customer-selector__spinner" />}
            </div>

            {showSuggestions && (
                <div className="pos-customer-selector__suggestions" ref={suggestionsRef}>
                    {suggestions.map((customer) => (
                        <div 
                            key={customer.id} 
                            className="pos-customer-selector__suggestion-item"
                            onClick={() => handleSelectCustomer(customer)}
                        >
                            <div className="pos-customer-suggestion-name">{customer.name}</div>
                            {customer.phone && <div className="pos-customer-suggestion-phone">{customer.phone}</div>}
                        </div>
                    ))}
                </div>
            )}
            
            {selectedCustomer && (
                <div className="pos-customer-selected-info">
                    <span className="pos-customer-tag">
                        👤 {selectedCustomer.name}
                    </span>
                    {selectedCustomer.receivable_account_id && (
                        <span className="pos-customer-account-tag" title={t('customers.accountLinked')}>
                            ✅ {t('customers.accountLinked', 'Account Linked')}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
