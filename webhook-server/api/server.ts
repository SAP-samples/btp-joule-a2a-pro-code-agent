/// <reference types="node" />
import cds from '@sap/cds';
import express from 'express';

/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-var-requires
declare const require: any;
declare const process: any;
declare const Buffer: any;

const LOG = cds.log('webhook');

// Webhook config from cds.env (e.g., .cdsrc-private.json or environment variables)
const webhookCfg: any = (cds.env as any)?.webhook || {};

cds.on('served', () => {
  const app = cds.app as unknown as express.Express;
  app.use(express.json({ limit: '1mb' }));

  // Authentication helper for CAP's jwt strategy
  const requireAuth: express.RequestHandler = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const isDev = process.env.CDS_ENV === 'development' || process.env.NODE_ENV === 'development';
    if (isDev) return next();
    const user = cds.context?.user;
    if (user && !user.isAnonymous()) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  };

  // Webhook authentication: Basic and/or Bearer via environment variables
  // - WEBHOOK_BASIC_USER / WEBHOOK_BASIC_PASS for Basic auth
  // - WEBHOOK_BEARER_TOKEN or WEBHOOK_BEARER_TOKENS (comma-separated) for Bearer auth
  const webhookAuth: express.RequestHandler = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const hdr = req.headers['authorization'] || '';
    const basicUser = process.env.WEBHOOK_BASIC_USER ?? webhookCfg.basicUser;
    const basicPass = process.env.WEBHOOK_BASIC_PASS ?? webhookCfg.basicPass;
    const bearerSingle = process.env.WEBHOOK_BEARER_TOKEN ?? webhookCfg.bearerToken;
    const bearerSources = (process.env.WEBHOOK_BEARER_TOKENS ?? webhookCfg.bearerTokens ?? '') as string;
    const bearerList = String(bearerSources)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const allowedBearer = new Set([...(bearerSingle ? [bearerSingle] : []), ...bearerList]);

    const challenge = () => {
      res.setHeader('WWW-Authenticate', 'Basic realm="webhook", Bearer realm="webhook"');
      return res.status(401).json({ error: 'Unauthorized' });
    };

    const haveBasic = !!(basicUser && basicPass);
    const haveBearer = allowedBearer.size > 0;
    if (!haveBasic && !haveBearer) {
      LOG.warn('No WEBHOOK auth configured; rejecting request to /webhook');
      return challenge();
    }

    if (typeof hdr === 'string' && hdr.startsWith('Basic ')) {
      if (!haveBasic) return challenge();
      try {
        const decoded = Buffer.from(hdr.slice(6), 'base64').toString('utf8');
        const sep = decoded.indexOf(':');
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        if (u === basicUser && p === basicPass) return next();
      } catch {
        // ignore decode errors
      }
      return challenge();
    }

    if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) {
      const token = hdr.slice(7).trim();
      if (haveBearer && allowedBearer.has(token)) return next();
      return challenge();
    }

    return challenge();
  };

  // SSE clients registry
  const sseClients = new Set<express.Response>();
  const sendEvent = (data: any) => {
    const json = JSON.stringify(data);
    for (const res of sseClients) {
      res.write(`data: ${json}\n\n`);
    }
  };

  // SSE endpoint - keeps connection open for real-time updates
  app.get('/events', (req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    LOG.info('SSE client connecting', {
      ip: req.ip,
      ua: req.headers['user-agent'],
      url: req.originalUrl,
    });

    res.write(': connected\n\n');
    sseClients.add(res);

    // Send initial ready event and padding to defeat proxy buffering
    try {
      res.write('data: {"type":"ready"}\n\n');
      const pad = ': '.padEnd(2048, 'x') + '\n\n';
      res.write(pad);
      (res as any).flush?.();
    } catch {
      // ignore
    }

    // Heartbeat to keep connection alive through proxies
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        // ignore
      }
    }, 30000);

    const cleanup = () => {
      clearInterval(ping);
      sseClients.delete(res);
      try { res.end(); } catch { /* ignore */ }
    };
    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', cleanup);
  });

  // Health check endpoint
  app.get('/health', requireAuth, (_req: express.Request, res: express.Response) => 
    res.status(200).json({ status: 'ok' })
  );

  // Webhook endpoint - receives payloads and broadcasts to SSE clients
  app.use('/webhook', webhookAuth);
  app.all('/webhook', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    return next();
  });
  app.post('/webhook', (req: express.Request, res: express.Response) => {
    const payload = req.body;
    LOG.info('Webhook received', payload);
    sendEvent(payload);
    return res.status(200).json(payload);
  });
});

export = cds.server;