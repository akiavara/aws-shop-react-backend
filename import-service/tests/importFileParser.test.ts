import { handler } from '../src/importFileParser';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { sdkStreamMixin } from '@smithy/util-stream';
import 'aws-sdk-client-mock-jest';
import { Readable } from 'stream';

const s3Mock = mockClient(S3Client);

describe('importFileParser lambda', () => {
  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();
  });

  it('should handle non-CSV files', async () => {
    const mockEvent = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'uploaded/test-file.txt' }
        }
      }]
    };

    const consoleSpy = jest.spyOn(console, 'log');
    const result = await handler(mockEvent as any);

    expect(s3Mock).not.toHaveReceivedCommand(GetObjectCommand);
    expect(consoleSpy).toHaveBeenCalledWith('importFileParser lambda invoked with event:', JSON.stringify(mockEvent));
    expect(result.statusCode).toBe(200);
  });

  it('should successfully process a CSV file', async () => {
    const mockEvent = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'uploaded/test-file.csv' }
        }
      }]
    };

    const mockStream = new Readable();
    mockStream.push('{"title":"Test Product","price":10}\n');
    mockStream.push(null);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(mockStream)
    });

    const consoleSpy = jest.spyOn(console, 'log');
    const result = await handler(mockEvent as any);

    expect(s3Mock).toHaveReceivedCommand(GetObjectCommand);
    expect(consoleSpy).toHaveBeenCalledWith('Processing file uploaded/test-file.csv from bucket test-bucket');
    expect(result.statusCode).toBe(200);
  });

  it('should handle empty S3 event records', async () => {
    const mockEvent = { Records: [] };
    
    const consoleSpy = jest.spyOn(console, 'log');
    const result = await handler(mockEvent as any);

    expect(s3Mock).not.toHaveReceivedCommand(GetObjectCommand);
    expect(consoleSpy).toHaveBeenCalledWith('importFileParser lambda invoked with event:', JSON.stringify(mockEvent));
    expect(result.statusCode).toBe(200);
  });

  it('should handle S3 errors', async () => {
    const mockEvent = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'uploaded/test-file.csv' }
        }
      }]
    };

    s3Mock.on(GetObjectCommand).rejects(new Error('S3 Error'));

    const result = await handler(mockEvent as any);

    expect(s3Mock).toHaveReceivedCommand(GetObjectCommand);
    expect(result.statusCode).toBe(500);
  });

  it('should handle file movement after processing', async () => {
    const mockEvent = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'uploaded/test-file.csv' }
        }
      }]
    };

    const mockStream = new Readable();
    mockStream.push('{"title":"Test Product","price":10}\n');
    mockStream.push(null);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(mockStream)
    });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const consoleSpy = jest.spyOn(console, 'log');
    await handler(mockEvent as any);

    expect(s3Mock).toHaveReceivedCommand(CopyObjectCommand);
    expect(s3Mock).toHaveReceivedCommand(DeleteObjectCommand);
    expect(consoleSpy).toHaveBeenCalledWith('File uploaded/test-file.csv has been processed and moved to parsed/test-file.csv');
  });

  it('should handle malformed CSV data', async () => {
    const mockEvent = {
      Records: [{
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'uploaded/test-file.csv' }
        }
      }]
    };

    const mockStream = new Readable();
    mockStream.push('invalid,csv,data\n');
    mockStream.push(null);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(mockStream)
    });

    const consoleSpy = jest.spyOn(console, 'log');
    const result = await handler(mockEvent as any);

    // Instead of checking for specific console output, verify the expected calls were made
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'importFileParser lambda invoked with event:', JSON.stringify(mockEvent));
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Processing file uploaded/test-file.csv from bucket test-bucket');
    expect(consoleSpy).toHaveBeenNthCalledWith(3, 'File uploaded/test-file.csv has been processed and moved to parsed/test-file.csv');

    expect(s3Mock).toHaveReceivedCommand(GetObjectCommand);
    expect(result.statusCode).toBe(200);
  });
});
