import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import * as notifications from 'aws-cdk-lib/aws-s3-notifications';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing S3 bucket (already created)
    const bucket = s3.Bucket.fromBucketName(
      this,
      'ImportBucket',
      'import-service-dev-shop-react'
    );

    // Create Lambda function for generating signed URL
    const importProductsFile = new lambda.Function(this, 'ImportProductsFile', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/importProductsFile')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        BUCKET_REGION: this.region,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    const importFileParser = new lambda.Function(this, 'ImportFileParser', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/importFileParser')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        BUCKET_REGION: this.region,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new notifications.LambdaDestination(importFileParser))

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      description: 'This is the Import Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'OPTIONS', 'PUT'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Create API resources and methods
    const importResource = api.root.addResource('import');

    // Add request parameter for filename
    const requestValidator = new apigateway.RequestValidator(this, 'ImportServiceRequestValidator', {
      restApi: api,
      validateRequestParameters: true,
      validateRequestBody: false,
    });

    // GET /import - Generate Signed URL
    importResource.addMethod('GET',
      new apigateway.LambdaIntegration(importProductsFile), {
        requestParameters: {
          'method.request.querystring.name': true
        },
        requestValidator: requestValidator
      }
    );

    // Grant S3 permissions to Lambda
    bucket.grantReadWrite(importProductsFile);
    bucket.grantReadWrite(importFileParser);

    // Allow lambda to generate presigned URLs
    importProductsFile.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:GetObject',
        ],
        resources: [
          `${bucket.bucketArn}/uploaded/*`
        ],
      })
    );

    importFileParser.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:GetObject',
          's3:DeleteObject',
          's3:CopyObject'
        ],
        resources: [
          `${bucket.bucketArn}/uploaded/*`,
          `${bucket.bucketArn}/parsed/*`
        ],
      })
    );

    // Create CloudFormation output for the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'ImportServiceApiUrl',
    });
  }
}