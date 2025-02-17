import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from '../../src/functions/getProductList';
import * as productService from '../../src/services/productService';
import { Product } from '../../src/types';

// Properly type the mock
jest.mock('../../src/services/productService', () => ({
  getProducts: jest.fn()
}));

describe('getProductList', () => {
  it('should return all products', async () => {
    const mockProducts: Product[] = [
      { id: '1', title: 'Test Product', description: 'Test', price: 100, count: 1 }
    ];
    
    // Correct mock typing
    const mockedGetProducts = productService.getProducts as jest.MockedFunction<typeof productService.getProducts>;
    mockedGetProducts.mockResolvedValue(mockProducts);
    
    // Create mock event and context
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = {} as Context;
    
    const response = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;
    
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(mockProducts);
  });

  it('should handle errors', async () => {
    // Correct mock typing
    const mockedGetProducts = productService.getProducts as jest.MockedFunction<typeof productService.getProducts>;
    mockedGetProducts.mockRejectedValue(new Error('Test error'));
    
    // Create mock event and context
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = {} as Context;
    
    const response = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;
    
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ message: 'Internal server error' });
  });
});
