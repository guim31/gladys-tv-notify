// -----------------------------------------------------------------------------
// The monitor: the list of TVs, their reachability, the states published to
// Gladys and the notifications. Everything the SDK handlers, the scene action
// and the widget need goes through it (src/app.js wires it).
//
// Scheduling: the devices are published with should_poll: false (the core
// does not reliably poll external devices, Gladys#3198) and the monitor checks
// every created TV at the configured interval with one TCP connection to its
// app — nothing is shown on the screen. A notification also tells: shown means
// reachable, no answer counts as a failed check.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat
// every 12 hours so a stable TV never shows "no recent value" (the front's
// threshold is 48 hours).
//
// Logs: at info, only the lifecycle (start, a TV added or removed, a TV lost
// or back, one line per test from the Configuration screen). A failure that
// repeats (core unreachable, a camera refusing its snapshot, a TV believed on
// that does not answer) is logged once, then at debug until it recovers, with
// one line at recovery. LOG_LEVEL=debug shows every check and notification.
// Never an image URL with its credentials (redactUrl).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { createClient } from './client.js';
import { buildDevice, tvIdOf, tvIds } from './devices.js';
import { redactUrl } from './http.js';
import { fetchImage } from './image.js';
import { ERRORS, NOTIFY_ERRORS, REPORTS, TEST_NOTIFICATION, join, render } from './messages.js';
import { NotificationError, normalizeNotification } from './notification.js';
import { APPS, MAX_TVS, findTv, newTvId, parseTvFields, restoreTv } from './tvs.js';

const logger = createLogger({ name: 'tv-notify' });

export const WIDGET_KEY = 'tv_message';

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * 60 * 60 * 1000,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

export class GladysError extends Error {
  /** An error whose message is a multi-language object (shown in Gladys). */
  constructor(message, language = 'en') {
    super(message[language] ?? message.en);
    this.messages = message;
  }
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {object} [options.client] see src/client.js
   * @param {Function} [options.fetchImage] see src/image.js
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, client, fetchImage: getImage, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.client = client ?? createClient();
    this.fetchImage = getImage ?? fetchImage;
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.tvs = new Map();
    this.status = new Map();
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    for (const entry of Array.isArray(saved.tvs) ? saved.tvs : []) {
      const tv = restoreTv(entry);
      if (tv && this.tvs.size < MAX_TVS) {
        this.tvs.set(tv.id, tv);
      }
    }
    this.restoreFromGladys();
    await this.publishDiscovered();
    await this.gladys.setConnectionStatus(true);
    logger.info(`Started: ${this.tvs.size} TV(s), checked every ${config.checkInterval} s`);
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.restoreFromGladys();
    await this.publishDiscovered();
    await this.gladys.setConnectionStatus(true);
    this.gladys.forgetPublishedStates?.();
    await this.publishStates(this.createdTvs());
    this.requestRefresh();
  }

  async reconfigure(config) {
    this.config = config;
    // The language of the feature names applies to the devices created from now on.
    await this.publishDiscovered();
    this.schedule();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.checkInterval * 1000);
    this.cycleTimer.unref?.();
  }

  /**
   * TVs already created in Gladys but missing from /data (file lost): rebuilt
   * from their device parameters, so they keep being checked and notified.
   */
  restoreFromGladys() {
    for (const device of this.gladys.devices ?? []) {
      const id = tvIdOf(this.gladys, device.external_id);
      if (!id || this.tvs.has(id) || this.tvs.size >= MAX_TVS) {
        continue;
      }
      const param = (name) => device.params?.find((p) => p.name === name)?.value;
      const tv = restoreTv({
        id,
        name: device.name,
        address: param('ADDRESS'),
        app: param('APP'),
        port: param('PORT'),
      });
      if (tv) {
        this.tvs.set(id, tv);
        this.save();
      }
    }
  }

  save() {
    return this.store.save({ version: 1, tvs: [...this.tvs.values()] });
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(
      [...this.tvs.values()].map((tv) => buildDevice(this.gladys, tv, this.config.language)),
    );
  }

  // --- Configuration actions ---------------------------------------------------

  async addTv(fields) {
    const { tv, error, param } = parseTvFields(fields);
    if (error) {
      throw new GladysError(
        render(ERRORS, error, { value: param, max: MAX_TVS }),
        this.config.language,
      );
    }
    const list = [...this.tvs.values()];
    const existing = findTv(list, tv.name) ?? findTv(list, tv.address);
    if (!existing && this.tvs.size >= MAX_TVS) {
      throw new GladysError(render(ERRORS, 'tooMany', { max: MAX_TVS }), this.config.language);
    }
    const saved = { id: existing?.id ?? newTvId(), ...tv };
    this.tvs.set(saved.id, saved);
    // Another address or app: start again from an unknown state.
    if (existing && (existing.address !== saved.address || existing.port !== saved.port)) {
      this.status.delete(saved.id);
    }
    await this.save();
    await this.publishDiscovered();
    logger.info(`TV ${existing ? 'updated' : 'added'}: ${saved.name} (${saved.app})`);

    const reachable = await this.client.reachable(saved);
    const created = this.isCreated(saved.id);
    if (created) {
      await this.applyCheck(saved, reachable);
    }
    const app = { app: APPS[saved.app].label, port: saved.port };
    const parts = [
      render(REPORTS, existing ? 'updated' : 'added', { name: saved.name }),
      render(REPORTS, reachable ? 'answers' : 'silent', app),
    ];
    if (!created) {
      parts.push(render(REPORTS, 'discovery'));
    }
    return join(...parts);
  }

  async removeTv(fields) {
    const query = typeof fields?.tv === 'string' ? fields.tv.trim() : '';
    const tv = findTv([...this.tvs.values()], query);
    if (!tv) {
      throw new GladysError(render(REPORTS, 'notFound', { query }), this.config.language);
    }
    this.tvs.delete(tv.id);
    this.status.delete(tv.id);
    await this.save();
    await this.publishDiscovered();
    logger.info(`TV removed: ${tv.name}`);
    this.requestRefresh();
    return join(
      render(REPORTS, 'removed', { name: tv.name }),
      render(REPORTS, 'tvs', { count: this.tvs.size }),
    );
  }

  /** The "Send a test notification" action: one notification, its outcome in words. */
  async testNotification(fields) {
    const tv = this.tvOfDevice(fields?.device);
    const text = TEST_NOTIFICATION[this.config.language] ?? TEST_NOTIFICATION.en;
    const result = await this.notify(tv, { ...text, icon: 'info' });
    if (!result.sent) {
      throw new GladysError(
        render(NOTIFY_ERRORS, result.error, { name: tv.name, status: result.status }),
        this.config.language,
      );
    }
    logger.info(`Test notification shown on ${tv.name}`);
    return render(REPORTS, 'testSent', { name: tv.name });
  }

  // --- Gladys events -----------------------------------------------------------

  deviceIdOf(tv) {
    return tvIds(this.gladys, tv.id).device;
  }

  isCreated(tvId) {
    const id = tvIds(this.gladys, tvId).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The TVs whose device exists in Gladys: the ones worth checking. */
  createdTvs() {
    return [...this.tvs.values()].filter((tv) => this.isCreated(tv.id));
  }

  async onDeviceCreated(device) {
    const id = tvIdOf(this.gladys, device.external_id);
    const tv = id ? this.tvs.get(id) : undefined;
    if (!tv) {
      return;
    }
    // The SDK forgot the states of the device: everything is published again.
    if (this.status.get(id)?.reachable == null) {
      await this.check(tv);
    } else {
      await this.publishStates([tv]);
    }
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    const id = tvIdOf(this.gladys, device.external_id);
    const tv = id ? this.tvs.get(id) : undefined;
    if (tv) {
      await this.check(tv);
    }
  }

  // --- Reachability ------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .then(() => this.recovered('cycle', 'Check cycles work again'))
      .catch((err) => this.failed('cycle', 'error', 'Check cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  /** Check every created TV (one TCP connection each), then publish what changed. */
  async cycle() {
    const tvs = this.createdTvs();
    const results = await Promise.all(tvs.map((tv) => this.client.reachable(tv)));
    tvs.forEach((tv, index) => this.updateStatus(tv, results[index]));
    logger.debug(`Check cycle: ${tvs.length} TV(s)`);
    await this.publishStates(tvs);
  }

  async check(tv) {
    const reachable = await this.client.reachable(tv);
    await this.applyCheck(tv, reachable);
    return reachable;
  }

  async applyCheck(tv, reachable) {
    this.updateStatus(tv, reachable);
    await this.publishStates([tv]);
  }

  statusOf(id) {
    if (!this.status.has(id)) {
      this.status.set(id, { reachable: null, lastSuccess: null, since: this.now() });
    }
    return this.status.get(id);
  }

  /** Fold one check into the state of a TV (offline delay included). */
  updateStatus(tv, reachable) {
    const status = this.statusOf(tv.id);
    const now = this.now();
    const was = status.reachable;
    if (reachable) {
      status.reachable = true;
      status.lastSuccess = now;
    } else {
      const reference = status.lastSuccess ?? status.since;
      if (now - reference >= this.config.offlineAfter * 1000) {
        status.reachable = false;
      }
    }
    if (status.reachable !== was) {
      if (was === null) {
        logger.debug(`${tv.name} is ${status.reachable ? 'reachable' : 'unreachable'}`);
      } else {
        logger.info(`${tv.name} is ${status.reachable ? 'reachable again' : 'unreachable'}`);
      }
      this.requestRefresh();
    }
    return status;
  }

  async publishStates(tvs) {
    const states = [];
    for (const tv of tvs) {
      const status = this.status.get(tv.id);
      if (!this.isCreated(tv.id) || status?.reachable == null) {
        continue;
      }
      states.push({
        device_feature_external_id: tvIds(this.gladys, tv.id).reachable,
        state: status.reachable ? 1 : 0,
      });
    }
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  // --- Notifications -----------------------------------------------------------

  /** The TV of a device chosen in a scene, a widget or an action. */
  tvOfDevice(externalId) {
    const id = tvIdOf(this.gladys, externalId);
    const tv = id ? this.tvs.get(id) : undefined;
    if (!tv) {
      throw new GladysError(render(NOTIFY_ERRORS, 'unknown'), this.config.language);
    }
    return tv;
  }

  /**
   * Shows a notification on a TV. A TV that does not answer is not an error
   * (a scene runs whether the TV is on or not): the result says it.
   * @param {object} tv
   * @param {object} fields title, message, duration, position, color,
   *   transparency, icon, image_url (see src/notification.js)
   * @returns {Promise<{ sent: boolean, image: boolean|null, error?: string, status?: number }>}
   * @throws {GladysError} nothing to show
   */
  async notify(tv, fields) {
    let notification;
    try {
      notification = normalizeNotification(fields);
    } catch (err) {
      if (err instanceof NotificationError) {
        throw new GladysError(render(NOTIFY_ERRORS, err.code), this.config.language);
      }
      throw err;
    }
    const image = notification.imageUrl ? await this.loadImage(notification.imageUrl) : null;
    const status = this.statusOf(tv.id);
    try {
      await this.client.send(tv, notification, image);
    } catch (err) {
      const reason = `${tv.name}: ${err.message}`;
      if (err.code === 'unreachable' && status.reachable === false) {
        // The TV is known to be off: nothing unexpected.
        logger.debug(`Notification not shown, ${reason}`);
      } else {
        this.failed(`send:${tv.id}`, 'warn', `Notification not shown, ${reason}`);
      }
      if (err.code === 'unreachable') {
        await this.applyCheck(tv, false);
      }
      return {
        sent: false,
        image: notification.imageUrl ? Boolean(image) : null,
        error: err.code,
        status: err.status,
      };
    }
    logger.debug(`Notification shown on ${tv.name}${image ? ' with its image' : ''}`);
    this.recovered(`send:${tv.id}`, `Notifications reach ${tv.name} again`);
    await this.applyCheck(tv, true);
    return {
      sent: true,
      image: notification.imageUrl ? Boolean(image) : null,
    };
  }

  /** The image of a notification, or null when it cannot be downloaded (shown without it). */
  async loadImage(url) {
    const key = `image:${redactUrl(url)}`;
    try {
      const image = await this.fetchImage(url);
      this.recovered(key, `Image download works again: ${redactUrl(url)}`);
      return image;
    } catch (err) {
      this.failed(
        key,
        'warn',
        `Image not downloaded (${err.code ?? 'error'}), notification shown without it: ${redactUrl(url)}`,
      );
      return null;
    }
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }

  /** What the widget shows of one TV. */
  view(tv) {
    return { id: tv.id, name: tv.name, reachable: this.status.get(tv.id)?.reachable ?? null };
  }
}
