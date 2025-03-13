import { handler } from '../src/importProductsFile';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      // Mock implementation
    })),
    PutObjectCommand: jest.fn().mockImplementation((params) => {
      return { params };
    })
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: jest.fn().mockResolvedValue('https://mocked-signed-url.example.com')
  };
});

describe('importProductsFile Lambda', () => {
  // Save original environment variables
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Setup environment variables for testing
    process.env.BUCKET_NAME = 'XXXXXXXXXXX';
    process.env.BUCKET_REGION = 'eu-west-3';
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should return a signed URL when given a valid file name', async () => {
    // Create mock APIGatewayProxyEvent
    const event = {
      queryStringParameters: {
        name: 'test-file.csv'
      }
    } as any;

    const result = await handler(event);
    
    // Verify S3Client was instantiated with correct region
    expect(S3Client).toHaveBeenCalledWith({ region: 'eu-west-3' });
    
    // Verify PutObjectCommand was called with correct parameters
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'XXXXXXXXXXX',
      Key: 'uploaded/test-file.csv',
      ContentType: 'text/csv'
    });
    
    // Verify getSignedUrl was called with correct parameters
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object), // S3Client instance
      expect.any(Object), // PutObjectCommand instance
      { expiresIn: 3600 }
    );
    
    // Verify response
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('https://mocked-signed-url.example.com');
    expect(result.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    });
  });

  it('should return 400 error when file name is missing', async () => {
    // Create mock APIGatewayProxyEvent without name parameter
    const event = {
      queryStringParameters: {}
    } as any;

    const result = await handler(event);
    
    // Verify S3Client was not called
    expect(S3Client).not.toHaveBeenCalled();
    
    // Verify response
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ 
      error: 'Missing required query parameter: name' 
    });
  });

  it('should return 500 error when BUCKET_NAME is not configured', async () => {
    // Remove BUCKET_NAME from environment
    delete process.env.BUCKET_NAME;
    
    const event = {
      queryStringParameters: {
        name: 'test-file.csv'
      }
    } as any;

    const result = await handler(event);
    
    // Verify S3Client was not called
    expect(S3Client).not.toHaveBeenCalled();
    
    // Verify response
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ 
      error: 'Bucket name is not configured' 
    });
  });

  it('should return 500 error when getSignedUrl throws an error', async () => {
    // Mock getSignedUrl to reject with an error
    const mockedError = new Error('S3 error');
    (getSignedUrl as jest.Mock).mockRejectedValueOnce(mockedError);
    
    // Spy on console.error to prevent it from actually logging during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const event = {
      queryStringParameters: {
        name: 'test-file.csv'
      }
    } as any;

    const result = await handler(event);
    
    // Verify console.error was called with the expected error
    expect(console.error).toHaveBeenCalledWith('Error generating signed URL:', mockedError);
    
    // Verify response
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ 
      error: 'Error generating signed URL',
      details: 'S3 error'
    });
    
    // Restore console.error
    (console.error as jest.Mock).mockRestore();
  });

  it('should use default region if BUCKET_REGION is not specified', async () => {
    // Remove BUCKET_REGION from environment
    delete process.env.BUCKET_REGION;
    
    const event = {
      queryStringParameters: {
        name: 'test-file.csv'
      }
    } as any;

    await handler(event);
    
    // Verify S3Client was instantiated with default region
    expect(S3Client).toHaveBeenCalledWith({ region: 'eu-west-3' });
  });
});