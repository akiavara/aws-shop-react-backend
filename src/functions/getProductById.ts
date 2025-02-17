import { APIGatewayProxyHandler } from 'aws-lambda';
import { getProductById } from '../services/productService';
import { buildResponse } from '../utils/responseBuilder';
import { ErrorResponse } from '../types';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      const response: ErrorResponse = { message: 'Product ID is required' };
      return buildResponse(400, response);
    }

    const product = await getProductById(productId);
    return buildResponse(200, product);
  } catch (error) {
    if (error instanceof Error && error.message === 'Product not found') {
      const response: ErrorResponse = { message: 'Product not found' };
      return buildResponse(404, response);
    }
    const response: ErrorResponse = { message: 'Internal server error' };
    return buildResponse(500, response);
  }
};
