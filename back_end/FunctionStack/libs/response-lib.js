const buildResponse = (statusCode, body, isHtml) => {
  const respObj = {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };
  if (isHtml) {
    respObj.headers["Content-Type"] = "text/html";
    respObj.body = body;
  } else {
    respObj.body = JSON.stringify(body);
  }
  return respObj;
};
export function success(body) {
  return buildResponse(200, body);
}

export function successHTML(html) {
  return buildResponse(200, html, true);
}

export function failure(body) {
  body = body || { status: false, error: "Invalid Request" };
  return buildResponse(500, body);
}
export function badRequest(body) {
  body = body || { status: false, error: "Bad Request" };
  return buildResponse(400, body);
}
export function notFound(body) {
  body = body || { status: false, error: "Not found" };
  return buildResponse(404, body);
}
