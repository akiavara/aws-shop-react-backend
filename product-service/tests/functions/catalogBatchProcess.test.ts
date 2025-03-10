import { handler } from '../../src/functions/catalogBatchProcess';
import { DynamoDBDocument, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';

// Mock AWS services
const dynamoDbMock = mockClient(DynamoDBDocument);
const snsMock = mockClient(SNSClient);

// Mock environment variables
process.env.PRODUCTS_TABLE_NAME = 'products-table';
process.env.STOCKS_TABLE_NAME = 'stocks-table';
process.env.CREATE_PRODUCT_TOPIC_ARN = 'test-topic-arn';

describe('catalogBatchProcess', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    dynamoDbMock.reset();
    snsMock.reset();

    // Mock console methods to prevent logging during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  it('should process SQS messages and create products successfully', async () => {
    // Mock successful DynamoDB transaction
    dynamoDbMock.on(TransactWriteCommand).resolves({});
    
    // Mock successful SNS publish
    snsMock.on(PublishCommand).resolves({});

    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product 1',
            description: 'Test Description 1',
            price: 10,
            count: 5
          })
        },
        {
          body: JSON.stringify({
            title: 'Test Product 2',
            description: 'Test Description 2',
            price: 20,
            count: 10
          })
        }
      ]
    };

    const result = await handler(testEvent as any);

    // Verify response
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).productsCreated).toBe(2);

    // Verify DynamoDB calls
    expect(dynamoDbMock.calls()).toHaveLength(2);

    // Verify SNS notification
    expect(snsMock.calls()).toHaveLength(2);
    const snsCall = snsMock.calls()[0];
    const snsParams = (snsCall.args[0] as any).input;
    expect(snsParams.TopicArn).toBe('test-topic-arn');
    const messageContent = JSON.parse(snsParams.Message);
    expect(messageContent.products).toHaveLength(1);
  });

  it('should handle empty SQS event', async () => {
    const testEvent = {
      Records: []
    };

    const result = await handler(testEvent as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).productsCreated).toBe(0);
    expect(snsMock.calls()).toHaveLength(0);
    expect(dynamoDbMock.calls()).toHaveLength(0);
  });

  it('should handle invalid message body', async () => {
    const testEvent = {
      Records: [
        {
          body: 'invalid-json'
        }
      ]
    };

    const promise = handler(testEvent as any);
    await expect(promise).rejects.toThrow('Unexpected token');
  });

  it('should handle DynamoDB error', async () => {
    dynamoDbMock.on(TransactWriteCommand).rejects(new Error('DynamoDB error'));

    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: 10,
            count: 5
          })
        }
      ]
    };

    const promise = handler(testEvent as any);
    await expect(promise).rejects.toThrow('DynamoDB error');
  });

  it('should handle SNS error', async () => {
    dynamoDbMock.on(TransactWriteCommand).resolves({});
    snsMock.on(PublishCommand).rejects(new Error('SNS error'));

    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: 10,
            count: 5
          })
        }
      ]
    };

    const promise = handler(testEvent as any);
    await expect(promise).rejects.toThrow('SNS error');
  });

  it('should validate product message format', async () => {
    dynamoDbMock.on(TransactWriteCommand).resolves({});

    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            // Missing required fields
            title: 'Test Product',
            // description is missing
            price: -1, // invalid price
            count: -5  // invalid count
          })
        }
      ]
    };

    const promise = handler(testEvent as any);
    await expect(promise).rejects.toThrow('Invalid product data');
  });
});

describe('Product validation', () => {
  it('should reject product with missing description', async () => {
    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            price: 10,
            count: 5
            // description is missing
          })
        }
      ]
    };

    await expect(handler(testEvent as any)).rejects.toThrow('description is required');
  });

  it('should reject product with invalid price', async () => {
    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: -10,
            count: 5
          })
        }
      ]
    };

    await expect(handler(testEvent as any)).rejects.toThrow('price must be a positive number');
  });

  it('should reject product with invalid count', async () => {
    const testEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: 10,
            count: -5
          })
        }
      ]
    };

    await expect(handler(testEvent as any)).rejects.toThrow('count must be a non-negative number');
  });
});