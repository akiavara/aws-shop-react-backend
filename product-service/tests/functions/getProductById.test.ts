import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from '../../src/functions/getProductById';
import * as productService from '../../src/services/productService';
import { Product } from '../../src/types';
import { createAPIGatewayProxyEvent } from '../utils/mockFactory';

jest.mock('../../src/services/productService', () => ({
  getProductById: jest.fn()
}));

describe('getProductById', () => {
  it('should return product when found', async () => {
    const mockProduct: Product = {
      id: '1',
      title: 'Test Product',
      description: 'Test',
      price: 100,
      count: 1
    };

    const mockedGetProductById = productService.getProductById as jest.MockedFunction<typeof productService.getProductById>;
    mockedGetProductById.mockResolvedValue(mockProduct);

    const mockEvent = createAPIGatewayProxyEvent({ productId: '1' });
    const mockContext = {} as Context;

    const response = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(mockProduct);
  });

  it('should return 404 when product not found', async () => {
    const mockedGetProductById = productService.getProductById as jest.MockedFunction<typeof productService.getProductById>;
    mockedGetProductById.mockRejectedValue(new Error('Product not found'));

    const mockEvent = createAPIGatewayProxyEvent({ productId: 'invalid-id' });
    const mockContext = {} as Context;

    const response = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ message: 'Product not found' });
  });
});