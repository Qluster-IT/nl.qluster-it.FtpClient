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
  const betterlogiclibrary = { ...real, BL: { _: { each: (list, fn) => list.forEach(fn) }, ...BL } };
  return loadModule('drivers/ftpconnection/driver.js', {
    homey: { Driver: class {} },
    '../../lib/file-server': class { init() {} },
    '../../lib/ftp-client': FtpClient,
    '../../lib/icons': loadModule('lib/icons.js', { betterlogiclibrary }),
    './device': class {},
    betterlogiclibrary,
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

test('pairing closes the FTP connections used to check the server and the login', async () => {
  const clients = [];
  class FtpClient {
    constructor() { this.closed = 0; clients.push(this); }
    init() {}
    async exec() { return []; }
    close() { this.closed++; }
  }
  const Driver = loadDriver({ FtpClient });
  const driver = new Driver();
  driver.homey = {};
  driver.error = () => {};
  const handlers = {};
  const views = [];
  await driver.onPair({ setHandler: (name, handler) => { handlers[name] = handler; }, showView: view => views.push(view) });
  await handlers.list_devices_selection([{ settings: { ip: '192.0.2.1', port: 21 } }]);
  await handlers.showView('loading_credentials');
  assert.equal(await handlers.login({ username: 'user', password: 'secret' }), true);
  assert.deepEqual(views, ['add_devices']);
  assert.deepEqual(clients.map(client => client.closed), [1, 1]);
});

function loginAttempts(acceptsLogin) {
  const attempts = [];
  class FtpClient {
    init(options) { this.options = options; }
    async exec() {
      const attempt = { secure: this.options.secure === true, allowIncorrectCertificate: this.options.allow_incorrect_certificate === true };
      attempts.push(attempt);
      if (!acceptsLogin(attempt)) throw new Error('530 Login incorrect');
      return [];
    }
    close() {}
  }
  return { attempts, FtpClient };
}

async function pairLogin(FtpClient) {
  const Driver = loadDriver({ FtpClient });
  const driver = new Driver();
  driver.homey = {};
  driver.error = () => {};
  const handlers = {};
  await driver.onPair({ setHandler: (name, handler) => { handlers[name] = handler; }, showView() {} });
  await handlers.list_devices_selection([{ settings: { ip: '192.0.2.1', port: 21 } }]);
  return { driver, result: await handlers.login({ username: 'user', password: 'secret' }) };
}

test('pairing rejects a login that fails both without and with encryption', async () => {
  const { attempts, FtpClient } = loginAttempts(() => false);
  const { driver, result } = await pairLogin(FtpClient);
  assert.equal(result, false);
  assert.equal(driver.isConnected, undefined);
  assert.deepEqual(attempts, [{ secure: false, allowIncorrectCertificate: false }, { secure: true, allowIncorrectCertificate: true }]);
});

test('pairing accepts a login that only works with encryption and stores it as secure', async () => {
  const { attempts, FtpClient } = loginAttempts(attempt => attempt.secure);
  const { driver, result } = await pairLogin(FtpClient);
  assert.equal(result, true);
  assert.equal(driver.secure, true);
  assert.equal(driver.allow_incorrect_certificate, undefined);
  assert.equal(attempts.length, 2);
});

test('the folder pickers list the folder that is selected on the card', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, filter: (list, fn) => list.filter(fn), each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  const autocompletes = {};
  driver.log = driver.error = () => {};
  driver.homey = {
    app: { ip: '192.0.2.1' },
    flow: { getActionCard: id => ({
      registerRunListener() { return this; },
      getArgument: name => ({ registerAutocompleteListener(listener) { autocompletes[`${id}.${name}`] = listener; } })
    }) },
    setTimeout
  };
  await driver.onInit();
  const listed = [];
  const device = { settings: {}, ftpClient: { exec: async (options, path) => { listed.push(path); return []; } } };
  const directory = { id: 'photos/2024', isDirectory: true };
  for (const card of ['action_ftpclient_save_imagetoken', 'action_ftpclient_save_file_base64', 'action_ftpclient_get_files']) {
    await autocompletes[`${card}.directory`]('', { device, directory });
  }
  assert.deepEqual(listed, ['photos/2024', 'photos/2024', 'photos/2024']);
});

test('the folder filter works without adding a contains method to every array and string', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, filter: (list, fn) => list.filter(fn), last: list => list[list.length - 1], each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { app: { ip: '192.0.2.1' } };
  const entries = [{ name: 'photo.jpg', isFile: true, isDirectory: false }, { name: 'archive', isFile: false, isDirectory: true }];
  const files = await driver.getFiles({ type: 'folder', includeDiretories: false, device: { settings: {}, ftpClient: { exec: async () => entries } } });
  assert.deepEqual(files.map(file => file.name), ['archive']);
  assert.equal(Array.prototype.contains, undefined);
  assert.equal(String.prototype.contains, undefined);
});

test('folder listings use the icon address chosen in the device settings', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, last: list => list[list.length - 1], each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { app: { ip: '192.0.2.1', cloudId: 'cloud' } };
  const iconHost = async urlforicons => {
    const [file] = await driver.getFiles({ device: { settings: { urlforicons }, ftpClient: { exec: async () => [{ name: 'docs', isFile: false, isDirectory: true }] } } });
    return file.image.slice(0, file.image.indexOf('/app/'));
  };
  assert.equal(await iconHost('local'), 'http://192.0.2.1');
  assert.equal(await iconHost('localssl'), 'https://192-0-2-1.homey.homeylocal.com');
  assert.equal(await iconHost('cloudssl'), 'https://cloud.connect.athom.com');
  assert.equal(await iconHost(undefined), 'https://192-0-2-1.homey.homeylocal.com');
});

test('a local download URL releases its file contents when the download time ends', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const Driver = loadDriver();
  const driver = new Driver();
  driver.log = driver.error = () => {};
  driver.homey = { app: { ip: '192.0.2.1' } };
  const device = { id: 'device', settings: { urlforfiles: 'local', downloadtime: 60 }, ftpClient: {
    downloadTo: stream => new Promise(resolve => stream.end(Buffer.from('content'), resolve)),
    refresh: async () => {}
  } };
  const { id, url } = await driver.getFileUrl({ file: { id: '/a.txt', name: 'a.txt' }, device, type: 'download' });
  assert.equal(url, 'http://192.0.2.1:47335/file/' + id);
  assert.deepEqual(driver.fileDownloads[id].buffer, Buffer.from('content'));
  t.mock.timers.tick(59 * 1000);
  assert.ok(driver.fileDownloads[id]);
  t.mock.timers.tick(1000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(driver.fileDownloads[id], undefined);
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

test('the file server answers an old file URL before any download and logs a busy port', () => {
  let handler;
  const listeners = {};
  const server = { on(event, listener) { listeners[event] = listener; return server; }, listen() { return server; } };
  const FileServer = loadModule('lib/file-server.js', { http: { createServer: requestHandler => { handler = requestHandler; return server; } } });
  const errors = [];
  new FileServer().init({ app: { ip: '192.0.2.1' }, drivers: { getDriver: () => ({}) }, error: (...args) => errors.push(args) });
  const res = { writeHead(status) { this.status = status; }, end() { this.ended = true; } };
  handler({ headers: { host: '192.0.2.1:47335' }, url: '/file/old' }, res);
  assert.deepEqual([res.status, res.ended], [404, true]);
  assert.equal(typeof listeners.error, 'function');
  listeners.error(new Error('listen EADDRINUSE'));
  assert.equal(errors[0][0], 'File server could not use port 47335');
});

test('an upload session is released after its last part, also when the upload fails', async () => {
  const api = loadModule('api.js', { homey: {} });
  const uploaded = [];
  const fileUploads = {
    done: { upload: async ({ directory, files }) => { uploaded.push([directory, files]); return {}; } },
    failed: { upload: async () => { throw new Error('FTP server unavailable'); } }
  };
  const homey = { drivers: { getDriver: () => ({ fileUploads }) } };
  const json = JSON.stringify([{ name: 'a.txt', base64: 'YQ==' }]);
  assert.equal(await api.uploadFilePartials({ homey, body: { directory: 'd', partial: json.slice(0, 5), id: 'done' } }), true);
  assert.deepEqual(await api.uploadFilePartials({ homey, body: { directory: 'd', partial: json.slice(5), id: 'done', lastPart: true } }), {});
  assert.deepEqual(uploaded, [['d', [{ name: 'a.txt', base64: 'YQ==' }]]]);
  await assert.rejects(api.uploadFilePartials({ homey, body: { directory: 'd', partial: json, id: 'failed', lastPart: true } }), /unavailable/);
  assert.deepEqual(fileUploads, {});
});
