import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Product, Stock } from '../../types';
import { PRODUCTS_TABLE_NAME, STOCKS_TABLE_NAME } from '../../../lib/constants';
import { buildResponse } from '../../utils/responseBuilder';

const dynamodb = DynamoDBDocument.from(new DynamoDB());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('POST /products request:', { event, body: event.body ? JSON.parse(event.body) : null });
  const origin = event.headers.origin || event.headers.Origin || "*"; // Get the Origin header

  // Handle OPTIONS requests (preflight)
  if (event.httpMethod === "OPTIONS") {
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    }

    console.log(
      "createProduct headers returned in OPTIONS call:",
      JSON.stringify(headers)
    );

    return {
      statusCode: 200,
      headers: headers,
      body: "",
    };
  }

  try {
    if (!event.body) {
      return buildResponse(origin, 400, { message: 'Missing request body' });
    }

    const { title, description, price, count } = JSON.parse(event.body);

    if (!title || !description || !price || count === undefined) {
      return buildResponse(origin, 400, { message: 'Missing required fields' });
    }

    if (price < 0 || count < 0) {
      return buildResponse(origin, 400, { message: 'Price and count must be non-negative values' });
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
    });

    return buildResponse(origin, 201, { ...product, count });
  } catch (error) {
    console.error('Error creating product:', error);
    return buildResponse(origin, 500, { message: 'Internal server error' });
  }
};