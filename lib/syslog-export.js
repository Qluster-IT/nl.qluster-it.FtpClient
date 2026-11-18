'use strict';

const https = require('https');

async function openExport(homey, format) {
    if (!['csv', 'xlsx', 'json'].includes(format)) throw new Error('Unsupported Simple (Sys) Log export format.');
    const app = homey.api.getApiApp('nl.nielsdeklerk.log');
    if (!await app.getInstalled()) throw new Error('Simple (Sys) Log is not running.');
    let link, timer, notify;
    const early = new Map();
    const listener = (event, data) => {
        if (!data || !['downloadFileReady', 'downloadFileFailed'].includes(event)) return;
        if (!link) early.set(data.token, event);
        else if (data.token === link.token) notify(event);
    };
    const ready = new Promise(resolve => { notify = resolve; });
    app.on('realtime', listener);
    try {
        link = await app.get(`/getlogdownloadurl/${format}`);
        if (!link || typeof link.token !== 'string' || !/^[0-9a-f]{48}$/.test(link.token) ||
            typeof link.filename !== 'string' || !link.filename || /[/\\\0]/.test(link.filename) ||
            link.filename === '.' || link.filename === '..') {
            throw new Error('Simple (Sys) Log did not provide a valid export link.');
        }
        timer = setTimeout(() => notify('timeout'), 45_000);
        const event = early.get(link.token) || await ready;
        if (event === 'timeout') throw new Error('Simple (Sys) Log did not finish preparing the export in time.');
        if (event !== 'downloadFileReady') throw new Error('Simple (Sys) Log could not prepare the export.');
    } finally {
        clearTimeout(timer);
        app.off('realtime', listener);
    }

    // The ready event is required: BLL can expose its file while it is still being written.
    const ip = (await homey.cloud.getLocalAddress()).split(':')[0];
    const url = `https://${ip.replace(/\./g, '-')}.homey.homeylocal.com/app/net.i-dev.betterlogic/userdata/getfile/${link.token}/${encodeURIComponent(link.filename)}`;
    return () => new Promise((resolve, reject) => {
        const request = https.get(url, response => {
            if (response.statusCode === 200) return resolve(response);
            response.destroy();
            reject(new Error(`Simple (Sys) Log export returned HTTP ${response.statusCode}.`));
        });
        request.on('error', reject);
        request.setTimeout(30_000, () => request.destroy(new Error('Simple (Sys) Log export request timed out.')));
    });
}

module.exports = openExport;
