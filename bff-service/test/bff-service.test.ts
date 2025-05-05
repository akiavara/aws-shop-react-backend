import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BffServiceStack } from '../lib/bff-service-stack';

describe('BFF Service Stack', () => {
  const app = new cdk.App();
  const stack = new BffServiceStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  test('Elastic Beanstalk Application Created', () => {
    template.hasResourceProperties('AWS::ElasticBeanstalk::Application', {
      ApplicationName: 'akiavara-bff-api'
    });
  });

  test('Elastic Beanstalk Environment Created', () => {
    template.hasResourceProperties('AWS::ElasticBeanstalk::Environment', {
      EnvironmentName: 'BffServiceEnvironment',
      SolutionStackName: '64bit Amazon Linux 2 v3.5.9 running Docker'
    });
  });

  test('IAM Role Created', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com'
            }
          }
        ]
      }
    });
  });
});