"use strict";

module.exports = {
    async apiReady({ homey }) {
        return { ready: homey.app.apiReady === true };
    },
    async uploadFilePartials({ homey, body = {} }) {
        const driver = homey.drivers.getDriver('ftpconnection');
        return driver.uploadSpool.write(body, homey.__('repair.uploadFailed'));
    },
};