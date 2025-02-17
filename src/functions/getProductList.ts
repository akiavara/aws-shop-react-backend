import { APIGatewayProxyHandler } from 'aws-lambda';
import { getProducts } from '../services/productService';
import { buildResponse } from '../utils/responseBuilder';
import { ErrorResponse } from '../types';

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const products = await getProducts();
    return buildResponse(200, products);
  } catch (error) {
    const response: ErrorResponse = { message: 'Internal server error' };
    return buildResponse(500, response);
  }
};
