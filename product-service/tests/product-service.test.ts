import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ProductServiceStack } from '../lib/product-service-stack';

describe('ProductServiceStack', () => {
  const app = new cdk.App();
  const stack = new ProductServiceStack(app, 'TestProductServiceStack');
  const template = Template.fromStack(stack);

  test('Should create two Lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 2);
  });

  test('Should create API Gateway REST API', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  test('Should create API Gateway resources', () => {
    template.resourceCountIs('AWS::ApiGateway::Resource', 2); // One for /products and one for /products/{productId}
  });

  test('Should create API Gateway methods', () => {
    template.resourceCountIs('AWS::ApiGateway::Method', 2); // GET methods for both endpoints
  });

  test('Lambda functions should have correct properties', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
    });
  });

  test('Lambda functions should have proper IAM roles', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            }
          }
        ]
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition'
              },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ]
          ]
        }
      ]
    });
  });

  test('API Gateway should have deployment and stage', () => {
    template.resourceCountIs('AWS::ApiGateway::Deployment', 1);
    template.resourceCountIs('AWS::ApiGateway::Stage', 1);
  });

  test('Should have correct resource path for product by ID', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{productId}'
    });
  });

  test('Should have correct resource path for products list', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'products'
    });
  });
});
