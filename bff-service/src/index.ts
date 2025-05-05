import { createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http';
import { URL } from 'url';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

interface ServiceConfig {
  [key: string]: string;
}

// Load service URLs from environment variables
const serviceUrls: ServiceConfig = {
  api: process.env.CART_SERVICE_URL || '',
  cart: process.env.CART_SERVICE_URL || '',
  import: process.env.IMPORT_SERVICE_URL || '',
  product: process.env.PRODUCTS_SERVICE_URL || '',
  products: process.env.PRODUCTS_SERVICE_URL || '',
  profile: process.env.PROFILE_SERVICE_URL || '',
};

// Cache object to store responses
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_EXPIRATION_MS = 2 * 60 * 1000; // 2 minutes

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length === 0) {
      res.writeHead(400);
      res.end('Invalid request: service name is required');
      return;
    }

    const serviceName = pathParts[0];
    const recipientUrl = serviceUrls[serviceName];

    if (!recipientUrl) {
      console.error('Debug info:', {
        serviceUrls,
        serviceName,
        error: 'Recipient URL not found'
      });

      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Cannot process request #1',
        debug: {
          serviceUrls,
          url,
          serviceName
        }
      }));
      return;
    }

    // Check if the request is for products and handle caching
    if (serviceName === 'products' && req.method === 'GET') {
      const cacheKey = `${serviceName}-${url.search}`;
      const cachedData = cache[cacheKey];

      // Serve from cache if not expired
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRATION_MS)) {
        console.log('Serving from cache:', cacheKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedData.data));
        return;
      }

      // Fetch fresh data and update cache
      console.log('Fetching fresh data:', cacheKey);
      const targetUrl = `${recipientUrl}/${pathParts.join('/')}${url.search}`;

      // Forward the request
      const response = await axios({
        method: req.method?.toLowerCase() || 'get',
        url: targetUrl,
        headers: {
          ...req.headers,
          host: new URL(recipientUrl).host,
        },
        data: req.method !== 'GET' ? await getRequestBody(req) : undefined,
        validateStatus: () => true, // Don't throw on any status
      });

      // Update cache
      cache[cacheKey] = {
        data: response.data,
        timestamp: Date.now(),
      };

      const headers: OutgoingHttpHeaders = {};
      if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
              headers[key] = value;
          });
      }

      res.writeHead(response.status, headers);
      res.end(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
      return;
    }


    // Construct target URL
    const targetPath = pathParts.join('/');
    const targetUrl = `${recipientUrl}/${targetPath}${url.search}`;

    // Forward the request
    const response = await axios({
      method: req.method?.toLowerCase() || 'get',
      url: targetUrl,
      headers: {
        ...req.headers,
        host: new URL(recipientUrl).host,
      },
      data: req.method !== 'GET' ? await getRequestBody(req) : undefined,
      validateStatus: () => true, // Don't throw on any status
    });

    const headers: OutgoingHttpHeaders = {};
    if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
            headers[key] = value;
        });
    }

    // Forward the response
    res.writeHead(response.status, headers);
    res.end(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));

  } catch (error) {
    console.error('Debug info #2:', {
      serviceUrls,
      error
    });

    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Cannot process request #2',
      debug: {
        serviceUrls,
        error,
      }
    }));
  }
}

function getRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Create and start the server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`BFF Service listening on port ${PORT}`);
});