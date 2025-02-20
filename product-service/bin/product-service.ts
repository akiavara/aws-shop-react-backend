#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductServiceStack } from '../lib/product-service-stack';
import { PRODUCT_SERVICE_STACK_NAME } from '../lib/constants';

const app = new cdk.App();
new ProductServiceStack(app, PRODUCT_SERVICE_STACK_NAME, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});
