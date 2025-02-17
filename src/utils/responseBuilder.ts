import { APIGatewayResponse } from '../types';

export const buildResponse = (statusCode: number, body: unknown): APIGatewayResponse => {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
};
