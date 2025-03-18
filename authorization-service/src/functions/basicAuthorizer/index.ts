import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerHandler,
} from "aws-lambda";

const generatePolicy = (
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
};

export const handler: APIGatewayTokenAuthorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("Event: ", JSON.stringify(event));

  const authorizationHeader = event.authorizationToken;

  // Check if Authorization header is present
  if (!authorizationHeader) {
    return generatePolicy('user', 'Deny', event.methodArn);
  }

  // Check if it's a Basic auth token
  if (!authorizationHeader.startsWith("Basic ")) {
    return generatePolicy('user', 'Deny', event.methodArn);
  }

  // Remove 'Basic ' and decode
  const token = authorizationHeader.replace("Basic ", "");
  const buffer = Buffer.from(token, "base64");
  const credentials = buffer.toString("utf-8");

  // Get stored credentials from environment
  const storedCredentials = process.env.CREDENTIALS || "";
  const credentialsMap = new Map(
    storedCredentials.split(",").map((cred) => {
      const [username, password] = cred.split("=");
      return [username, password];
    })
  );

  // Split provided credentials
  const [username, password] = credentials.split(":");

  // Verify credentials
  const storedPassword = credentialsMap.get(username);

  if (!storedPassword || storedPassword !== password) {
    return generatePolicy('user', 'Deny', event.methodArn);
  }

  // Generate policy for successful authentication
  return generatePolicy(username, "Allow", event.methodArn);
};
