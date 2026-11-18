'use strict';

const fs = require('fs/promises');
const path = require('path');
const { Writable } = require('stream');
const { finished } = require('stream/promises');

module.exports = class DownloadCache {
    constructor({ localRoot, sslRoot, maxBytes = 256 * 1024 * 1024 }) {
        this.localRoot = localRoot;
        this.sslRoot = sslRoot;
        this.maxBytes = maxBytes;
        this.usedBytes = 0;
    }

    async init() {
        for (const root of [this.localRoot, this.sslRoot]) {
            await fs.mkdir(root, { recursive: true, mode: root === this.sslRoot ? 0o755 : 0o700 });
            for (const name of await fs.readdir(root)) {
                if (/^[0-9a-f]{48}$/.test(name)) await fs.rm(path.join(root, name), { recursive: true, force: true });
            }
        }
    }

    async download({ id, name, ssl, transfer, limitMessage }) {
        const directory = path.join(ssl ? this.sslRoot : this.localRoot, id);
        const entry = { directory, path: path.join(directory, name), size: 0 };
        await fs.mkdir(directory, { mode: ssl ? 0o755 : 0o700 });
        try {
            const handle = await fs.open(entry.path, 'wx', ssl ? 0o644 : 0o600);
            let stream;
            let closed = Promise.resolve();
            try {
                const reset = async () => {
                    if (!entry.size) return;
                    await handle.truncate(0);
                    this.usedBytes -= entry.size;
                    entry.size = 0;
                };
                const write = async chunk => {
                    if (this.usedBytes + chunk.length > this.maxBytes) {
                        throw Object.assign(new Error(limitMessage), { code: 'FTP_DOWNLOAD_CACHE_FULL' });
                    }
                    const start = entry.size;
                    this.usedBytes += chunk.length;
                    entry.size += chunk.length;
                    for (let offset = 0; offset < chunk.length;) {
                        const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, start + offset);
                        if (!bytesWritten) throw new Error('Temporary file write did not advance');
                        offset += bytesWritten;
                    }
                };
                await transfer(() => {
                    if (stream) stream.destroy();
                    const previousClosed = closed;
                    let pending = Promise.resolve();
                    stream = new Writable({
                        construct(callback) {
                            pending = previousClosed.then(reset);
                            pending.then(() => callback(), callback);
                        },
                        write(chunk, encoding, callback) {
                            pending = write(chunk);
                            pending.then(() => callback(), callback);
                        },
                        destroy(error, callback) {
                            pending.then(() => callback(error), writeError => callback(error || writeError));
                        }
                    });
                    closed = new Promise(resolve => stream.once('close', resolve));
                    return stream;
                });
                if (stream) await finished(stream);
            } finally {
                if (stream) stream.destroy();
                await closed;
                await handle.close();
            }
            return entry;
        } catch (error) {
            try {
                await this.remove(entry);
            } catch (cleanupError) {
                error.cleanupError = cleanupError;
            }
            throw error;
        }
    }

    async remove(entry) {
        await fs.rm(entry.directory, { recursive: true, force: true });
        this.usedBytes -= entry.size;
        entry.size = 0;
    }
};
