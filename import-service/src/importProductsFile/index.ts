import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(
    "importProductsFile lambda invoked with event:",
    JSON.stringify(event)
  );

  const origin = event.headers.origin || event.headers.Origin || "*"; // Get the Origin header

  // Handle OPTIONS requests (preflight)
  if (event.httpMethod === "OPTIONS") {
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    }

    console.log(
      "importProductsFile headers returned in OPTIONS call:",
      JSON.stringify(headers)
    );

    return {
      statusCode: 200,
      headers: headers,
      body: "",
    };
  }

  try {
    // Get the filename from query parameters
    const fileName = event.queryStringParameters?.name;
    if (!fileName || !fileName.toLowerCase().endsWith(".csv")) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          error: "Missing required query parameter: name",
        }),
      };
    }

    const bucketName = process.env.BUCKET_NAME;
    const region = process.env.BUCKET_REGION || "eu-west-3";
    const key = `uploaded/${fileName}`;

    if (!bucketName) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Bucket name is not configured" }),
      };
    }

    // Initialize S3 client
    const s3Client = new S3Client({ region });

    // Create the command for the S3 operation
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: "text/csv",
    });

    // Generate a signed URL
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    }); // URL expires in 1 hour

    console.log(
      `Generated signed URL for file: ${fileName}, URL: ${signedUrl}`
    );

    // Return the signed URL
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
      },
      body: signedUrl,
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Error generating signed URL",
        details: (error as Error).message,
      }),
    };
  }
};
