import { APIGatewayProxyHandler } from 'aws-lambda';
import { getProductById } from '../../services/productService';
import { buildResponse } from '../../utils/responseBuilder';
import { ErrorResponse } from '../../types';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('GET /products/{productId} request:', { event, productId: event.pathParameters?.productId });
  const origin = event.headers?.origin || "";

  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      const response: ErrorResponse = { message: 'Product ID is required' };
      return buildResponse(origin, 400, response);
    }

    const product = await getProductById(productId);
    return buildResponse(origin, 200, product);
  } catch (error) {
    if (error instanceof Error && error.message === 'Product not found') {
      const response: ErrorResponse = { message: 'Product not found' };
      return buildResponse(origin, 404, response);
    }
    const response: ErrorResponse = { message: 'Internal server error' };
    return buildResponse(origin, 500, response);
  }
};