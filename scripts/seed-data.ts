import * as cdk from 'aws-cdk-lib';
import { CloudFormation } from '@aws-sdk/client-cloudformation';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { PRODUCT_SERVICE_STACK_NAME, PRODUCTS_TABLE_NAME, STOCKS_TABLE_NAME } from '../product-service/lib/constants';
import { Product } from '../product-service/src/types';

const app = new cdk.App();

// Sample data
export const products: Product[] = [
  {
    id: '1',
    title: 'iPhone 13',
    description: 'Latest iPhone model',
    price: 999
  },
  {
    id: '2',
    title: 'MacBook Pro',
    description: 'Powerful laptop for professionals',
    price: 1999
  },
  {
    id: uuidv4().toString(),
    title: 'Laptop Pro X1',
    description: 'High-performance laptop with 16GB RAM',
    price: 1299
  },
  {
    id: uuidv4().toString(),
    title: 'Wireless Mouse M1',
    description: 'Ergonomic wireless mouse with long battery life',
    price: 49
  },
  {
    id: uuidv4().toString(),
    title: 'Gaming Keyboard K1',
    description: 'Mechanical gaming keyboard with RGB lighting',
    price: 159
  }
];

async function getTableNames() {
  const cloudformation = new CloudFormation({
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-3'
  });

  try {
    const { Stacks } = await cloudformation.describeStacks({
      StackName: PRODUCT_SERVICE_STACK_NAME
    });

    if (!Stacks || Stacks.length === 0) {
      throw new Error(`Stack ${PRODUCT_SERVICE_STACK_NAME} not found`);
    }

    const outputs = Stacks[0].Outputs || [];
    const productsTableName = outputs.find(o => o.ExportName === 'ProductsTableName')?.OutputValue;
    const stocksTableName = outputs.find(o => o.ExportName === 'StocksTableName')?.OutputValue;

    if (!productsTableName || !stocksTableName) {
      throw new Error('Table names not found in stack outputs');
    }

    return { productsTableName, stocksTableName };
  } catch (error) {
    console.error('Error getting table names:', error);
    throw error;
  }
}

const stocks = products.map(product => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 100) + 1
}));

async function seedData() {
  const dynamodb = DynamoDBDocument.from(new DynamoDB({
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-3'
  }));

  const { productsTableName, stocksTableName } = await getTableNames();

  console.log('Starting data seed...');

  // Import products
  for (const product of products) {
    try {
      await dynamodb.put({
        TableName: productsTableName,
        Item: product
      });
      console.log(`Imported product: ${product.title}`);
    } catch (error) {
      console.error(`Failed to import product ${product.title}:`, error);
    }
  }

  // Import stocks
  for (const stock of stocks) {
    try {
      await dynamodb.put({
        TableName: stocksTableName,
        Item: stock
      });
      console.log(`Imported stock for product: ${stock.product_id}`);
    } catch (error) {
      console.error(`Failed to import stock for product ${stock.product_id}:`, error);
    }
  }

  console.log('Seed completed!');
}

// Only run if this is called directly
if (require.main === module) {
  seedData().catch(console.error);
}
