"use strict";

const Homey = require('homey');


module.exports = {
    async apiReady({ homey }) {
        return { ready: homey.app.apiReady === true };
    },
    async uploadFiles({ homey, body: { directory, files, id } }) {
        console.log(directory);
        let r = await homey.drivers.getDriver('ftpconnection').fileUploads[id].upload({ directory, files });
        return r;
    },
    async uploadFilePartials({ homey, body: { directory, partial, id, lastPart } }) {
        console.log(directory);
        const fileUploads = homey.drivers.getDriver('ftpconnection').fileUploads;
        let obj = fileUploads[id];
        if (!obj.partial) obj.partial = partial;
        else obj.partial += partial;
        if (!lastPart) return true;
        try {
            let files = JSON.parse(obj.partial);
            delete obj.partial;
            return await obj.upload({ directory, files });
        } finally {
            delete fileUploads[id];
        }
    },
};