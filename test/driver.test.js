'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { Writable } = require('node:stream');
const translate = key => key;

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
    './device': class {},
    betterlogiclibrary,
    fs: { ...fs, exists: (p, cb) => cb(null, true), readdir: (p, cb) => cb(null, []) }
  });
}

async function openRepairBrowser(workdirectory, exec, browser = {}) {
  const Driver = loadDriver();
  const driver = new Driver();
  const handlers = {};
  const errors = [];
  driver.homey = { __: key => key };
  driver.error = error => errors.push(error);
  await driver.onRepair({ setHandler: (name, handler) => { handlers[name] = handler; } }, {
    getData: () => ({ id: 'device' }),
    getSettings: () => ({ workdirectory }),
    ftpClient: { exec }
  });
  const controllers = {};
  const directives = {};
  const app = {
    run() { return this; },
    controller(name, controller) {
      controllers[name] = Array.isArray(controller) ? controller[controller.length - 1] : controller;
      return this;
    },
    directive(name, factory) { directives[name] = Array.isArray(factory) ? factory[factory.length - 1] : factory; return this; }
  };
  const repairFolder = path.resolve(__dirname, '../drivers/ftpconnection/repair');
  const html = fs.readFileSync(path.join(repairFolder, 'ftpclient.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('function handleError'));
  const context = vm.createContext({
    window: {},
    angular: { module: () => app },
    document: { body: {} },
    $: () => ({ on() {}, off() {} }),
    _: { find: (list, predicate) => list.find(predicate) },
    Homey: {
      emit: async (name, args) => handlers[name](args),
      showLoadingOverlay() {},
      hideLoadingOverlay() {},
      alert: error => errors.push(error),
      __: key => key
    },
    ...browser
  });
  const iconsScript = html.match(/<script\b[^>]*src="(ftp-file-icons\.js)"[^>]*>/);
  if (iconsScript) vm.runInContext(fs.readFileSync(path.join(repairFolder, iconsScript[1]), 'utf8'), context);
  vm.runInContext(script, context);
  const scope = { $apply: callback => callback(), $on() {} };
  const rootScope = { $apply: callback => callback() };
  controllers.ftpclientCtrl(scope, rootScope);
  await new Promise(resolve => setImmediate(resolve));
  const directoryScope = { $parent: scope, $apply: scope.$apply };
  controllers.ftpDirectoryCtrl(directoryScope, rootScope);
  return { driver, handlers, scope, directoryScope, controllers, directives, rootScope, errors };
}

test('repair starts in the configured root and keeps navigation and file operations relative to it', async () => {
  for (const workdirectory of ['/media/My files///', 'media/My files/']) {
    const root = workdirectory.replace(/\/+$/, '');
    const calls = [];
    const { driver, handlers, scope, directoryScope, errors } = await openRepairBrowser(workdirectory, async ({ action }, ...args) => {
      calls.push([action, ...args]);
      return action === 'list' ? [{ name: 'music', isDirectory: true, isFile: false }] : true;
    });
    const directory = scope.vars.content;
    assert.equal(directory.id, root);
    assert.equal(directory.fullPath, root);
    assert.equal(directory.path, root);
    assert.equal(scope.vars.path, root);
    assert.equal(scope.vars.displayPath(root), '/');
    assert.equal(scope.vars.displayPath(root + '/music'), 'music');
    const child = directory.children[0];
    assert.equal(child.id, root + '/music');
    directoryScope.setCurrentDirectory(child);
    directoryScope.getChildren(child);
    await new Promise(resolve => setImmediate(resolve));
    directoryScope.setCurrentDirectory(directory);
    directoryScope.getChildren(directory, true);
    await new Promise(resolve => setImmediate(resolve));
    await handlers.addDirectory({ directory, name: 'new' });
    await handlers.moveItem({ item: { id: child.id + '/song.mp3', name: 'song.mp3' }, targetDirectory: directory });
    const { id } = await handlers.uploadFiles();
    await driver.fileUploads[id].upload({ directory, files: [{ name: 'upload.txt', base64: 'aGk=' }] });
    assert.deepEqual(calls.slice(0, 5), [
      ['list', root], ['list', root + '/music'], ['list', root],
      ['ensureDir', root + '/new'], ['rename', root + '/music/song.mp3', root + '/song.mp3']
    ]);
    assert.equal(calls[5][0], 'uploadFrom');
    assert.equal(calls[5][2], root + '/upload.txt');
    assert.equal(scope.vars.currentDirectory, directory);
    assert.deepEqual(errors, []);
  }
});

test('repair still uses the FTP server root when the work directory is empty or slash', async () => {
  for (const workdirectory of ['', '/', undefined]) {
    const listed = [];
    const { scope, errors } = await openRepairBrowser(workdirectory, async (options, path) => {
      listed.push(path);
      return [{ name: 'file.txt', isFile: true }];
    });
    assert.deepEqual(listed, ['']);
    assert.equal(scope.vars.content.id, '');
    assert.equal(scope.vars.content.children[0].id, 'file.txt');
    assert.deepEqual(errors, []);
  }
});

test('repair reports an inaccessible configured root instead of browsing the server root', async () => {
  const listed = [];
  const failure = new Error('550 Directory unavailable');
  const { scope, errors } = await openRepairBrowser('/missing/', async (options, path) => {
    listed.push(path);
    throw failure;
  });
  assert.deepEqual(listed, ['/missing']);
  assert.equal(scope.vars.content.children.length, 0);
  assert.deepEqual(errors, [failure, failure]);
});

test('repair moves require confirmation and cancelling does not send an FTP command', async () => {
  const calls = [];
  const { scope, directoryScope, errors } = await openRepairBrowser('/media', async ({ action }, ...args) => {
    calls.push([action, ...args]);
    return action === 'list' ? [] : true;
  });
  const parent = scope.vars.content;
  const target = { id: '/media/destination', fullPath: '/media/destination' };
  for (const isDirectory of [false, true]) {
    const item = { id: '/media/source', name: 'source', isDirectory };
    directoryScope.moveItem(item, parent, target);
    assert.equal(scope.vars.pendingMove.item, item);
    assert.equal(calls.filter(([action]) => action === 'rename').length, isDirectory ? 1 : 0);
    scope.vars.pendingMove = null;
    directoryScope.moveItem(item, parent, target);
    directoryScope.confirmMove();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scope.vars.pendingMove, null);
    assert.equal(calls.filter(([action]) => action === 'rename').length, isDirectory ? 2 : 1);
    assert.deepEqual(calls.find(([action]) => action === 'rename'), ['rename', '/media/source', '/media/destination/source']);
  }
  assert.deepEqual(errors, []);
});

test('repair does not offer moves into the same folder, itself, or a descendant', async () => {
  const { scope, directoryScope } = await openRepairBrowser('/media', async () => []);
  const parent = scope.vars.content;
  const folder = { id: '/media/music', name: 'music', isDirectory: true };
  for (const target of [parent, { id: parent.id }, folder, { id: folder.id + '/albums' }]) {
    directoryScope.moveItem(folder, parent, target);
    assert.equal(scope.vars.pendingMove, undefined);
  }
});

test('a failed confirmed move is reported instead of refreshing as if it succeeded', async () => {
  const failure = new Error('550 Permission denied');
  const { scope, directoryScope, errors } = await openRepairBrowser('/media', async ({ action }) => {
    if (action === 'rename') throw failure;
    return [];
  });
  directoryScope.moveItem({ id: '/media/a', name: 'a', isDirectory: false }, scope.vars.content, { id: '/media/b' });
  directoryScope.confirmMove();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, [failure, failure]);
});

test('repair refresh preserves loaded subfolders and does not reload cached empty folders', async () => {
  let requests = 0;
  const { scope, directoryScope } = await openRepairBrowser('/media', async () => {
    requests++;
    return [{ name: 'music', isDirectory: true }];
  });
  const root = scope.vars.content;
  const child = root.children[0];
  child.show = true;
  child.loaded = true;
  child.children = [{ id: '/media/music/song.mp3', fullPath: '/media/music/song.mp3' }];
  scope.vars.currentDirectory = child;
  scope.vars.selected = child;
  await directoryScope.getChildren(root, true);
  assert.equal(root.children[0].children, child.children);
  assert.equal(scope.vars.currentDirectory, root.children[0]);
  assert.equal(scope.vars.selected, root.children[0]);
  const before = requests;
  await directoryScope.getChildren({ fullPath: '/media/empty', loaded: true, children: [] });
  assert.equal(requests, before);
  scope.vars.path = '/media/music2';
  assert.equal(directoryScope.isInPath({ fullPath: '/media/music' }), false);
});

test('repair CRUD failures are rejected rather than being returned as success', async () => {
  const failure = new Error('550 Permission denied');
  const { handlers } = await openRepairBrowser('/media', async ({ action }) => {
    if (action === 'list') return [];
    throw failure;
  });
  for (const [name, args] of [
    ['addDirectory', { directory: { id: '/media' }, name: 'new' }],
    ['renameDirectory', { directory: { id: '/media/a', path: '/media', renameName: 'b' } }],
    ['deleteDirectory', { directory: { id: '/media/a' } }],
    ['renameFile', { file: { id: '/media/a', path: '/media', renameName: 'b' } }],
    ['deleteFile', { file: { id: '/media/a' } }]
  ]) await assert.rejects(handlers[name](args), failure);
});

test('repair folder rename and delete leave removed paths and refresh the parent without script errors', async () => {
  for (const operation of ['renameDirectory', 'deleteDirectory']) {
    const calls = [];
    const { scope, directoryScope, errors } = await openRepairBrowser('/media', async ({ action }, ...args) => {
      calls.push([action, ...args]);
      return action === 'list' ? [{ name: calls.length > 1 ? 'renamed' : 'music', isDirectory: true }] : true;
    });
    const directory = scope.vars.content.children[0];
    directory.rename = true;
    directory.renameName = 'renamed';
    directory.delete = true;
    directoryScope.setCurrentDirectory({ fullPath: directory.fullPath + '/albums' });
    scope.vars.selected = { fullPath: directory.fullPath + '/albums/song.mp3' };
    await directoryScope[operation](directory);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scope.vars.path, '/media');
    assert.equal(scope.vars.currentDirectory, scope.vars.content);
    assert.equal(scope.vars.selected, null);
    assert.deepEqual(calls[calls.length - 1], ['list', '/media']);
    assert.equal(directory[operation === 'renameDirectory' ? 'rename' : 'delete'], undefined);
    assert.deepEqual(errors, []);
  }
});

test('repair folder rename failure reaches the error dialog and preserves the pending name', async () => {
  const failure = new Error('550 Permission denied');
  const { scope, directoryScope, errors } = await openRepairBrowser('/media', async ({ action }) => {
    if (action === 'rename') throw failure;
    return [{ name: 'music', isDirectory: true }];
  });
  const directory = scope.vars.content.children[0];
  directory.rename = true;
  directory.renameName = 'renamed';
  await directoryScope.renameDirectory(directory);
  assert.equal(directory.renameName, 'renamed');
  assert.equal(directory.rename, true);
  assert.deepEqual(errors, [failure, failure]);
});

test('repair upload errors stop the upload and retain the dialog for retry', async () => {
  class FileReader {
    readAsDataURL() { this.result = 'data:text/plain;base64,aGk='; this.onload(); }
  }
  const { directives, errors } = await openRepairBrowser('/media', async () => [], { FileReader });
  const upload = directives.ftpFileUpload({ post: async () => { throw new Error('Upload denied'); } }, () => () => {});
  const scope = { directory: { id: '/media', uploading: true }, attrs: {}, $parent: { getChildren() { assert.fail('refresh on failure'); } } };
  upload.controller(scope);
  const event = { target: { files: [{ name: 'a.txt' }], value: 'file' } };
  await scope.uploadFiles(event);
  assert.deepEqual(errors, ['Upload denied']);
  assert.equal(scope.directory.uploading, true);
  assert.equal(event.target.value, '');
});

test('API readiness is false until mandatory initialization has completed', async () => {
  const api = loadModule('api.js', { homey: {} });
  for (const apiReady of [undefined, false, true]) {
    assert.deepEqual(await api.apiReady({ homey: { app: { apiReady } } }), { ready: apiReady === true });
  }
});

test('getFile returns the downloaded bytes unchanged, including non-UTF-8 data', async () => {
  const Driver = loadDriver();
  const driver = new Driver();
  const bytes = Buffer.from([0xff, 0x00, 0xc3, 0x28, 0x80]);
  const device = { ftpClient: {
    exec: async ({ action, createTransferStream }) => {
      assert.equal(action, 'downloadTo');
      const stream = createTransferStream();
      assert.ok(stream instanceof Writable);
      await new Promise(resolve => stream.write(bytes.subarray(0, 2), resolve));
      await new Promise(resolve => stream.end(bytes.subarray(2), resolve));
    },
    refresh: async () => assert.fail('Downloads should reuse the established FTP connection')
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
    flow: { getActionCard: card, getConditionCard: card },
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

test('the files JSON Flow token contains root-relative paths instead of physical picker IDs', async () => {
  const Driver = loadDriver({ BL: { _: { map: (items, select) => items.map(select) } } });
  const driver = new Driver();
  const listeners = {};
  driver.log = driver.error = () => {};
  const card = id => ({
    registerRunListener(listener) { listeners[id] = listener; },
    getArgument: () => ({ registerAutocompleteListener() {} })
  });
  driver.homey = { app: {}, flow: { getActionCard: card, getConditionCard: card } };
  await driver.onInit();
  driver.getFiles = async () => [{ id: '/configured/private/path/exports/log.csv', name: 'exports/log.csv' }];
  const result = await listeners.action_ftpclient_get_files({ directory: { isDirectory: true }, device: {} });
  assert.deepEqual(JSON.parse(result.files), ['exports/log.csv']);
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
    __: key => key,
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
  assert.deepEqual(views, ['root_directory']);
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
  const result = await handlers.login({ username: 'user', password: 'secret' });
  return { driver, handlers, result };
}

test('pairing rejects a login that fails both without and with encryption', async () => {
  const { attempts, FtpClient } = loginAttempts(() => false);
  const { driver, result } = await pairLogin(FtpClient);
  assert.equal(result, false);
  assert.equal(driver.isConnected, undefined);
  assert.deepEqual(attempts, [{ secure: true, allowIncorrectCertificate: false }, { secure: false, allowIncorrectCertificate: false }]);
});

test('pairing accepts a login that only works with encryption and stores it as secure', async () => {
  const { attempts, FtpClient } = loginAttempts(attempt => attempt.secure);
  const { handlers, result } = await pairLogin(FtpClient);
  assert.equal(result, true);
  assert.equal(attempts.length, 1);
  assert.equal(await handlers.getRootDirectory(), '');
});

test('pairing falls back to plain FTP and persists connection and validated root on the selected device', async () => {
  const attempts = [];
  let closed = 0;
  class FtpClient {
    init(settings) { this.settings = settings; }
    async exec() {
      attempts.push({ ...this.settings });
      if (this.settings.secure) throw new Error('TLS unavailable');
      if (this.settings.workdirectory === '/missing') throw new Error('550 Missing folder');
      return [];
    }
    close() { closed++; }
  }
  const Driver = loadDriver({ FtpClient });
  const driver = new Driver();
  driver.error = () => {};
  driver.homey = { __: key => key };
  const handlers = {}, views = [];
  await driver.onPair({ setHandler(name, handler) { handlers[name] = handler; }, showView: view => views.push(view) });
  await handlers.list_devices_selection([{ name: 'FTP Client', data: { id: 'custom' }, custom: true }]);
  await handlers.showView('loading_credentials');
  assert.deepEqual(views, ['connection']);
  await assert.rejects(handlers.setConnectionSettings({ ip: '', port: 0 }), /invalidConnection/);
  await handlers.setConnectionSettings({ ip: ' ftp.example.test ', port: 2121 });
  await assert.rejects(handlers.setRootDirectory('/media'), /loginRequired/);
  assert.equal(await handlers.login({ username: 'user', password: 'test-password' }), true);
  assert.deepEqual(attempts.map(attempt => attempt.secure), [true, false]);
  await assert.rejects(handlers.setRootDirectory('/missing'), /550/);
  assert.equal(await handlers.getRootDirectory(), '');
  const device = await handlers.setRootDirectory('/media/My files///');
  assert.equal(device.settings.workdirectory, '/media/My files');
  assert.equal(device.settings.secure, false);
  assert.equal(device.settings.ip, 'ftp.example.test');
  assert.equal(device.settings.username, 'user');
  assert.equal(device.settings.password, 'test-password');
  assert.equal(closed, 3);
  assert.equal(driver.username, undefined);
});

test('Flow pickers start at the configured root, preserve rooted selections and never offer its parent', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { __: translate, app: { ip: '192.0.2.1' } };
  for (const root of ['/media/My files', 'media/My files']) {
    const calls = [];
    const device = { settings: { workdirectory: root + '/' }, ftpClient: {
      exec: async (options, path) => { calls.push(path); return [{ name: 'photos', isDirectory: true }]; }
    } };
    const top = await driver.getFiles({ device, query: '' });
    assert.deepEqual(top.map(file => file.id), [root + '/photos']);
    assert.deepEqual(top.map(file => [file.name, file.description]), [['photos', '']]);
    const child = await driver.getFiles({ device, file: top[0] });
    assert.equal(child[0].id, root);
    assert.equal(child[0].name, '/');
    assert.equal(child[1].name, 'photos/photos');
    assert.equal(child[1].description, 'photos');
    await driver.getFiles({ device, query: 'photos' });
    await driver.getFiles({ device, query: '/other' });
    assert.deepEqual(calls, [root, root + '/photos', root + '/photos', root + '/other']);
    await assert.rejects(driver.getFiles({ device, query: '../outside' }), /outsideRoot/);
  }
});

test('Flow file saves resolve text paths under the root and do not upload when folder creation fails', async () => {
  const Driver = loadDriver();
  const driver = new Driver();
  driver.homey = {};
  const calls = [];
  const device = { settings: { workdirectory: '/media/root' }, reportTransferError: async () => {}, ftpClient: {
    exec: async ({ action }, ...args) => { calls.push([action, ...args]); }
  } };
  for (const path of ['exports/log.csv', '/exports/log.csv', '/media/root/exports/log.csv']) {
    await driver.saveFile({ device, path, buffer: Buffer.from('test') });
  }
  assert.deepEqual(calls.filter(([action]) => action === 'ensureDir'), Array(3).fill(['ensureDir', '/media/root/exports']));
  assert.deepEqual(calls.filter(([action]) => action === 'uploadFrom').map(call => call[2]), Array(3).fill('/media/root/exports/log.csv'));
  device.ftpClient.exec = async () => { throw new Error('550 Permission denied'); };
  await assert.rejects(driver.saveFile({ device, path: 'exports/fail.csv', buffer: Buffer.from('test') }), /550/);
});

test('repair selects distinct supported file icons and handles case, compound names and unknown types', async () => {
  const { directives } = await openRepairBrowser('', async () => []);
  const scope = {};
  directives.ftpFile().link(scope);
  for (const [filename, icon] of Object.entries({
    'track.FLAC': 'audio', 'clip.webm': 'video', 'photo.avif': 'image', 'backup.tar.gz': 'archive',
    'document.odt': 'word', 'sheet.xlsm': 'excel', 'slides.odp': 'powerpoint', 'component.tsx': 'code',
    'report.tsv': 'csv', 'README': 'alt', 'signed.p7s': 'signature', 'scan.dicom': 'medical',
    'script.ts': 'code', '.gitignore': 'code'
  })) assert.equal(scope.getFileIcon({ name: filename }).glyph, 'fa-file-' + icon, filename);
  for (const name of ['unknown.xyz', 'file', 'old-typo.bpm', 'trailing.']) assert.equal(scope.getFileIcon({ name }).glyph, 'fa-file');
});

test('Flow pickers serve a distinct packaged icon for every Repair file category', async () => {
  const examples = {
    'track.FLAC': 'audio.png', 'clip.webm': 'video.png', 'photo.avif': 'image.png',
    'backup.tar.gz': 'zip.png', 'document.odt': 'doc.png', 'sheet.xlsm': 'xls.png',
    'slides.odp': 'ppt.png', '.gitignore': 'xml.png', 'report.tsv': 'file-csv.svg',
    'README': 'txt.png', 'document.pdf': 'pdf.png', 'signed.p7s': 'file-signature.svg',
    'scan.dicom': 'file-medical.svg', 'unknown.xyz': 'file.png'
  };
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, last: list => list.at(-1), each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { __: translate, app: { ip: '192.0.2.1' } };
  const files = await driver.getFiles({
    device: {
      settings: { workdirectory: 'media.v1' },
      ftpClient: { exec: async () => Object.keys(examples).map(name => ({ name, isFile: true })) }
    }
  });
  assert.deepEqual(Object.fromEntries(files.map(({ name, image }) => [name, path.posix.basename(new URL(image).pathname)])), examples);
  assert.equal(new Set(files.map(({ image }) => image)).size, Object.keys(examples).length);
  for (const { image } of files) {
    const asset = new URL(image).pathname.split('/assets/icons/ext/')[1];
    const bytes = fs.readFileSync(path.join(__dirname, '../drivers/ftpconnection/assets/icons/ext', asset));
    if (asset.endsWith('.png')) {
      assert.ok(asset.startsWith('48x48/'), asset);
      assert.equal(bytes.readUInt32BE(16), 48, asset);
      assert.equal(bytes.readUInt32BE(20), 48, asset);
    }
  }
});

test('every dedicated extension image is selectable in a Flow and has a matching custom Repair badge', async () => {
  const assetFolder = path.resolve(__dirname, '../drivers/ftpconnection/assets/icons/ext');
  const examples = {};
  const sharedAssets = new Set(['audio', 'file', 'folder', 'image', 'video']);
  for (const filename of fs.readdirSync(path.join(assetFolder, '48x48'))) {
    const extension = /^([a-z0-9]+)\.png$/.exec(filename)?.[1];
    if (extension && !sharedAssets.has(extension)) {
      examples[`sample.${extension.toUpperCase()}`] = `48x48/${filename}`;
    }
  }
  Object.assign(examples, {
    'default.CFG': '48x48/config.png', 'index.ASPX': '48x48/asp.png',
    'photo.JPEG': '48x48/jpg.png', 'animation.MPEG': '48x48/mpg.png'
  });
  const { directives } = await openRepairBrowser('', async () => []);
  const scope = {};
  directives.ftpFile().link(scope);
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, last: list => list.at(-1), each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { __: translate, app: { ip: '192.0.2.1' } };
  const files = await driver.getFiles({
    device: { settings: {}, ftpClient: { exec: async () => Object.keys(examples).map(name => ({ name, isFile: true })) } }
  });
  assert.deepEqual(Object.fromEntries(files.map(({ name, image }) => [name, new URL(image).pathname.split('/assets/icons/ext/')[1]])), examples);
  for (const { name } of files) {
    const { label, glyph } = scope.getFileIcon({ name });
    const extension = name.split('.').at(-1);
    assert.equal(label, extension === 'CONFIG' ? 'CFG' : extension);
    assert.equal(glyph, undefined, name);
  }
});

test('dialogs focus inputs, trap keyboard focus, cancel with Escape and clean up on close', async () => {
  const previous = { isConnected: true, focus() { focused = previous; } };
  let focused = previous, destroy, scheduled, removed, cancelled = false, listener;
  const input = { getClientRects: () => [1], focus() { focused = input; } };
  const cancel = { getClientRects: () => [1], focus() { focused = cancel; } };
  const confirm = { getClientRects: () => [1], focus() { focused = confirm; } };
  const document = { body: {}, get activeElement() { return focused; } };
  const { directives } = await openRepairBrowser('', async () => [], { document });
  const timeout = callback => { scheduled = callback; return 'timer'; };
  timeout.cancel = task => { assert.equal(task, 'timer'); cancelled = true; };
  const node = {
    querySelector: selector => selector === 'input' ? input : cancel,
    querySelectorAll: () => [input, cancel, confirm],
    addEventListener(event, handler) { listener = handler; },
    removeEventListener(event, handler) { removed = handler; }
  };
  let escaped;
  directives.ftpDialog(timeout).link({
    $on(event, callback) { destroy = callback; },
    $apply: callback => callback(),
    $eval(expression, locals) { escaped = [expression, locals.$event.key]; }
  }, [node], { ftpDialog: 'cancel($event)' });
  scheduled();
  assert.equal(focused, input);
  let prevented = 0;
  const key = (key, shiftKey = false) => listener({ key, shiftKey, preventDefault() { prevented++; }, stopPropagation() {} });
  key('Tab', true);
  assert.equal(focused, confirm);
  key('Tab');
  assert.equal(focused, input);
  key('Escape');
  assert.deepEqual(escaped, ['cancel($event)', 'Escape']);
  assert.equal(prevented, 3);
  destroy();
  assert.equal(removed, listener);
  assert.equal(cancelled, true);
  assert.equal(focused, previous);
});

test('the folder pickers list the folder that is selected on the card', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, filter: (list, fn) => list.filter(fn), each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  const autocompletes = {};
  driver.log = driver.error = () => {};
  driver.homey = {
    __: translate,
    app: { ip: '192.0.2.1' },
    flow: { getConditionCard: () => ({ registerRunListener() {} }), getActionCard: id => ({
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
  driver.homey = { __: translate, app: { ip: '192.0.2.1' } };
  const entries = [{ name: 'photo.jpg', isFile: true, isDirectory: false }, { name: 'archive', isFile: false, isDirectory: true }];
  const files = await driver.getFiles({ type: 'folder', includeDiretories: false, device: { settings: {}, ftpClient: { exec: async () => entries } } });
  assert.deepEqual(files.map(file => file.name), ['archive']);
  assert.equal(Array.prototype.contains, undefined);
  assert.equal(String.prototype.contains, undefined);
});

test('Flow picker images honor the selected connection and default to Local (SSL)', async () => {
  const Driver = loadDriver({ BL: { _: { orderBy: list => list, last: list => list[list.length - 1], each: (list, fn) => list.forEach(fn) } } });
  const driver = new Driver();
  driver.homey = { __: translate, app: { ip: '192.0.2.1', cloudId: 'cloud' } };
  const iconHost = async urlforicons => {
    const files = await driver.getFiles({ device: { settings: { urlforicons }, ftpClient: { exec: async () => [
      { name: 'docs', isFile: false, isDirectory: true },
      { name: 'photo.png', isFile: true, isDirectory: false }
    ] } } });
    for (const file of files) assert.equal(new URL(file.image).protocol, urlforicons === 'local' ? 'http:' : 'https:');
    assert.ok(files[0].image.endsWith('/48x48/folder.png'));
    assert.ok(files[1].image.endsWith('/48x48/png.png'));
    return new URL(files[0].image).origin;
  };
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../drivers/ftpconnection/driver.compose.json'), 'utf8'));
  const setting = manifest.settings.find(setting => setting.id === 'urlforicons');
  assert.equal(setting.value, 'localssl');
  assert.equal(await iconHost(setting.value), 'https://192-0-2-1.homey.homeylocal.com');
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
    exec: ({ createTransferStream }) => new Promise(resolve => createTransferStream().end(Buffer.from('content'), resolve)),
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

test('device initialization and settings changes apply the root to subsequent FTP commands', async () => {
  const Device = loadModule('drivers/ftpconnection/device.js', { homey: { Device: class {} } });
  const FtpClient = require('../lib/ftp-client');
  const device = new Device();
  device.homey = { error() {} };
  device.ftpClient = new FtpClient();
  const paths = [];
  device.ftpClient.getClient = async () => ({ cd: async () => {}, list: async path => { paths.push(path); } });
  device.getSettings = async () => ({ workdirectory: '/original' });
  await device.init();
  await device.ftpClient.getList();
  await device.onSettings({ newSettings: { workdirectory: '/changed' } });
  await device.ftpClient.getList();
  assert.deepEqual(paths, ['/original', '/changed']);
});

function monitoredDevice() {
  const probes = [], timers = new Map(), triggers = [], capabilities = new Map();
  class FtpClient {
    init(options) { this.options = options; }
    exec(command) {
      return new Promise((resolve, reject) => {
        this.reject = reject;
        probes.push({ client: this, command, resolve, reject });
      });
    }
    close() {
      if (this.reject) this.reject(new Error('closed'));
    }
  }
  const Device = loadModule('drivers/ftpconnection/device.js', {
    homey: { Device: class {} }, '../../lib/ftp-client': FtpClient
  });
  const device = new Device();
  device.homey = {
    __: translate,
    setTimeout(callback, delay) {
      const id = Symbol();
      timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    flow: { getDeviceTriggerCard: id => ({ async trigger(target, tokens) {
      assert.equal(target, device);
      triggers.push([id, tokens]);
    } }) }
  };
  device.getStoreValue = () => 'ftp-device';
  device.getSettings = () => ({ ip: 'ftp.example.test', workdirectory: '/configured/folder' });
  device.hasCapability = id => capabilities.has(id);
  device.addCapability = async id => { capabilities.set(id, null); };
  device.getCapabilityValue = id => capabilities.get(id);
  device.setCapabilityValue = async (id, value) => { capabilities.set(id, value); };
  device.error = () => {};
  return { device, probes, timers, triggers, capabilities };
}

test('FTP status uses the configured root, shares an in-flight check and confirms outages before firing', async () => {
  const { device, probes, timers, triggers, capabilities } = monitoredDevice();
  await device.onInit();
  assert.equal(capabilities.get('ftp_status'), 'checking');
  assert.equal(device.hasTransferError(), false);
  assert.deepEqual(probes[0].command, { action: 'list', oneTry: true });
  assert.equal(probes[0].client.options.workdirectory, '/configured/folder');
  assert.notEqual(probes[0].client, device.ftpClient);
  const startup = device.checkConnection();
  assert.equal(device.checkConnection(), startup);
  probes[0].resolve([]);
  assert.equal(await startup, true);
  assert.equal(device.isFtpReady(), true);
  assert.equal([...timers.values()][0].delay, 300000);

  [...timers.values()][0].callback();
  const firstFailure = device.checkConnection();
  probes[1].reject(new Error('offline'));
  assert.equal(await firstFailure, false);
  assert.equal(device.isFtpReady(), true);
  assert.equal([...timers.values()][0].delay, 15000);
  [...timers.values()][0].callback();
  const secondFailure = device.checkConnection();
  probes[2].reject(new Error('offline again'));
  assert.equal(await secondFailure, false);
  assert.equal(capabilities.get('ftp_status'), 'unavailable');
  assert.equal(device.hasTransferError(), false);

  const recovery = device.checkConnection();
  probes[3].resolve([]);
  await recovery;
  assert.deepEqual(triggers.map(([id]) => id), ['ftp_became_ready', 'ftp_became_unavailable', 'ftp_became_ready']);
  const pending = device.checkConnection();
  device.onUninit();
  assert.equal(await pending, false);
  assert.equal(timers.size, 0);
});

test('changing the FTP root cancels a stale check and keeps an existing transfer alarm', async () => {
  const { device, probes, triggers, capabilities } = monitoredDevice();
  capabilities.set('alarm_ftp_transfer', true);
  await device.onInit();
  const stale = device.checkConnection();
  await device.onSettings({ newSettings: { workdirectory: '/different' }, changedKeys: ['workdirectory'] });
  assert.equal(await stale, false);
  assert.deepEqual(triggers, []);
  assert.equal(probes[1].client.options.workdirectory, '/different');
  assert.equal(device.hasTransferError(), true);
  device.onUninit();
});

test('changing the status check interval reschedules polling without restarting FTP or delaying an outage retry', async () => {
  const { device, probes, timers, capabilities } = monitoredDevice();
  await device.onInit();
  const startup = device.checkConnection();
  probes[0].resolve([]);
  await startup;
  const changeInterval = status_poll_minutes => device.onSettings({
    newSettings: { ...device.settings, status_poll_minutes },
    changedKeys: ['status_poll_minutes']
  });
  await changeInterval(2);
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [120000]);
  assert.equal(probes.length, 1);
  assert.equal(capabilities.get('ftp_status'), 'ready');
  const failure = device.checkConnection();
  probes[1].reject(new Error('offline'));
  await failure;
  await changeInterval(7);
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [15000]);
  [...timers.values()][0].callback();
  const confirmation = device.checkConnection();
  probes[2].reject(new Error('still offline'));
  await confirmation;
  assert.equal(capabilities.get('ftp_status'), 'unavailable');
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [420000]);
  device.onUninit();
});

test('each failed transfer triggers once, leaves the original error intact and latches until cleared', async () => {
  const { device, triggers, capabilities } = monitoredDevice();
  device.settings = device.getSettings();
  capabilities.set('ftp_status', 'ready');
  const Driver = loadDriver();
  const driver = new Driver();
  driver.homey = device.homey;
  driver.error = () => {};
  const failure = Object.assign(new Error('550 Permission denied: /configured/folder/file'), { code: 550 });
  device.ftpClient = { exec: async ({ action }) => { assert.equal(action, 'ensureDir'); throw failure; } };
  await assert.rejects(driver.saveFile({ device, path: 'exports/example.txt', buffer: Buffer.from('sample') }), error => error === failure);
  await assert.rejects(driver.runTransfer(device, 'download', '/configured/folder/example.txt', async () => { throw failure; }), error => error === failure);
  assert.equal(device.hasTransferError(), true);
  assert.equal(device.isFtpReady(), true);
  assert.deepEqual(triggers, [
    ['ftp_transfer_failed', { operation: 'monitor.upload', path: 'exports/example.txt', reason: 'monitor.transferFailed (550)' }],
    ['ftp_transfer_failed', { operation: 'monitor.download', path: 'example.txt', reason: 'monitor.transferFailed (550)' }]
  ]);
  assert.equal(await driver.runTransfer(device, 'upload', 'ok.txt', async () => 'success'), 'success');
  assert.equal(device.hasTransferError(), true);
  await device.clearTransferError();
  assert.equal(device.hasTransferError(), false);
});

test('a download retry discards partial bytes and only reports failure if both attempts fail', async () => {
  const Driver = loadDriver();
  const driver = new Driver();
  driver.error = () => {};
  const FtpClient = require('../lib/ftp-client');
  const ftpClient = new FtpClient();
  ftpClient.init({ homey: { error() {} }, workdirectory: '/configured/folder' });
  let attempts = 0, terminal = false, reports = 0;
  const error = new Error('transfer interrupted');
  ftpClient.getClient = async () => ({
    cd: async () => {},
    async downloadTo(stream, path) {
      assert.equal(path, '/configured/folder/file.txt');
      const fail = terminal || ++attempts === 1;
      await new Promise(resolve => stream.end(Buffer.from(fail ? 'partial' : 'complete'), resolve));
      if (fail) throw error;
    }
  });
  const device = { ftpClient, async reportTransferError() { reports++; } };
  assert.equal((await driver.getFile({ file: { id: 'file.txt' }, device })).buffer.toString(), 'complete');
  assert.equal(reports, 0);
  terminal = true;
  await assert.rejects(driver.getFile({ file: { id: 'file.txt' }, device }), err => err === error);
  assert.equal(reports, 1);
});

test('an upload retry sends the complete payload again after the first stream is consumed', async () => {
  const Driver = loadDriver();
  const FtpClient = require('../lib/ftp-client');
  const ftpClient = new FtpClient();
  ftpClient.init({ homey: { error() {} }, workdirectory: '/configured/folder' });
  const received = [];
  ftpClient.getClient = async () => ({
    cd: async () => {},
    async uploadFrom(stream, path) {
      assert.equal(path, '/configured/folder/file.bin');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      received.push(Buffer.concat(chunks));
      if (received.length === 1) throw new Error('transfer interrupted');
    }
  });
  const payload = Buffer.from([0, 0x80, 0xff]);
  await new Driver().uploadBuffer({ ftpClient }, 'file.bin', payload);
  assert.deepEqual(received, [payload, payload]);
});

test('the monitoring Flow conditions and actions reflect status and acknowledge the alarm', async () => {
  const { device, capabilities } = monitoredDevice();
  const Driver = loadDriver();
  const driver = new Driver();
  driver.log = driver.error = () => {};
  const cards = {};
  const getCard = id => ({
    registerRunListener(listener) { cards[id] = listener; },
    getArgument: () => ({ registerAutocompleteListener() {} })
  });
  driver.homey = { __: translate, app: {}, flow: { getActionCard: getCard, getConditionCard: getCard } };
  await driver.onInit();
  capabilities.set('ftp_status', 'ready');
  capabilities.set('alarm_ftp_transfer', true);
  assert.equal(cards.ftp_is_ready({ device }), true);
  assert.equal(cards.ftp_transfer_error_active({ device }), true);
  assert.equal(await cards.ftp_clear_transfer_error({ device }), true);
  assert.equal(cards.ftp_transfer_error_active({ device }), false);
  device.checkConnection = async () => false;
  await assert.rejects(cards.ftp_check_connection({ device }), /monitor.connectionFailed/);
  device.checkConnection = async () => true;
  assert.equal(await cards.ftp_check_connection({ device }), true);
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
