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

  try {
    const authorizationHeader = event.authorizationToken;
    console.log("1 - authorizationHeader: ", authorizationHeader);

    // Check if Authorization header is present
    if (!authorizationHeader) {
      throw new Error("Unauthorized: No Authorization header");
    }

    console.log("2 - authorizationHeader ok");

    // Check if it's a Basic auth token
    if (!authorizationHeader.startsWith("Basic ")) {
      throw new Error("Unauthorized: Invalid Authorization header format");
    }

    console.log("2 - authorizationHeader starts with Basic ok");

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

    console.log("3 - verify storedPassword", storedPassword);

    if (!storedPassword || storedPassword !== password) {
      throw new Error("Forbidden: Invalid credentials");
    }

    console.log("4 - everything ok");

    // Generate policy for successful authentication
    return generatePolicy(username, "Allow", event.methodArn);
  } catch (error) {
    console.error("Error:", error);

    // Handle specific error cases
    if (error instanceof Error) {
      console.log("Err 1 - error instanceof Error");

      if (error.message.includes("Unauthorized")) {
        console.log("Err 2 - error includes Unauthorized");

        // Return 401 for missing or invalid Authorization header
        throw new Error("Unauthorized"); // API Gateway will convert this to 401
      } else if (error.message.includes("Forbidden")) {
        console.log("Err 3 - error includes Forbidden");
        // Return 403 for invalid credentials
        return generatePolicy("user", "Deny", event.methodArn); // This will result in 403
      }
    }

    console.log("Err 4 - error return deny");

    // Default deny policy
    return generatePolicy("user", "Deny", event.methodArn);
  }
};
