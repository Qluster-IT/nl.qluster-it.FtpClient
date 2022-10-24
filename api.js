"use strict";

const Homey = require('homey');


module.exports = {
    async uploadFiles({ homey, body:{directory, files, id} }) {
        console.log(directory);
        let r = await homey.drivers.getDriver('ftpconnection').fileUploads[id].upload({directory, files});
        return r;
    },
    async uploadFilePartials({ homey, body:{directory, partial, id, lastPart} }) {
        console.log(directory);
        let obj = homey.drivers.getDriver('ftpconnection').fileUploads[id];
        if(!obj.partial) obj.partial = partial;
        else obj.partial+=partial;
        if(!lastPart) return true;
        let files = JSON.parse(obj.partial);
        delete obj.partial;
        let r = await homey.drivers.getDriver('ftpconnection').fileUploads[id].upload({directory, files});
        return r;
    },   
};