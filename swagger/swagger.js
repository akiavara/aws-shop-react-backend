// this file was generated by serverless-auto-swagger
            module.exports = {
  "swagger": "2.0",
  "info": {
    "title": "Products API",
    "version": "1"
  },
  "paths": {
    "/products": {
      "get": {
        "summary": "getProductList",
        "description": "",
        "operationId": "getProductList.get./products",
        "consumes": [
          "application/json"
        ],
        "produces": [
          "application/json"
        ],
        "parameters": [],
        "responses": {
          "200": {
            "description": "200 response"
          }
        }
      }
    },
    "/products/{productId}": {
      "get": {
        "summary": "getProductById",
        "description": "",
        "operationId": "getProductById.get./products/{productId}",
        "consumes": [
          "application/json"
        ],
        "produces": [
          "application/json"
        ],
        "parameters": [
          {
            "name": "productId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responses": {
          "200": {
            "description": "200 response"
          }
        }
      }
    }
  },
  "definitions": {},
  "securityDefinitions": {},
  "basePath": "/dev"
};