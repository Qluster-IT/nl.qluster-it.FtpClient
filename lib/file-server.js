'use strict';

const http = require('http');
const { createReadStream } = require('fs');
const { pipeline } = require('stream');

module.exports = class FileServer {
  close() {
    if (this.server) this.server.close();
    this.server = null;
  }

  init(homey) {
    const driver = homey.drivers.getDriver('ftpconnection');
    this.server = http.createServer((req, res) => {
      const finish = status => { res.writeHead(status); res.end(); };
      if (req.headers?.host !== `${homey.app.ip}:47335`) return finish(404);
      if (req.url.startsWith('/status')) return finish(200);
      const id = /^\/file\/([0-9a-f]{48})$/.exec(req.url)?.[1];
      const file = id && driver.fileDownloads?.[id];
      if (!file?.local || (req.method !== 'GET' && req.method !== 'HEAD')) return finish(404);
      const { size } = file;
      const stream = createReadStream(file.path);
      stream.once('error', error => {
        if (!res.headersSent && !res.destroyed) finish(404);
        if (error.code !== 'ENOENT') homey.error('Could not read temporary download', error);
      });
      stream.once('open', () => {
        if (res.destroyed) return stream.destroy();
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': size
        });
        if (req.method === 'HEAD') {
          stream.destroy();
          return res.end();
        }
        pipeline(stream, res, error => {
          if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') homey.error('Could not serve temporary download', error);
        });
      });
    });
    this.server.on('error', error => homey.error('File server could not use port 47335', error));
    this.server.listen(47335);
  }
};
