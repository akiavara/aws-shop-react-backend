import { Product } from '../types';

export const products: Product[] = [
  {
    id: '1',
    title: 'iPhone 13',
    description: 'Latest iPhone model',
    price: 999,
    count: 10
  },
  {
    id: '2',
    title: 'MacBook Pro',
    description: 'Powerful laptop for professionals',
    price: 1999,
    count: 5
  }
];

export const getProducts = async (): Promise<Product[]> => {
  return products;
};

export const getProductById = async (productId: string): Promise<Product> => {
  const product = products.find(p => p.id === productId);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};