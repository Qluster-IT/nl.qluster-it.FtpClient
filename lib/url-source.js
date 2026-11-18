'use strict';

const { PassThrough } = require('stream');

const TIMEOUT = 30_000;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function parse(value, base) {
    let url;
    try {
        if (typeof value !== 'string' || !value.trim()) throw new TypeError();
        url = new URL(value.trim(), base);
    } catch {
        throw new Error('Enter a valid HTTP, HTTPS, or FTP source URL.');
    }
    if (!url.hostname || !['http:', 'https:', 'ftp:'].includes(url.protocol)) {
        throw new Error('Enter a valid HTTP, HTTPS, or FTP source URL.');
    }
    return url;
}

function request(url) {
    return new Promise((resolve, reject) => {
        const failed = () => reject(new Error('Could not connect to the HTTP source or receive its response.'));
        try {
            const transport = url.protocol === 'https:' ? require('https') : require('http');
            const req = transport.get(url, { agent: false, rejectUnauthorized: true }, res => {
                clearTimeout(timer);
                resolve(res);
            });
            const timer = setTimeout(() => req.destroy(new Error('Source request timed out.')), TIMEOUT);
            req.on('error', () => {
                clearTimeout(timer);
                failed();
            });
            req.setTimeout(TIMEOUT, () => req.destroy(new Error('Source request timed out.')));
        } catch {
            failed();
        }
    });
}

async function* readHttp(url) {
    for (let redirects = 0; ; redirects++) {
        const res = await request(url);
        try {
            if (REDIRECTS.has(res.statusCode)) {
                if (!res.headers.location || redirects === 5) throw new Error('Source HTTP redirect limit reached or redirect is missing a location.');
                const next = parse(res.headers.location, url);
                if (!['http:', 'https:'].includes(next.protocol) ||
                    (next.origin !== url.origin && (next.username || next.password))) {
                    throw new Error('Unsupported source HTTP redirect.');
                }
                url = next;
                continue;
            }
            if (res.statusCode !== 200) throw new Error(`Source server returned HTTP ${res.statusCode}.`);
            try {
                yield* res;
                if (!res.complete) throw new Error();
            } catch {
                throw new Error('The HTTP source download was interrupted.');
            }
            return;
        } finally {
            res.destroy();
        }
    }
}

function ftpOptions(url) {
    let user, password, path;
    try {
        user = decodeURIComponent(url.username);
        password = decodeURIComponent(url.password);
        path = decodeURIComponent(url.pathname);
    } catch {
        throw new Error('Invalid FTP source URL encoding.');
    }
    if (!path || path.endsWith('/') || [user, password, path].some(value => /[\r\n\0]/.test(value))) {
        throw new Error('Enter an FTP source URL pointing to a file.');
    }
    return {
        path,
        access: {
            host: url.hostname.replace(/^\[|\]$/g, ''),
            port: Number(url.port) || 21,
            ...(user || password ? { user, password } : {})
        }
    };
}

async function* readFtp({ access, path }) {
    const { Client } = require('basic-ftp');
    const client = new Client(TIMEOUT, { allowSeparateTransferHost: false });
    const stream = new PassThrough();
    const download = (async () => {
        try {
            await client.access(access);
            await client.downloadTo(stream, path);
            return true;
        } catch {
            stream.end();
            return false;
        }
    })();
    try {
        yield* stream;
        if (!await download) throw new Error('Could not download the file from the FTP source.');
    } finally {
        client.close();
        stream.destroy();
    }
}

module.exports = function createUrlSource(value) {
    const url = parse(value);
    if (url.protocol === 'ftp:') {
        const options = ftpOptions(url);
        return () => readFtp(options);
    }
    return () => readHttp(url);
};
