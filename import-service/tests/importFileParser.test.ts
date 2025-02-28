import { handler } from '../src/importFileParser';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { sdkStreamMixin } from '@smithy/util-stream';
import 'aws-sdk-client-mock-jest';
import { Readable } from 'stream';

// Explicitly extend Jest types with aws-sdk-client-mock matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveReceivedCommand(command: any): R;
      toHaveReceivedCommandWith(command: any, params: any): R;
      toHaveReceivedCommandTimes(command: any, times: number): R;
    }
  }
}

// Mock dependencies
jest.mock('csv-parser', () => {
  return jest.fn().mockImplementation(() => {
    const Transform = require('stream').Transform;
    const parser = new Transform({
      objectMode: true,
      transform(chunk: any, encoding: any, callback: any) {
        // Mock parsing CSV - convert string to object
        try {
          const row = JSON.parse(chunk.toString());
          this.push(row);
          callback();
        } catch (e) {
          callback(null, { mocked: 'data' });
        }
      }
    });
    return parser;
  });
});

// Mock S3 client
const s3Mock = mockClient(S3Client);

describe('importFileParser lambda', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    s3Mock.reset();
    jest.clearAllMocks();
  });

  /*it('should process CSV file from S3 event', async () => {
    // Create a test CSV content
    const csvContent = 'id,title,description,price\n1,Product 1,Description 1,100\n2,Product 2,Description 2,200';

    // Mock the S3 response with proper SDK stream mixin
    const mockStream = sdkStreamMixin(Readable.from([csvContent]));
    mockStream.transformToString = jest.fn().mockResolvedValue(csvContent);

    s3Mock.on(GetObjectCommand).resolves({
      Body: mockStream
    });

    // Create a mock S3 event
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'test-bucket'
            },
            object: {
              key: 'uploaded/test-file.csv'
            }
          }
        }
      ]
    };

    // Call the handler
    const result = await handler(mockEvent as any);

    // Verify S3 client was called with correct parameters
    expect(s3Mock).toHaveReceivedCommand(GetObjectCommand);
    expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
      Bucket: 'XXXXXXXXXXX',
      Key: 'uploaded/test-file.csv'
    });
    
    // Verify response
    expect(result).toEqual({
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Missing required query parameter: name' }),
    });
  });*/

  it('should handle non-CSV files', async () => {
    // Create a mock S3 event with non-CSV file
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'test-bucket'
            },
            object: {
              key: 'uploaded/test-file.txt'
            }
          }
        }
      ]
    };

    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log');

    // Call the handler
    const result = await handler(mockEvent as any);

    // Verify S3 client was NOT called since it's not a CSV
    expect(s3Mock).not.toHaveReceivedCommand(GetObjectCommand);
    
    // Verify log was called with not a CSV file message
    expect(consoleSpy).toHaveBeenCalledWith('Not a CSV file:', 'uploaded/test-file.txt');
    
    // Verify response
    expect(result).toEqual({
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Missing required query parameter: name' }),
    });
  });

  /*it('should handle errors when processing CSV files', async () => {
    // Mock S3 client to throw an error
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 error'));

    // Create a mock S3 event
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'test-bucket'
            },
            object: {
              key: 'uploaded/test-file.csv'
            }
          }
        }
      ]
    };

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error');

    // Call the handler
    const result = await handler(mockEvent as any);

    // Verify S3 client was called
    expect(s3Mock).toHaveReceivedCommand(GetObjectCommand);
    expect(s3Mock).toHaveReceivedCommandWith(GetObjectCommand, {
      Bucket: 'XXXXXXXXXXX',
      Key: 'uploaded/test-file.csv'
    });

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing CSV file:', expect.any(Error));
    
    // Verify response
    expect(result).toEqual({
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Missing required query parameter: name' }),
    });
  });*/
});