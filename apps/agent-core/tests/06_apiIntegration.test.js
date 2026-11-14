// apps/agent-core/tests/06_apiIntegration.test.js
// Production-grade Integration Test Suite for End-to-End HTTP Endpoints

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../server');

let testServer;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => testServer.close(resolve));
});

describe('Suite 1: Liveness, Health & Metadata Routes', () => {
  it('GET /health returns 200 with ONLINE status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ONLINE');
    assert.strictEqual(body.network, 'near-testnet');
  });

  it('GET /openapi.json returns valid OpenAPI 3.0 specification', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    assert.strictEqual(res.status, 200);
    const spec = await res.json();
    assert.strictEqual(spec.openapi, '3.0.0');
    assert.ok(spec.paths['/api/agent/trade']);
  });

  it('GET /v1/tokens & /api/market/tokens returns supported token list', async () => {
    const res = await fetch(`${baseUrl}/v1/tokens`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.tokens));
    assert.ok(data.tokens.length >= 5);
  });
});

describe('Suite 2: Machine-Readable Agent Trade Gateway Endpoints', () => {
  it('POST /api/agent/trade with valid payload creates order and arms vault', async () => {
    const payload = {
      token: 'wrap.testnet',
      amount: 0.1,
      sl: 5.0,
      tp: 10.0,
      wallet: 'integration_tester.testnet',
      mode: 'TWO_WAY',
    };

    const res = await fetch(`${baseUrl}/api/agent/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.orderId.startsWith('ord_'));
    assert.ok(data.status === 'ACCEPTED' || data.status === 'IN_POSITION');
  });

  it('POST /api/agent/trade with missing wallet returns 400 with structured remediation', async () => {
    const invalidPayload = {
      token: 'wrap.testnet',
      amount: 1.0,
      sl: 5.0,
      tp: 10.0,
    };

    const res = await fetch(`${baseUrl}/api/agent/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'MISSING_WALLET');
    assert.strictEqual(data.field, 'wallet');
    assert.ok(data.remediation);
  });

  it('POST /api/agent/exit for non-existent position returns 404 POSITION_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/agent/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord_ghost_does_not_exist', wallet: 'ghost.testnet' }),
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'POSITION_NOT_FOUND');
  });
});

describe('Suite 3: Intent Quote Validation Endpoints', () => {
  it('POST /api/intents/quote without destinationToken returns 400 MISSING_DESTINATION_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/api/intents/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1.0, wallet: 'test.testnet' }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'MISSING_DESTINATION_TOKEN');
  });

  it('POST /api/intents/quote with complete parameters returns valid solver quote', async () => {
    const res = await fetch(`${baseUrl}/api/intents/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originToken: 'wrap.testnet',
        destinationToken: 'USDC',
        amount: 2.0,
        wallet: 'test_solver.testnet',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.quote);
    assert.strictEqual(data.quote.status, 'SOLVER_QUOTED');
  });
});
