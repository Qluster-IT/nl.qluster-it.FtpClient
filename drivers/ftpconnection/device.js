'use strict';

const Homey = require('homey');
const FtpClient = require('../../lib/ftp-client');
const { getRootPath, resolvePath } = require('../../lib/ftp-paths');

const STATUS = 'ftp_status';
const ALARM = 'alarm_ftp_transfer';
const DEFAULT_CHECK_MINUTES = 5;
const RETRY_INTERVAL = 15000;

module.exports = class FtpClientDevice extends Homey.Device {
	async onInit() {
		this.id = await this.getStoreValue('id');
		this.ftpClient = new FtpClient();
		await this.init();
		for (const capability of [STATUS, ALARM]) {
			if (!this.hasCapability(capability)) await this.addCapability(capability);
		}
		if (this.getCapabilityValue(ALARM) == null) await this.clearTransferError();
		this.monitoring = true;
		await this.startMonitoring();
	}

	onDeleted() {
		this.onUninit();
	}

	onUninit() {
		this.monitoring = false;
		this.stopConnectionCheck();
		if (this.ftpClient) this.ftpClient.close();
	}

	async onSettings({ newSettings, changedKeys }) {
		if (changedKeys && !changedKeys.some(key =>
			['ip', 'port', 'username', 'password', 'secure', 'allow_incorrect_certificate', 'workdirectory'].includes(key))) {
			this.settings = newSettings;
			if (changedKeys.includes('status_poll_minutes') && this.checkTimer != null && this.failedChecks !== 1) {
				this.scheduleConnectionCheck();
			}
			return;
		}
		await this.init(newSettings);
		if (this.monitoring) {
			const previous = this.stopConnectionCheck();
			if (previous) await previous.catch(error => this.error('FTP status update failed', error));
			if (this.monitoring) await this.startMonitoring();
		}
	}

	async init(newSettings) {
		const settings = newSettings || await this.getSettings();
		this.ftpClient.init(this.connectionOptions(settings));
		this.settings = settings;
	}

	connectionOptions(settings) {
		const { ip, port, username, password, secure, allow_incorrect_certificate, workdirectory } = settings;
		return { homey: this.homey, ip, port, username, password, secure, allow_incorrect_certificate, workdirectory };
	}

	stopConnectionCheck() {
		if (this.checkTimer != null) this.homey.clearTimeout(this.checkTimer);
		this.checkTimer = null;
		const pending = this.connectionCheck;
		this.connectionCheck = null;
		if (pending) pending.client.close();
		return pending && pending.result;
	}

	async startMonitoring() {
		this.failedChecks = 0;
		await this.setCapabilityValue(STATUS, 'checking');
		if (this.monitoring) this.checkConnection().catch(error => this.error('FTP status update failed', error));
	}

	scheduleConnectionCheck() {
		if (this.checkTimer != null) this.homey.clearTimeout(this.checkTimer);
		const minutes = this.settings.status_poll_minutes ?? DEFAULT_CHECK_MINUTES;
		const delay = this.failedChecks === 1 ? RETRY_INTERVAL : minutes * 60_000;
		this.checkTimer = this.homey.setTimeout(() => {
			this.checkTimer = null;
			this.checkConnection().catch(error => this.error('FTP status update failed', error));
		}, delay);
	}

	checkConnection() {
		if (!this.monitoring) return Promise.resolve(false);
		if (this.connectionCheck) return this.connectionCheck.result;
		if (this.checkTimer != null) this.homey.clearTimeout(this.checkTimer);
		this.checkTimer = null;
		const check = this.connectionCheck = { client: new FtpClient() };
		check.result = this.runConnectionCheck(check).finally(() => {
			check.client.close();
			if (this.connectionCheck !== check) return;
			this.connectionCheck = null;
			this.scheduleConnectionCheck();
		});
		return check.result;
	}

	async runConnectionCheck(check) {
		let ready;
		try {
			check.client.init({ ...this.connectionOptions(this.settings), timeout: 10000 });
			await check.client.exec({ action: 'list', oneTry: true });
			ready = true;
		} catch (error) {
			if (this.connectionCheck !== check) return false;
			ready = false;
			if (this.failedChecks === 1) this.error('FTP connection check failed twice', error);
		}
		if (this.connectionCheck !== check) return false;
		this.failedChecks = ready ? 0 : this.failedChecks + 1;
		const status = ready ? 'ready' : this.failedChecks >= 2 ? 'unavailable' : null;
		if (status && this.getCapabilityValue(STATUS) !== status) {
			await this.setCapabilityValue(STATUS, status);
			// Don't wait for Flow execution; a triggered Flow can run another check.
			if (this.connectionCheck === check) {
				this.homey.flow.getDeviceTriggerCard('ftp_became_' + status).trigger(this)
					.catch(error => this.error('FTP status trigger failed', error));
			}
		}
		return ready;
	}

	isFtpReady() {
		return this.getCapabilityValue(STATUS) === 'ready';
	}

	hasTransferError() {
		return this.getCapabilityValue(ALARM) === true;
	}

	clearTransferError() {
		return this.setCapabilityValue(ALARM, false);
	}

	async reportTransferError(operation, remotePath, error) {
		let path = '';
		try {
			const root = getRootPath(this.settings.workdirectory);
			path = resolvePath(root, remotePath).slice(root.length).replace(/^\/+/, '');
		} catch (pathError) {
			// Rejected paths must not be echoed into Flow tokens.
		}
		const code = error && String(error.code);
		const safeCode = code && /^(?:[45]\d\d|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|EPIPE)$/.test(code);
		const reason = this.homey.__('monitor.transferFailed') + (safeCode ? ` (${code})` : '');
		try {
			await this.setCapabilityValue(ALARM, true);
		} catch (alarmError) {
			this.error('Could not set FTP transfer alarm', alarmError);
		}
		this.homey.flow.getDeviceTriggerCard('ftp_transfer_failed').trigger(this, {
			operation: this.homey.__('monitor.' + operation), path, reason
		}).catch(triggerError => this.error('FTP transfer failure trigger failed', triggerError));
	}
};
