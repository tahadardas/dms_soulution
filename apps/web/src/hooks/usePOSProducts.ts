import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from './useApi';

export const usePOSProducts = (branchId: number) => {
    const api = useApi();
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                api<any[]>(`/pos/products?branch_id=${branchId}`),
                api<any[]>('/pos/categories')
            ]);
            setProducts(prodRes);
            setCategories(catRes);
        } catch (err) {
            console.error('Failed to load POS products', err);
        } finally {
            setLoading(false);
        }
    }, [api, branchId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId;
            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.barcode && p.barcode.includes(searchQuery));
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategoryId, searchQuery]);

    return {
        products: filteredProducts,
        allProducts: products,
        categories,
        loading,
        selectedCategoryId,
        setSelectedCategoryId,
        searchQuery,
        setSearchQuery,
        refresh: loadData
    };
};
