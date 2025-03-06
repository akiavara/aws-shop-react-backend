import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { PRODUCTS_TABLE_NAME, STOCKS_TABLE_NAME } from './constants';

export function createDatabaseTables(stack: cdk.Stack) {
  // Create Products table
  const productsTable = new dynamodb.Table(stack, PRODUCTS_TABLE_NAME, {
    partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
  });

  // Create Stocks table
  const stocksTable = new dynamodb.Table(stack, STOCKS_TABLE_NAME, {
    partitionKey: { name: 'product_id', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
  });

  return {
    productsTable,
    stocksTable
  };
}