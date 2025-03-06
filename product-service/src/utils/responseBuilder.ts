import { APIGatewayResponse } from '../types';

const origins = [
  'https://d1ef84ecychojy.cloudfront.net',
  'https://djy4jsds0nb88.cloudfront.net',
  'http://localhost:3000',
  'https://editor.swagger.io',
];

export const buildResponse = (origin: string, statusCode: number, body: unknown): APIGatewayResponse => {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origins.includes(origin) ? origin : '',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
};