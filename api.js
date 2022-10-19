"use strict";

const Homey = require('homey');


module.exports = {
    async uploadFiles({ homey, body:{directory, files, id} }) {
        console.log(directory);
        let r = await homey.drivers.getDriver('ftpclient').fileUploads[id].upload({directory, files});
        return r;
    },   
};