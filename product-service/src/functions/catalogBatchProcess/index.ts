import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = DynamoDBDocument.from(new DynamoDB());
const sns = new SNSClient();

// Message format definition
interface ProductMessage {
  title: string;
  description: string;
  price: number;
  count: number;
}

export const handler = async (event: SQSEvent) => {
  console.log('SQS event in catalogBatchProcess:', JSON.stringify(event));

  let createdProducts: ProductMessage[] = [];

  try {
    await Promise.all(
      event.Records.map(async (record: SQSRecord) => {
        const messageBody: ProductMessage = JSON.parse(record.body);
        console.log('Processing message:', messageBody);

        // Process the message and store product
        await processMessage(messageBody);

        // Collect the created product
        createdProducts.push(messageBody);
      })
    );

    // Send only one SNS notification for all products
    if (createdProducts.length > 0) {
      /*const snsParams = {
        Message: JSON.stringify({
          message: `${createdProducts.length} products were created successfully`,
          products: createdProducts
        }),
        Subject: 'New Products Created',
        TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN
      };

      await sns.send(new PublishCommand(snsParams));*/

      await sendSnsNotification(createdProducts);
      console.log(`SNS notification sent for ${createdProducts.length} products`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Messages processed successfully',
        productsCreated: createdProducts.length
      })
    };
  } catch (error) {
    console.error('Error processing messages:', error);
    throw error;
  }
};

async function processMessage(message: ProductMessage): Promise<void> {
  try {
    console.log('Processing product:', message);

    // Validate the message before processing
    validateProductMessage(message);

    const productId = uuidv4();

    await dynamodb.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: process.env.PRODUCTS_TABLE_NAME!,
            Item: {
              id: productId,
              title: message.title,
              description: message.description,
              price: message.price
            }
          }
        },
        {
          Put: {
            TableName: process.env.STOCKS_TABLE_NAME!,
            Item: {
              product_id: productId,
              count: message.count
            }
          }
        }
      ]
    });
  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
}

async function sendSnsNotification(products: ProductMessage[]) {
  const snsMessages = products.map(product => ({
    // Original message content
    message: `Product ${product.title} was created successfully`,
    products: [product],

    // Add message attributes for filtering
    MessageAttributes: {
      price: {
        DataType: 'Number',
        StringValue: product.price.toString(),
      },
      count: {
        DataType: 'Number',
        StringValue: product.count.toString(),
      },
      priority: {
        DataType: 'String',
        StringValue: product.count <= 10 ? 'HIGH-PRIORITY' : 'NORMAL',
      },
      inStock: {
        DataType: 'String',
        StringValue: product.count > 0 ? 'true' : 'false',
      },
    },
  }));

  for (const message of snsMessages) {
    const snsParams = {
      Message: JSON.stringify(message),
      Subject: 'New Product Created',
      TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN,
      MessageAttributes: message.MessageAttributes,
    };

    await sns.send(new PublishCommand(snsParams));
  }
}

function validateProductMessage(message: ProductMessage): void {
  if (!message.title || typeof message.title !== 'string' || message.title.trim().length === 0) {
    throw new Error('Invalid product data: title is required');
  }

  if (!message.description || typeof message.description !== 'string' || message.description.trim().length === 0) {
    throw new Error('Invalid product data: description is required');
  }

  if (typeof message.price !== 'number' || message.price <= 0) {
    throw new Error('Invalid product data: price must be a positive number');
  }

  if (typeof message.count !== 'number' || message.count < 0) {
    throw new Error('Invalid product data: count must be a non-negative number');
  }
}