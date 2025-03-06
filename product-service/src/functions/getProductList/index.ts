import { APIGatewayProxyHandler } from 'aws-lambda';
import { getProducts } from '../../services/productService';
import { buildResponse } from '../../utils/responseBuilder';
import { ErrorResponse } from '../../types';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('GET /products request:', { event });
  const origin = event.headers?.origin || "";

  try {
    const products = await getProducts();
    return buildResponse(origin, 200, products);
  } catch (error) {
    const response: ErrorResponse = { message: 'Internal server error' };
    return buildResponse(origin, 500, response);
  }
};