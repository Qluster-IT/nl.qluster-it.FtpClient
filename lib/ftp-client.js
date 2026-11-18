// basic-ftp (with tls) is loaded on the first FTP connection.
let basicFtp;
const { getRootPath, resolvePath } = require('./ftp-paths');

module.exports = class FtpClient {
  init({ homey, ip, port, username, password, secure, allow_incorrect_certificate, workdirectory, timeout }) {
    if (homey) this.homey = homey;
    const root = getRootPath(workdirectory, this.homey.__ && this.homey.__.bind(this.homey));
    this.close();
    this.ip = ip;
    this.port = port;
    this.username = username;
    this.password = password;
    this.secure = secure;
    this.allow_incorrect_certificate = allow_incorrect_certificate;
    this.timeout = timeout;
    this.workdirectory = root;
  }

  async exec({ action, oneTry, createTransferStream }, a, b, c, d, e) {
    const args = [a, b, c, d, e];
    const pathArguments = {
      list: [0], cd: [0], ensureDir: [0], remove: [0], removeDir: [0],
      rename: [0, 1], uploadFrom: [1], downloadTo: [1]
    };
    const translate = this.homey.__ && this.homey.__.bind(this.homey);
    for (const index of pathArguments[action] || []) {
      args[index] = resolvePath(this.workdirectory, args[index], translate);
      if (this.workdirectory && args[index] === this.workdirectory &&
          ['remove', 'removeDir', 'rename', 'uploadFrom', 'downloadTo'].includes(action)) {
        throw new Error(translate ? translate('errors.rootProtected') : 'Choose a file or subfolder inside the configured root directory.');
      }
    }

    const generation = this.generation;
    const checkConnection = () => {
      if (this.generation !== generation) {
        throw new Error(translate ? translate('monitor.connectionFailed') : 'FTP connection was closed or reconfigured');
      }
    };
    const execute = async refresh => {
      checkConnection();
      const ftp = await this.getClient({ refresh });
      checkConnection();
      if (action !== 'features') await ftp.cd('/');
      checkConnection();
      if (createTransferStream) args[0] = createTransferStream();
      try {
        return await ftp[action](...args);
      } finally {
        if (action === 'uploadFrom' && createTransferStream) args[0].destroy();
      }
    };
    const result = (this._exec || Promise.resolve()).then(async () => {
      try {
        return await execute(false);
      } catch (error) {
        if (this.generation !== generation || oneTry || error.code === 'FTP_DOWNLOAD_CACHE_FULL') throw error;
        return execute(true);
      }
    });
    const tail = this._exec = result.then(() => {}, () => {});
    try {
      return await result;
    } finally {
      if (this._exec === tail) delete this._exec;
    }
  }

  downloadTo(a, b) {
    return this.exec({ action: 'downloadTo' }, a, b);
  }

  cd(a, b) {
    return this.exec({ action: 'cd' }, a, b);
  }

  getList({ path, oneTry } = {}) {
    return this.exec({ action: 'list', oneTry }, path);
  }

  getFeatures() {
    return this.exec({ action: 'features', oneTry: true });
  }

  // Only called inside the queue, so no command can run before access() finishes.
  async getClient({ refresh } = {}) {
    if (refresh || this.client?.closed) this.disconnect();
    if (this.client) return this.client;

    const client = this.client = new (basicFtp || (basicFtp = require('basic-ftp'))).Client(this.timeout);
    client.ftp.verbose = process.env.DEBUG === '1';
    try {
      await client.access({
        host: this.ip,
        port: this.port,
        user: this.username,
        password: this.password,
        secure: this.secure,
        secureOptions: { rejectUnauthorized: this.allow_incorrect_certificate !== true }
      });
      return client;
    } catch (error) {
      if (this.client === client) this.disconnect();
      throw error;
    }
  }

  disconnect() {
    const client = this.client;
    delete this.client;
    client?.close();
  }

  close() {
    this.generation = Symbol();
    this.disconnect();
  }
};
