import http from 'node:http';
import { Readable } from 'node:stream';

export function nodeRequest(req, origin = 'http://localhost') {
  const url = new URL(req.url || '/', origin);
  const init = { method:req.method, headers:req.headers };
  if (!['GET','HEAD'].includes(req.method)) { init.body = Readable.toWeb(req); init.duplex = 'half'; }
  return new Request(url, init);
}

export async function sendNodeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value,key) => res.setHeader(key,value));
  if (!response.body) { res.end(); return; }
  Readable.fromWeb(response.body).pipe(res);
}

export function createWebServer(handler, options = {}) {
  return http.createServer(async (req,res) => {
    try {
      const origin = options.origin || `http://${req.headers.host || 'localhost'}`;
      const response = await handler(nodeRequest(req,origin), { req,res });
      await sendNodeResponse(res,response);
    } catch (error) {
      res.statusCode = 500; res.setHeader('content-type','text/plain;charset=utf-8'); res.end(options.exposeErrors ? error.stack : 'Internal Server Error');
    }
  });
}
