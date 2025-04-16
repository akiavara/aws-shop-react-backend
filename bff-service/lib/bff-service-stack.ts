import * as cdk from 'aws-cdk-lib';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';

dotenv.config();

export class BffServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket for the application version
    const bucket = new s3.Bucket(this, 'BffApiBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy the Dockerrun.aws.json to S3
    const deployment = new s3deploy.BucketDeployment(
      this,
      'CartApiBucketDeployment',
      {
        sources: [s3deploy.Source.asset('./docker-deploy')],
        destinationBucket: bucket,
      },
    );

    // Create an Elastic Beanstalk application
    const appName = 'BffElasticBeanstalkApp';
    const ebApp = new elasticbeanstalk.CfnApplication(
      this,
      'BffElasticBeanstalkApp',
      {
        applicationName: appName,
      },
    );

    // Create EC2 instance profile role
    const ec2Role = new iam.Role(this, 'BffEC2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSElasticBeanstalkWebTier',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSElasticBeanstalkMulticontainerDocker',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSElasticBeanstalkWorkerTier',
        ),
      ],
    });

    // Create instance profile
    const instanceProfile = new iam.CfnInstanceProfile(
      this,
      'BffEC2InstanceProfile',
      {
        roles: [ec2Role.roleName],
      },
    );

    // Add IAM role for Elastic Beanstalk service
    const ebServiceRole = new iam.Role(this, 'BffElasticBeanstalkServiceRole', {
      assumedBy: new iam.ServicePrincipal('elasticbeanstalk.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSElasticBeanstalkEnhancedHealth',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSElasticBeanstalkService',
        ),
      ],
    });

    // Create an application version
    const appVersionProps = new elasticbeanstalk.CfnApplicationVersion(
      this,
      'BffAppVersion',
      {
        applicationName: appName,
        sourceBundle: {
          s3Bucket: bucket.bucketName,
          s3Key: 'Dockerrun.aws.json',
        },
      },
    );
    appVersionProps.addDependsOn(ebApp);
    appVersionProps.node.addDependency(deployment);

    // Create an Elastic Beanstalk environment
    const ebEnv = new elasticbeanstalk.CfnEnvironment(
      this,
      'BffElasticBeanstalkEnv',
      {
        environmentName: 'bff-prod',
        applicationName: appName,
        solutionStackName: '64bit Amazon Linux 2 v4.1.0 running Docker',
        versionLabel: appVersionProps.ref,
        optionSettings: [
          {
            namespace: 'aws:autoscaling:launchconfiguration',
            optionName: 'IamInstanceProfile',
            value: instanceProfile.ref,
          },
          {
            namespace: 'aws:elasticbeanstalk:environment',
            optionName: 'ServiceRole',
            value: ebServiceRole.roleName,
          },
          {
            namespace: 'aws:autoscaling:launchconfiguration',
            optionName: 'InstanceType',
            value: 't2.micro',
          },
          {
            namespace: 'aws:elasticbeanstalk:environment',
            optionName: 'EnvironmentType',
            value: 'SingleInstance',
          },
          {
            namespace: 'aws:elbv2:listener:443',
            optionName: 'Protocol',
            value: 'HTTPS',
          },
          {
            namespace: 'aws:elasticbeanstalk:environment:process:default',
            optionName: 'Port',
            value: '80',
          },
          {
            namespace: 'aws:elasticbeanstalk:environment:process:default',
            optionName: 'Protocol',
            value: 'HTTP',
          },
          {
            namespace: 'aws:elasticbeanstalk:docker',
            optionName: 'LoggingDriver',
            value: 'json-file',
          },
          {
            namespace: 'aws:elasticbeanstalk:environment:proxy',
            optionName: 'ProxyServer',
            value: 'nginx',
          },
        ],
      },
    );

    // Force PascalCase for OptionSettings using addPropertyOverride
    ebEnv.addPropertyOverride('OptionSettings', [
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'NODE_ENV',
        Value: 'production',
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'DOCKER_IMAGE',
        Value: 'akiavara/bff-aws:latest',
      },
      {
        Namespace: 'aws:autoscaling:launchconfiguration',
        OptionName: 'IamInstanceProfile',
        Value: instanceProfile.ref,
      },
      {
        Namespace: 'aws:autoscaling:launchconfiguration',
        OptionName: 'InstanceType',
        Value: 't2.micro',
      },
      {
        Namespace: 'aws:elasticbeanstalk:environment',
        OptionName: 'EnvironmentType',
        Value: 'SingleInstance',
      },
      {
        Namespace: 'aws:elasticbeanstalk:environment',
        OptionName: 'ServiceRole',
        Value: ebServiceRole.roleName,
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'PORT',
        Value: process.env.PORT || '',
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'CART_SERVICE_URL',
        Value: process.env.CART_SERVICE_URL || '',
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'PROFILE_SERVICE_URL',
        Value: process.env.PROFILE_SERVICE_URL || '',
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'PRODUCTS_SERVICE_URL',
        Value: process.env.PRODUCTS_SERVICE_URL || '',
      },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'IMPORT_SERVICE_URL',
        Value: process.env.IMPORT_SERVICE_URL || '',
      },
    ]);
  }
}