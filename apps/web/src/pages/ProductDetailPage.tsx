import React from 'react';
import { useParams } from 'react-router-dom';
import ProductFormPage from './ProductFormPage';

export const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return <ProductFormPage mode="edit" productId={id} />;
};

export default ProductDetailPage;
