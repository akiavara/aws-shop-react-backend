import { APIGatewayProxyResult, S3Event } from "aws-lambda";
import { S3, S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQS } from '@aws-sdk/client-sqs';
const csv = require('csv-parser');
const { Readable } = require('stream');

const s3 = new S3();
const sqs = new SQS();

interface ProductRecord {
  title: string;
  description: string;
  price: number;
  count: number;
}

export const handler = async (event: S3Event): Promise<APIGatewayProxyResult> => {
  console.log('importFileParser lambda invoked with event:', JSON.stringify(event));

  const toProcess = event.Records.filter(record => record.s3.object.key.startsWith('uploaded/') && record.s3.object.key.endsWith('.csv'));

  try {
    for (const record of toProcess) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing file ${key} from bucket ${bucket}`);

      // Get the file from S3
      const s3Object = await s3.getObject({
        Bucket: bucket,
        Key: key,
      });

      // Process the CSV file
      const records: ProductRecord[] = await new Promise((resolve, reject) => {
        const results: ProductRecord[] = [];

        if (!s3Object.Body) {
          reject(new Error('Empty file'));
          return;
        }

        const readableStream = Readable.from(s3Object.Body as any);

        readableStream
          .pipe(csv())
          .on('data', (data: ProductRecord) => {
            // Validate and transform the data
            const product = {
              title: data.title,
              description: data.description,
              price: Number(data.price),
              count: Number(data.count),
            };
            results.push(product);
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', (error: any) => {
            reject(error);
          });
      });

      // Send records to SQS
      await Promise.all(
        records.map(async (record) => {
          try {
            await sqs.sendMessage({
              QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL!,
              MessageBody: JSON.stringify(record),
              MessageGroupId: 'product-import-group', // Same group ID for all messages
            });
            console.log('Successfully sent message to SQS:', record);
          } catch (error) {
            console.error('Error sending message to SQS:', error);
            throw error;
          }
        })
      );

      // Move the processed file to the 'parsed' folder
      const newKey = key.replace('uploaded', 'parsed');
      await s3.copyObject({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: newKey,
      });

      await s3.deleteObject({
        Bucket: bucket,
        Key: key,
      });

      console.log(`File ${key} has been processed and moved to ${newKey}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Files processed successfully',
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'An error occured while parsing file',
      }),
    };
  }
};