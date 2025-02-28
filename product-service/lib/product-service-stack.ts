import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda functions
    const getProductList = new lambda.Function(this, 'GetProductList', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/getProductList')),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    const getProductById = new lambda.Function(this, 'GetProductById', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/getProductById')),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'This is the Products Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: undefined, // Remove default CORS configuration
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

    // Create API resources and methods with proxy integration
    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(getProductList));

    const product = products.addResource('{productId}');
    product.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}
