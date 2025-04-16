#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BffServiceStack } from '../lib/bff-service-stack';

const app = new cdk.App();
new BffServiceStack(app, 'BffServiceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});