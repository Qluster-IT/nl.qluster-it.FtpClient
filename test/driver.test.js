'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { Writable } = require('node:stream');

function loadModule(relative, stubs) {
  const filename = path.resolve(__dirname, '..', relative);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m.require = id => id in stubs ? stubs[id] : Module.prototype.require.call(m, id);
  m._compile(fs.readFileSync(filename, 'utf8'), filename);
  return m.exports;
}

function loadDriver({ FtpClient = class {}, BL = {} } = {}) {
  const real = require('betterlogiclibrary');
  return loadModule('drivers/ftpconnection/driver.js', {
    homey: { Driver: class {} },
    '../../lib/file-server': class { init() {} },
    '../../lib/ftp-client': FtpClient,
    './device': class {},
    betterlogiclibrary: { ...real, BL: { _: { each: (list, fn) => list.forEach(fn) }, ...BL } },
    fs: { ...fs, exists: (p, cb) => cb(null, true), readdir: (p, cb) => cb(null, []) }
  });
}

test('getFile returns the downloaded bytes unchanged, including non-UTF-8 data', async () => {
  const Driver = loadDriver();
  const driver = new Driver();
  const bytes = Buffer.from([0xff, 0x00, 0xc3, 0x28, 0x80]);
  const device = { ftpClient: {
    downloadTo: async stream => {
      assert.ok(stream instanceof Writable);
      await new Promise(resolve => stream.write(bytes.subarray(0, 2), resolve));
      await new Promise(resolve => stream.end(bytes.subarray(2), resolve));
    },
    refresh: async () => {}
  } };
  const { buffer } = await driver.getFile({ file: { id: '/x.bin' }, device });
  assert.deepEqual(buffer, bytes);
});

test('the get-URL Flow card rejects when the download fails instead of never finishing', async () => {
  const Driver = loadDriver({ BL: { getDownloadUrl: async () => ({ localUrl: 'l', cloudUrl: 'c' }), setDownloadUrl: async () => {} } });
  const driver = new Driver();
  const cards = {};
  const card = id => cards[id] = {
    registerRunListener(listener) { this.run = listener; return this; },
    getArgument: () => ({ registerAutocompleteListener() {} })
  };
  driver.log = driver.error = () => {};
  driver.homey = {
    app: {},
    flow: { getActionCard: card },
    setTimeout: (callback, ms) => setTimeout(callback, ms)
  };
  await driver.onInit();
  driver.getFile = async () => { throw new Error('download failed'); };
  let timer;
  try {
    await Promise.race([
      assert.rejects(cards.action_ftpconnection_get_url.run({ file: { isFile: true, filename: 'a' }, device: {} }), /download failed/),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Flow card hangs')), 200); })
    ]);
  } finally { clearTimeout(timer); }
});

test('pairing closes the FTP connections used to probe the local servers', async () => {
  const clients = [];
  class FtpClient {
    constructor() { this.closed = 0; clients.push(this); }
    init() {}
    async getFeatures() { if (clients.length === 2) throw new Error('offline'); return true; }
    close() { this.closed++; }
  }
  const Driver = loadDriver({ FtpClient });
  const driver = new Driver();
  driver.homey = {
    app: { ip: '127.0.0.1' },
    discovery: { getStrategy: () => ({ getDiscoveryResults: () => ({}) }) }
  };
  const devices = await driver.onPairListDevices();
  assert.equal(devices.length, 2);
  assert.deepEqual(clients.map(client => client.closed), [1, 1]);
});

test('closing an FTP client discards the connection so a later command reconnects', () => {
  const FtpClient = require('../lib/ftp-client');
  const client = new FtpClient();
  let closed = 0;
  client.client = { close: () => { closed++; } };
  client.close();
  client.close();
  assert.equal(closed, 1);
  assert.equal(client.client, undefined);
});

test('deleting or unloading a device closes its FTP connection', () => {
  const Device = loadModule('drivers/ftpconnection/device.js', { homey: { Device: class {} } });
  const device = new Device();
  let closed = 0;
  device.ftpClient = { close: () => { closed++; } };
  device.onDeleted();
  device.onUninit();
  assert.equal(closed, 2);
});
