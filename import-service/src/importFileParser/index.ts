import { APIGatewayProxyResult, S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
const csv = require('csv-parser');
const { Readable } = require('stream');

export const handler = async (event: S3Event): Promise<APIGatewayProxyResult> => {
  console.log('importFileParser lambda invoked with event:', JSON.stringify(event));

  const region = process.env.BUCKET_REGION || 'eu-west-3';
  const toProcess = event.Records.filter(record => record.s3.object.key.startsWith('uploaded/'));

  // Process files sequentially with Promise.all
  await Promise.all(toProcess.map(async (record) => {
    const s3 = new S3Client({ region });
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    // Check if the file is a CSV
    if (!key.endsWith('.csv')) {
      console.log('Not a CSV file:', key);
      return;
    }

    console.log('Files to process:', key);

    try {
      // Get the object from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3.send(getObjectCommand);

      // Read the stream - use type assertion for Body or check if it's defined
      const stream = response.Body;

      if (!stream) {
        console.error('Failed to get file stream');
        return;
      }

      // Parse CSV using csv-parser library
      const results: any[] = [];

      // Get string content from stream
      const str = await stream.transformToString();

      // Create a readable stream from the string content
      const readableStream = Readable.from([str]);

      // Create a promise to handle the csv-parser processing
      await new Promise((resolve, reject) => {
        readableStream
          .pipe(csv())
          .on('data', (data: any) => {
            console.log('Parsed CSV row:', data);
            results.push(data);
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', (error: Error) => {
            console.error('Error parsing CSV:', error);
            reject(error);
          });
      });

      console.log(`Successfully parsed ${results.length} records from CSV file`);
    } catch (error) {
      console.error('Error processing CSV file:', error);
    }

    try {
      const newKey = key.replace('uploaded/', 'parsed/');

      const copyObjectCommand = new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: newKey,
      });

      await s3.send(copyObjectCommand);

      console.log(`File copied successfully to ${newKey}`);
    } catch (err) {
      console.error('Error copying file:', err);
    }

    try {
      const deleteObjectCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await s3.send(deleteObjectCommand);

      console.log(`File deleted successfully from ${key}`);
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  }));

  return {
    statusCode: 400,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ error: 'Missing required query parameter: name' }),
  };
};