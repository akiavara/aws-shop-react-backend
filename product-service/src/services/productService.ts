import { PRODUCTS_TABLE_NAME, STOCKS_TABLE_NAME } from '../../lib/constants';
import { Product, ProductWithStock, Stock } from '../types';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

const dynamoDb = DynamoDBDocument.from(new DynamoDB());

export const getProducts = async (): Promise<ProductWithStock[]> => {
  try {
    // Get all products
    const productsResult = await dynamoDb.scan({
      TableName: PRODUCTS_TABLE_NAME
    });

    // Get all stocks
    const stocksResult = await dynamoDb.scan({
      TableName: STOCKS_TABLE_NAME
    });

    const products = productsResult.Items as Product[];
    const stocks = stocksResult.Items as Stock[];

    // Create a map of product_id to count for faster lookup
    const stocksMap = stocks.reduce((acc, stock) => {
      acc[stock.product_id] = stock.count;
      return acc;
    }, {} as { [key: string]: number });

    // Combine products with their stock counts
    return products.map((product) => ({
      ...product,
      count: stocksMap[product.id] || 0,
    }));
  } catch (error) {
    console.error('Error fetching products with stock:', error);
    throw error;
  }
};

export const getProductById = async (productId: string): Promise<ProductWithStock> => {
  try {
    // Get product
    const productResult = await dynamoDb.get({
      TableName: PRODUCTS_TABLE_NAME,
      Key: {
        id: productId
      }
    });

    if (!productResult.Item) {
      throw new Error('Product not found');
    }

    // Get stock
    const stockResult = await dynamoDb.get({
      TableName: STOCKS_TABLE_NAME,
      Key: {
        product_id: productId
      }
    });

    const product = productResult.Item as Product;
    const stock = stockResult.Item as Stock;

    // Combine product with its stock count
    return {
      ...product,
      count: stock?.count || 0,
    };
  } catch (error) {
    console.error('Error fetching product with stock:', error);
    throw error;
  }
};
