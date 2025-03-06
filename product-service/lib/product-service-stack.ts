import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createDatabaseTables } from './database-tables';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB tables
    const { productsTable, stocksTable } = createDatabaseTables(this);

    // Export the table names as CloudFormation outputs
    new cdk.CfnOutput(this, 'ProductsTableName', {
      value: productsTable.tableName,
      exportName: 'ProductsTableName',
    });

    new cdk.CfnOutput(this, 'StocksTableName', {
      value: stocksTable.tableName,
      exportName: 'StocksTableName',
    });

    // Add table names to Lambda environment variables
    const tableEnvironment = {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
      STOCKS_TABLE_NAME: stocksTable.tableName,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // Create Lambda function
    const createProduct = new lambda.Function(this, 'CreateProduct', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/createProduct')),
      environment: tableEnvironment,
    });

    // Grant DynamoDB permissions with comprehensive TransactWrite support
    const dynamoDbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:TransactWriteItems',
        'dynamodb:TransactGetItems'
      ],
      resources: [
        productsTable.tableArn,
        stocksTable.tableArn,
        `${productsTable.tableArn}/index/*`,
        `${stocksTable.tableArn}/index/*`
      ]
    });
    createProduct.addToRolePolicy(dynamoDbPolicy);

    // Add environment variables for table names
    createProduct.addEnvironment('PRODUCTS_TABLE_NAME', productsTable.tableName);
    createProduct.addEnvironment('STOCKS_TABLE_NAME', stocksTable.tableName);

    const getProductList = new lambda.Function(this, 'GetProductList', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/getProductList')),
      environment: tableEnvironment,
    });

    // Grant permissions to access DynamoDB tables
    productsTable.grantReadData(getProductList);
    stocksTable.grantReadData(getProductList);

    const getProductById = new lambda.Function(this, 'GetProductById', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/getProductById')),
      environment: tableEnvironment,
    });

    // Grant permissions to access DynamoDB tables
    productsTable.grantReadData(getProductById);
    stocksTable.grantReadData(getProductById);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'This is the Products Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Create API resources and methods
    const productsResource = api.root.addResource('products');

    // POST /products - Create Product
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProduct));

    // GET /products - Get Product List
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductList));

    // GET /products/{productId} - Get Product by ID
    const productResource = productsResource.addResource('{productId}');
    productResource.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    // Create CloudFormation output for the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'ProductServiceApiUrl',
    });

    // Load and parse Swagger/OpenAPI documentation
    const swaggerFile = fs.readFileSync(path.join(__dirname, '../swagger.yaml'), 'utf8');
    const swaggerDoc = yaml.load(swaggerFile);

    // Create documentation part
    new apigateway.CfnDocumentationPart(this, 'ApiDocumentation', {
      location: {
        type: 'API'
      },
      properties: JSON.stringify(swaggerDoc),
      restApiId: api.restApiId
    });

    // Create documentation version
    new apigateway.CfnDocumentationVersion(this, 'ApiDocumentationVersion', {
      documentationVersion: '1.0.0',
      restApiId: api.restApiId,
      description: 'Initial version of the Products API documentation'
    });
  }
}
