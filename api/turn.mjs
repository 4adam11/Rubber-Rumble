// GET /api/turn → { iceServers: [...] }: the relay servers for Play with Friends (see _turn.mjs).
import { createTurnService, allowedRequest } from './_turn.mjs';

const service = createTurnService({ env: process.env, fetch: globalThis.fetch });

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!allowedRequest(req.headers, [host])) return send(res, 403, { error: 'Only the game can ask for relay servers.' });
  return send(res, 200, { iceServers: await service.iceServers() });
}
