export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers: {
    [key: string]: string | boolean;
  };
  body: string;
}

export interface ErrorResponse {
  message: string;
}