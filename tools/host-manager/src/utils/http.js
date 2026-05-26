const fs = require("fs");
const { URL } = require("url");

function loadConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });

  response.end(body);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error("Request body read timed out."));
    });

    request.on("data", chunk => {
      body += chunk;

      if (body.length > 1024 * 64) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        resolve(body.length > 0 ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });

    request.on("error", reject);
  });
}

function getRouteMatch(request, method, routePattern) {
  if (request.method !== method) {
    return { matched: false, params: {} };
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const routeParts = routePattern.split("/").filter(Boolean);
  const pathParts = requestUrl.pathname.split("/").filter(Boolean);

  if (routeParts.length !== pathParts.length) {
    return { matched: false, params: {} };
  }

  const params = {};

  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const pathPart = pathParts[index];

    if (routePart.startsWith(":")) {
      try {
        params[routePart.slice(1)] = decodeURIComponent(pathPart);
      } catch (error) {
        return { matched: false, params: {} };
      }
      continue;
    }

    if (routePart !== pathPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

module.exports = {
  loadConfig,
  sendJson,
  sendError,
  readJsonBody,
  getRouteMatch
};
