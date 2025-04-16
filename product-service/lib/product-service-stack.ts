import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createDatabaseTables } from './database-tables';
import { Duration } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

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
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/src/functions/createProduct')),
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
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/src/functions/getProductList')),
      environment: tableEnvironment,
    });

    // Grant permissions to access DynamoDB tables
    productsTable.grantReadData(getProductList);
    stocksTable.grantReadData(getProductList);

    const getProductById = new lambda.Function(this, 'GetProductById', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/src/functions/getProductById')),
      environment: tableEnvironment,
    });

    // Grant permissions to access DynamoDB tables
    productsTable.grantReadData(getProductById);
    stocksTable.grantReadData(getProductById);

    // Get reference to the existing authorizer lambda
    const authorizerLambda = lambda.Function.fromFunctionArn(
      this,
      "BasicAuthorizerLambda",
      `arn:aws:lambda:${this.region}:${this.account}:function:basicAuthorizer`
    );

    // Create the Lambda authorizer
    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "PostApiAuthorizer",
      {
        handler: authorizerLambda,
        identitySource: apigateway.IdentitySource.header("Authorization"),
        resultsCacheTtl: cdk.Duration.seconds(0), // Set to 0 for testing, adjust for production
      }
    );

    // Grant the API Gateway permission to invoke the authorizer
    authorizerLambda.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    const methodsAllowed = ["GET", "POST", "OPTIONS"];

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'This is the Products Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: methodsAllowed,
        allowHeaders: ['*'],
        allowCredentials: true,
      },
    });

    // Create API resources and methods
    const productsResource = api.root.addResource('products');

    // Add request parameter for filename
    const requestValidator = new apigateway.RequestValidator(
      this,
      "CreateProductRequestValidator",
      {
        restApi: api,
        validateRequestParameters: true,
        validateRequestBody: false,
      }
    );

    // Create method response with CORS headers
    const methodResponse: apigateway.MethodResponse = {
      statusCode: "200",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Origin": true,
        "method.response.header.Access-Control-Allow-Headers": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Credentials": true,
      },
    };

    // Create error response with CORS headers
    const errorResponse: apigateway.MethodResponse = {
      statusCode: "403",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Origin": true,
        "method.response.header.Access-Control-Allow-Headers": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Credentials": true,
      },
    };

    // POST /products - Create Product
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProduct),
    {
      requestValidator: requestValidator,
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      methodResponses: [methodResponse, errorResponse],
    });

    // GET /products - Get Product List
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductList));

    // GET /products/{productId} - Get Product by ID
    const productResource = productsResource.addResource('{productId}');
    productResource.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    // Create SQS Queue
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'CatalogItemsQueue',
      visibilityTimeout: Duration.seconds(30),
    });

    // Create the catalogBatchProcess Lambda
    const catalogBatchProcess = new lambda.Function(this, 'catalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/src/functions/catalogBatchProcess')),
      timeout: Duration.seconds(20),
      environment: tableEnvironment,
    });

    // Add SQS as event source for the Lambda
    catalogBatchProcess.addEventSource(new SqsEventSource(catalogItemsQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(60), // Wait up to 60 seconds to gather messages
      enabled: true,
    }));

    // Grant permissions for the Lambda to read from SQS
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcess);

    productsTable.grantWriteData(catalogBatchProcess);
    stocksTable.grantWriteData(catalogBatchProcess);

    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      displayName: 'Create Product Topic'
    });

    // Email subscription for expensive products (price >= 100)
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('thibault_desmoulins+expensive@epam.com', {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 100,
          }),
        },
        json: true, // Receive the full JSON message
      })
    );

    // Email subscription for low stock products (count <= 10)
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('thibault_desmoulins+low-stock@epam.com', {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({
            lessThanOrEqualTo: 10,
          }),
        },
        json: true,
      })
    );

    // Email subscription for high-priority products
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('thibault_desmoulins+high-priority@epam.com', {
        filterPolicy: {
          priority: sns.SubscriptionFilter.stringFilter({
            matchPrefixes: ['HIGH-'],
          }),
        },
        json: true,
      })
    );

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('thibault_desmoulins@epam.com')
    );

    // Grant permission to Lambda to publish to SNS
    createProductTopic.grantPublish(catalogBatchProcess);

    // Add SNS topic ARN to Lambda environment variables
    catalogBatchProcess.addEnvironment(
      'CREATE_PRODUCT_TOPIC_ARN',
      createProductTopic.topicArn
    );

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
