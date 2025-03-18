import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import * as notifications from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Duration } from "aws-cdk-lib";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing S3 bucket (already created)
    const bucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "import-service-dev-shop-react"
    );

    // Create Lambda function for generating signed URL
    const importProductsFile = new lambda.Function(this, "ImportProductsFile", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/importProductsFile")
      ),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        BUCKET_REGION: this.region,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });

    // Get reference to the ImportCatalogItemsQueue SQS queue so the importFileParser
    // can use it
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "ImportCatalogItemsQueue",
      `arn:aws:sqs:${this.region}:${this.account}:CatalogItemsQueue`
    );

    const importFileParser = new lambda.Function(this, "ImportFileParser", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/importFileParser")
      ),
      timeout: Duration.seconds(30),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        BUCKET_REGION: this.region,
        NODE_OPTIONS: "--enable-source-maps",
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
    });

    // Grant send message permissions to the Lambda
    catalogItemsQueue.grantSendMessages(importFileParser);

    // Each time the bucket has a new object, importFileParser is notified
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new notifications.LambdaDestination(importFileParser),
      {
        prefix: "uploaded/",
        suffix: ".csv",
      }
    );

    // Get reference to the existing authorizer lambda
    const authorizerLambda = lambda.Function.fromFunctionArn(
      this,
      "BasicAuthorizerLambda",
      `arn:aws:lambda:${this.region}:${this.account}:function:basicAuthorizer`
    );

    // Create the Lambda authorizer
    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "ImportApiAuthorizer",
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

    const originsAllowed = [
      "http://localhost:3000",
      "https://d4hva5vucegt5.cloudfront.net",
      "https://editor.swagger.io"
    ];

    const headersAllowed = [
      "Content-Type",
      "X-Amz-Date",
      "Authorization",
      "X-Api-Key",
      "X-Amz-Security-Token",
      "X-Amz-User-Agent",
    ];

    const methodsAllowed = ["GET", "OPTIONS", "PUT"];

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service",
      description: "This is the Import Service API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: originsAllowed,
        allowMethods: methodsAllowed,
        allowHeaders: headersAllowed,
        allowCredentials: true,
        maxAge: cdk.Duration.days(1),
      },
    });

    // Create API resources and methods
    const importResource = api.root.addResource("import");

    // Add request parameter for filename
    const requestValidator = new apigateway.RequestValidator(
      this,
      "ImportServiceRequestValidator",
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

    // GET /import - Generate Signed URL
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFile),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
        requestValidator: requestValidator,
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        methodResponses: [methodResponse, errorResponse],
      }
    );

    // Grant S3 permissions to Lambda
    bucket.grantReadWrite(importProductsFile);
    bucket.grantReadWrite(importFileParser);

    // Allow lambda to generate presigned URLs
    importProductsFile.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [`${bucket.bucketArn}/uploaded/*`],
      })
    );

    importFileParser.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:CopyObject",
        ],
        resources: [
          `${bucket.bucketArn}/uploaded/*`,
          `${bucket.bucketArn}/parsed/*`,
        ],
      })
    );

    // Create CloudFormation output for the API URL
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
      exportName: "ImportServiceApiUrl",
    });
  }
}
