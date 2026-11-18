'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const test = require('node:test');
const FtpClient = require('../lib/ftp-client');

function withBasicFtp(Client) {
  const filename = require.resolve('../lib/ftp-client');
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  m.require = id => id === 'basic-ftp' ? { Client } : Module.prototype.require.call(m, id);
  m._compile(fs.readFileSync(filename, 'utf8'), filename);
  return new m.exports();
}

test('three queued FTP commands execute in order without sharing the connection concurrently', async () => {
  const client = new FtpClient();
  client.homey = { error() {} };
  const order = [];
  let active = 0;
  let peak = 0;
  client.getClient = async () => ({
    cd: async () => {},
    pwd: async () => '/',
    work: async id => {
      active++;
      peak = Math.max(peak, active);
      order.push(id);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return id;
    }
  });
  const results = await Promise.all([1, 2, 3, 4].map(id => client.exec({ action: 'work' }, id)));
  assert.deepEqual(results, [1, 2, 3, 4]);
  assert.deepEqual(order, [1, 2, 3, 4]);
  assert.equal(peak, 1);
});

test('a failed connection releases the queue for later commands', async () => {
  const client = new FtpClient();
  client.homey = { error() {} };
  let calls = 0;
  client.getClient = async () => {
    if (calls++ === 0) throw new Error('connection failed');
    return { cd: async () => {}, pwd: async () => '/', work: async () => 'recovered' };
  };
  await assert.rejects(client.exec({ action: 'work', oneTry: true }), /connection failed/);
  let timer;
  try {
    const result = await Promise.race([
      client.exec({ action: 'work' }),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('queue stuck')), 200); })
    ]);
    assert.equal(result, 'recovered');
  } finally { clearTimeout(timer); }
});

test('downloads share the command queue and do not issue diagnostic directory queries', async () => {
  const client = new FtpClient();
  client.homey = { error() {} };
  const order = [];
  const operation = async name => {
    order.push(`start:${name}`);
    await new Promise(resolve => setTimeout(resolve, 5));
    order.push(`end:${name}`);
    return name;
  };
  client.getClient = async () => ({
    cd: async () => {},
    pwd: async () => assert.fail('unnecessary FTP round trip'),
    list: () => operation('list'),
    downloadTo: () => operation('download')
  });
  await Promise.all([client.exec({ action: 'list' }), client.downloadTo({}, '/file'), client.exec({ action: 'list' })]);
  assert.deepEqual(order, ['start:list', 'end:list', 'start:download', 'end:download', 'start:list', 'end:list']);
});

test('basic-ftp, https and zlib are loaded on first use instead of at startup', async () => {
  const { PassThrough } = require('node:stream');
  const stubs = {
    'basic-ftp': { Client: function () { return { ftp: {}, access: async () => {}, close() {} }; } },
    https: { get: (url, options, callback) => {
      const res = new PassThrough();
      res.statusCode = 200;
      return { on() {}, end() { callback(res); res.end('ok'); } };
    } }
  };
  const load = file => {
    const filename = require.resolve(file);
    const m = new Module(filename, module);
    m.filename = filename;
    m.paths = module.paths;
    const loaded = [];
    m.require = id => { loaded.push(id); return stubs[id] || Module.prototype.require.call(m, id); };
    m._compile(fs.readFileSync(filename, 'utf8'), filename);
    return { exports: m.exports, loaded };
  };

  const client = load('../lib/ftp-client');
  const proto = load('../lib/proto');
  assert.ok(!client.loaded.includes('basic-ftp'), 'ftp-client loads basic-ftp at startup');
  assert.ok(!proto.loaded.includes('https'), 'proto loads https at startup');
  assert.ok(!proto.loaded.includes('zlib'), 'proto loads zlib at startup');

  const ftpClient = new client.exports();
  ftpClient.homey = { error() {} };
  assert.ok(await ftpClient.getClient());
  assert.equal(await proto.exports.httpsGet({ url: 'https://example.invalid' }), 'ok');
  assert.equal((await proto.exports.ungzip(await proto.exports.gzip('text'))).toString(), 'text');
});

test('failed login closes and discards the client instead of returning an unusable connection', async () => {
  let closed = 0;
  let created = 0;
  const client = withBasicFtp(function () {
    const fail = created++ === 0;
    return {
      ftp: {},
      access: async () => { if (fail) throw new Error('login failed'); },
      close: () => { closed++; }
    };
  });
  const errors = [];
  client.homey = { error: (...args) => errors.push(args) };
  await assert.rejects(client.getClient(), /login failed/);
  assert.equal(closed, 1);
  assert.equal(client.client, undefined);
  assert.equal(errors.length, 0, 'the caller owns logging or displaying the terminal error');
  assert.ok(await client.getClient());
  assert.equal(created, 2);
});

test('all FTP path arguments stay rooted, including downloads, uploads and both sides of renames', async () => {
  for (const root of ['/media/My files', 'media/My files']) {
    const client = new FtpClient();
    client.init({ homey: { error() {}, __: key => key }, workdirectory: root + '/' });
    const calls = [];
    const ftp = { cd: async () => {} };
    for (const action of ['list', 'ensureDir', 'remove', 'removeDir', 'rename', 'uploadFrom', 'downloadTo']) {
      ftp[action] = async (...args) => { calls.push([action, ...args]); };
    }
    client.getClient = async () => ftp;
    await client.getList();
    await client.exec({ action: 'list' }, '/child');
    await client.exec({ action: 'ensureDir' }, root + '/child');
    await client.exec({ action: 'rename' }, 'child/old', '/child/new');
    await client.exec({ action: 'uploadFrom' }, 'stream', 'child/new');
    await client.downloadTo('stream', root + '/child/new');
    assert.deepEqual(calls.map(call => call.slice(0, 3)), [
      ['list', root, undefined], ['list', root + '/child', undefined],
      ['ensureDir', root + '/child', undefined], ['rename', root + '/child/old', root + '/child/new'],
      ['uploadFrom', 'stream', root + '/child/new'], ['downloadTo', 'stream', root + '/child/new']
    ]);
    const before = calls.length;
    for (const outside of ['../outside', root + '/../outside', 'child/../../outside']) {
      await assert.rejects(client.exec({ action: 'list' }, outside), /outsideRoot/);
    }
    for (const action of ['remove', 'removeDir', 'rename']) {
      await assert.rejects(client.exec({ action }, root, 'other'), /rootProtected/);
    }
    await assert.rejects(client.exec({ action: 'rename' }, 'child', root), /rootProtected/);
    assert.equal(calls.length, before);
  }
});

test('FTP retries use the same rooted path and never continue when resetting the server directory fails', async () => {
  const client = new FtpClient();
  client.init({ homey: { error() {} }, workdirectory: 'media/root' });
  const dirs = [], paths = [];
  client.getClient = async () => ({
    cd: async path => dirs.push(path),
    list: async path => { paths.push(path); if (paths.length === 1) throw new Error('retry'); return []; }
  });
  await client.exec({ action: 'list' }, 'child');
  assert.deepEqual(dirs, ['/', '/']);
  assert.deepEqual(paths, ['media/root/child', 'media/root/child']);
  client.getClient = async () => ({ cd: async () => { throw new Error('550 Root unavailable'); }, list: () => assert.fail('must not list from an unknown directory') });
  await assert.rejects(client.exec({ action: 'list' }), /Root unavailable/);
});

test('a command reconnects after a control timeout and returns persistent data connection refusals to the caller', async () => {
  const client = new FtpClient();
  client.init({ homey: { error: () => assert.fail('caller-owned error logged by the FTP queue') }, workdirectory: '/root' });
  const timeout = Object.assign(new Error('Timeout (control socket)'), { code: 'ETIMEDOUT' });
  const refused = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
  const attempts = [];
  let refuse = false;
  client.getClient = async ({ refresh }) => {
    attempts.push(refresh);
    return {
      cd: async () => { if (attempts.length === 1) throw timeout; },
      list: async () => { if (refuse) throw refused; return ['file']; }
    };
  };
  assert.deepEqual(await client.getList(), ['file']);
  refuse = true;
  await assert.rejects(client.getList(), error => error === refused);
  assert.deepEqual(attempts, [false, true, false, true]);
});

test('a stale socket is replaced and queued commands wait for the fresh login', async () => {
  let releaseLogin, startLogin, connections = 0, closed = 0;
  const started = new Promise(resolve => { startLogin = resolve; });
  const waiting = new Promise(resolve => { releaseLogin = resolve; });
  const order = [];
  const client = withBasicFtp(function () {
    connections++;
    let loggedIn = false;
    return {
      ftp: {},
      async access() {
        startLogin();
        await waiting;
        loggedIn = true;
      },
      async cd() { assert.ok(loggedIn, 'command ran during login'); },
      async downloadTo() { order.push('download'); },
      async features() { assert.ok(loggedIn, 'feature probe ran during login'); order.push('features'); },
      async list() { order.push('list'); return ['fresh']; }
    };
  });
  client.init({ homey: {} });
  client.client = { closed: true, close() { closed++; }, cd: () => assert.fail('used stale socket') };
  const results = Promise.all([client.downloadTo({}, '/file'), client.getFeatures(), client.getList({ oneTry: true })]);
  await started;
  releaseLogin();
  assert.deepEqual((await results)[2], ['fresh']);
  assert.deepEqual(order, ['download', 'features', 'list']);
  assert.equal(closed, 1);
  assert.equal(connections, 1);
});

test('reconfiguration cancels an active retry and rejects queued work for the old root', async () => {
  const client = new FtpClient();
  client.init({ homey: {}, workdirectory: '/old' });
  let connections = 0;
  let started;
  const active = new Promise(resolve => { started = resolve; });
  const interrupted = new Error('socket closed');
  client.getClient = async () => {
    connections++;
    return client.client = {
      cd: async () => {},
      list: path => path === '/new' ? ['new file'] : new Promise((resolve, reject) => {
        client.client.close = () => reject(interrupted);
        started();
      }),
      close() {}
    };
  };
  const running = client.getList();
  const queued = client.getList();
  const oldResults = Promise.all([
    assert.rejects(running, error => error === interrupted),
    assert.rejects(queued, /closed or reconfigured/)
  ]);
  await active;
  client.init({ workdirectory: '/new' });
  await oldResults;
  assert.deepEqual(await client.getList(), ['new file']);
  assert.equal(connections, 2);
});
