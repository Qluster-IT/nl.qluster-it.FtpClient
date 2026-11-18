'use strict';

const fs = require('fs/promises');
const { join } = require('path');
const { randomBytes } = require('crypto');

const CHUNK_BYTES = 192 * 1024;
const MAX_BYTES = 256 * 1024 * 1024;
const IDLE_MS = 2 * 60 * 1000;

module.exports = class UploadSpool {
    constructor(root, onError) {
        this.root = root;
        this.onError = onError;
        this.entries = new Map();
        this.used = 0;
    }

    async init() {
        await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
        for (const name of await fs.readdir(this.root)) {
            if (/^[0-9a-f]{48}$/.test(name)) await fs.unlink(join(this.root, name));
        }
    }

    async start({ size, upload, limitMessage }) {
        if (!Number.isSafeInteger(size) || size < 0 || this.used + size > MAX_BYTES || this.entries.size >= 16) {
            throw new Error(limitMessage);
        }
        const id = randomBytes(24).toString('hex');
        const entry = { id, size, bytes: 0, path: join(this.root, id), upload, busy: true };
        this.used += size;
        this.entries.set(id, entry);
        try {
            await fs.writeFile(entry.path, '', { flag: 'wx', mode: 0o600 });
        } catch (error) {
            this.entries.delete(id);
            this.used -= size;
            throw error;
        }
        this.idle(entry);
        return { id, chunkBytes: CHUNK_BYTES };
    }

    idle(entry) {
        entry.busy = false;
        entry.timer = setTimeout(() => {
            entry.busy = true;
            this.remove(entry).catch(this.onError);
        }, IDLE_MS);
        entry.timer.unref();
    }

    async remove(entry) {
        clearTimeout(entry.timer);
        try {
            await fs.unlink(entry.path);
        } finally {
            this.entries.delete(entry.id);
            this.used -= entry.size;
        }
    }

    async write({ id, offset, base64, cancel, status }, invalidMessage) {
        const entry = this.entries.get(id);
        if (status === true && entry?.transfer) {
            if (entry.busy) return { pending: true };
            const error = entry.error;
            entry.busy = true;
            await this.remove(entry);
            if (error) throw error;
            return { pending: false };
        }
        if (cancel === true && !entry) return {};
        if (!entry || entry.busy || (entry.transfer && cancel !== true)) throw new Error(invalidMessage);
        if (cancel !== true && (offset !== entry.bytes || typeof base64 !== 'string' ||
            base64.length > CHUNK_BYTES * 4 / 3 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) ||
            base64.length % 4 !== 0)) throw new Error(invalidMessage);
        clearTimeout(entry.timer);
        entry.busy = true;
        let retain = false;
        try {
            if (cancel === true) return {};
            const chunk = Buffer.from(base64, 'base64');
            if ((!chunk.length && entry.size !== 0) || entry.bytes + chunk.length > entry.size) {
                throw new Error(invalidMessage);
            }
            if (chunk.length) await fs.appendFile(entry.path, chunk);
            entry.bytes += chunk.length;
            if (entry.bytes === entry.size) {
                // The FTP leg may outlast Homey's HTTP request deadline.
                entry.transfer = Promise.resolve().then(() => entry.upload(entry.path))
                    .catch(error => { entry.error = error; })
                    .finally(() => this.idle(entry));
                return { pending: true };
            }
            retain = true;
            return {};
        } finally {
            if (!entry.transfer || cancel === true) {
                if (retain) this.idle(entry);
                else await this.remove(entry);
            }
        }
    }

    async close() {
        await Promise.all([...this.entries.values()].filter(entry => !entry.busy).map(entry => {
            entry.busy = true;
            return this.remove(entry);
        }));
    }
};
