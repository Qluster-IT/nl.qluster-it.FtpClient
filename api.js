"use strict";

const { BL } = require('betterlogiclibrary');
const Homey = require('homey');


module.exports = {
    async uploadFiles({ homey, body: { directory, files, id } }) {
        console.log(directory);
        let r = await homey.drivers.getDriver('ftpconnection').fileUploads[id].upload({ directory, files });
        return r;
    },
    async uploadFilePartials({ homey, body: { directory, partial, id, lastPart } }) {
        console.log(directory);
        let obj = homey.drivers.getDriver('ftpconnection').fileUploads[id];
        if (!obj.partial) obj.partial = partial;
        else obj.partial += partial;
        if (!lastPart) return true;
        let files = JSON.parse(obj.partial);
        delete obj.partial;
        let r = await homey.drivers.getDriver('ftpconnection').fileUploads[id].upload({ directory, files });
        return r;
    },
    async getDownloadUrl({ homey, body: { file } }) {
        let callback = (link) => {
            homey.api.realtime('downloadFileReady', link)
        };

        if (!homey.app.Log) throw new Error(homey.__('bllNotStartedYet'));
        try {

            
            const link = await BL.getDownloadUrl({ contentType: 'text/json', filename:file.name });
            homey.setTimeout(async () => {
                const logs = await homey.app.Log.getLogs({ returnType: 'json' });
                //const text = JSON.stringify(logs.logs);
                await BL.setDownloadUrl({ link, text: logs.json, callback });
            }, 0);
            return link;

        } catch (error) {
            //homey.error(error);
            let msg = error.message || error;
            if (msg.indexOf('App Not Ready') > -1) throw new Error(homey.__('bllNotRunning'));
        }
    },
};