import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Product, Stock } from '../../types';
import { PRODUCTS_TABLE_NAME, STOCKS_TABLE_NAME } from '../../../lib/constants';
import { buildResponse } from '../../utils/responseBuilder';

const dynamodb = new DynamoDB.DocumentClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('POST /products request:', { event, body: event.body ? JSON.parse(event.body) : null });
  const origin = event.headers?.origin || "";

  try {
    if (!event.body) {
      return buildResponse(origin, 400, { message: 'Missing request body' });
    }

    const { title, description, price, count } = JSON.parse(event.body);

    if (!title || !description || !price || count === undefined) {
      return buildResponse(origin, 400, { message: 'Missing required fields' });
    }

    const productId = uuidv4();
    const product: Product = {
      id: productId,
      title,
      description,
      price
    };

    const stock: Stock = {
      product_id: productId,
      count
    };

    await dynamodb.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: PRODUCTS_TABLE_NAME,
            Item: product
          }
        },
        {
          Put: {
            TableName: STOCKS_TABLE_NAME,
            Item: stock
          }
        }
      ]
    }).promise();

    return buildResponse(origin, 201, { ...product, count });
  } catch (error) {
    console.error('Error creating product:', error);
    return buildResponse(origin, 500, { message: 'Internal server error' });
  }
};