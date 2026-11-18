'use strict';

const assert = require('node:assert/strict');
const { inflateRawSync } = require('node:zlib');

function csvContainsMessage(text, message) {
  for (const delimiter of [',', ';', '\t']) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const character = text[i];
      if (character === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && (character === delimiter || character === '\n')) {
        row.push(cell.replace(/\r$/, ''));
        cell = '';
        if (character === '\n') { rows.push(row); row = []; }
      } else cell += character;
    }
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
    if (!quoted && rows[0].length > 1 && rows.some(fields => fields.includes(message))) return true;
  }
  return false;
}

function readWorkbook(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0 && end + 22 <= buffer.length, 'Excel export must be a complete ZIP archive');
  const files = new Map();
  let offset = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP directory');
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameSize);
    assert.equal(buffer.readUInt32LE(local), 0x04034b50, 'Invalid ZIP file entry');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const compressed = buffer.subarray(start, start + size);
    assert.ok(method === 0 || method === 8, 'Unsupported ZIP compression');
    const content = method === 8 ? inflateRawSync(compressed, { maxOutputLength: 50 * 1024 * 1024 }) : compressed;
    assert.equal(content.length, buffer.readUInt32LE(offset + 24), 'Incomplete Excel file entry');
    files.set(name, content.toString('utf8'));
    offset += 46 + nameSize + extraSize + commentSize;
  }
  assert.ok(files.get('[Content_Types].xml')?.includes('spreadsheetml'), 'Missing Excel content types');
  assert.ok(files.has('xl/workbook.xml'), 'Missing Excel workbook');
  assert.ok(files.has('xl/worksheets/sheet1.xml'), 'Missing Excel worksheet');
  return files;
}

module.exports = async function testSslFtpExports({ homey, deviceId }) {
  const uri = 'homey:device:' + deviceId;
  const ssl = 'homey:app:nl.nielsdeklerk.log';
  async function run(owner, id, args) {
    const result = await homey.flow.runFlowCardAction({ uri: owner, id: owner + ':' + id, args });
    if (result.error) throw new Error(id + ': ' + JSON.stringify(result.error));
    return result.returnTokens;
  }
  const log = (message, severity = '6') => run(ssl, 'Input_group_log', {
    log: message, group: 'FTP Client', severity, facility: '16'
  });
  async function picker(id, name, query) {
    const items = await homey.flow.getFlowCardAutocomplete({ type: 'action', uri, id: uri + ':' + id, name, query, args: {} });
    assert.ok(Array.isArray(items), 'Expected actual FTP autocomplete selections');
    return items;
  }
  const device = await homey.devices.getDevice({ id: deviceId, $cache: false });
  assert.equal(device.driverId, 'homey:app:nl.qluster-it.FtpClient:ftpconnection', 'Expected an FTP Client device');
  const root = (device.settings.workdirectory || '').replace(/\/+$/, '');
  const directoryPath = (root ? root + '/' : '') + 'FTP Client tests';
  const directories = await picker('action_ftpclient_save_file_base64', 'directory', root);
  const directory = directories.find(item => item.id === directoryPath && item.isDirectory);
  assert.ok(directory, 'Create or reuse FTP Client tests inside the configured root before running');
  const marker = 'FTP SSL export regression ' + Date.now();
  const message = marker + ': caf\u00e9, "quoted"\nsecond line';
  const results = [];
  try {
    await log('START SSL CSV text/base64 and Excel exports to FTP');
    await log(message);
    for (const [returnType, filename] of [
      ['csv', 'ssl-log-csv-text.csv'],
      ['csv_base64', 'ssl-log-csv-base64.csv'],
      ['xlsx_base64', 'ssl-log.xlsx']
    ]) {
      const exported = await run(ssl, 'get_log', { returnType });
      assert.equal(typeof exported.log, 'string', 'SSL must return an export string');
      const buffer = Buffer.from(exported.log, returnType === 'csv' ? 'utf8' : 'base64');
      assert.ok(buffer.length > 0, 'SSL export must not be empty');
      if (returnType === 'xlsx_base64') {
        const workbook = readWorkbook(buffer);
        const cells = (workbook.get('xl/sharedStrings.xml') || '') + workbook.get('xl/worksheets/sheet1.xml');
        assert.ok(cells.includes(marker), 'Excel export must include this run\'s log entry');
      } else {
        assert.ok(csvContainsMessage(buffer.toString('utf8'), message), 'CSV must preserve UTF-8, commas, quotes and line breaks');
      }
      await run(uri, 'action_ftpclient_save_file_base64', {
        directory, path: filename, file: buffer.toString('base64')
      });
      const files = await picker('action_ftpconnection_get_url', 'file', directoryPath);
      const file = files.find(item => item.id === directoryPath + '/' + filename && item.isFile);
      assert.ok(file, 'Saved FTP export must appear in the actual file picker');
      const { url } = await run(uri, 'action_ftpconnection_get_url', { file });
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, 'Saved FTP export must be downloadable');
      const downloaded = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(downloaded, buffer, 'Downloaded FTP file must exactly match the exported bytes');
      results.push({ format: returnType, filename, bytes: buffer.length, verified: true });
      await log('PASS SSL ' + returnType + ' -> FTP ' + filename + ': ' + buffer.length + ' bytes verified');
    }
    return results;
  } catch (error) {
    try { await log('FAIL SSL export-to-FTP checks: ' + error.message, '3'); }
    catch (loggingError) { throw new AggregateError([error, loggingError], 'Export test and failure logging failed'); }
    throw error;
  }
};
