'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const test = require('node:test');
const FtpClient = require('../lib/ftp-client');

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

test('failed login closes and discards the client instead of returning an unusable connection', async () => {
  let closed = 0;
  let created = 0;
  const ftp = { Client: function () {
    const fail = created++ === 0;
    return {
      ftp: {},
      access: async () => { if (fail) throw new Error('login failed'); },
      close: () => { closed++; }
    };
  } };
  const filename = require.resolve('../lib/ftp-client');
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  m.require = id => id === 'basic-ftp' ? ftp : Module.prototype.require.call(m, id);
  m._compile(fs.readFileSync(filename, 'utf8'), filename);
  const client = new m.exports();
  const errors = [];
  client.homey = { error: (...args) => errors.push(args) };
  await assert.rejects(client.getClient(), /login failed/);
  assert.equal(closed, 1);
  assert.equal(client.client, undefined);
  assert.equal(errors.length, 1);
  assert.ok(await client.getClient());
  assert.equal(created, 2);
});
