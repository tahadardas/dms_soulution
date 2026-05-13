import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/ProductCategoryTabs.css';

type Category = {
    id: number;
    name: string;
    color?: string | null;
};

type ProductCategoryTabsProps = {
    categories: Category[];
    selectedCategoryId: number | null;
    onChange: (id: number | null) => void;
    isLoading?: boolean;
};

export const ProductCategoryTabs: React.FC<ProductCategoryTabsProps> = ({
    categories,
    selectedCategoryId,
    onChange,
    isLoading
}) => {
    const { t } = useTranslation();
    if (isLoading) {
        return <div className="product-category-tabs-loading">{t('pos.categories.loading')}</div>;
    }

    if (!categories || categories.length === 0) {
        return null;
    }

    return (
        <div className="product-category-tabs">
            {categories.map(category => (
                <button
                    key={category.id}
                    className={`category-tab ${selectedCategoryId === category.id ? 'category-tab--active' : ''}`}
                    onClick={() => onChange(category.id)}
                    style={{
                        '--category-color': category.color || 'var(--color-primary)'
                    } as React.CSSProperties}
                >
                    <span className="category-tab__name">{category.name}</span>
                </button>
            ))}
        </div>
    );
};
