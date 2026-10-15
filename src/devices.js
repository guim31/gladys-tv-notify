// -----------------------------------------------------------------------------
// One Gladys device per TV, with a single feature:
//   - reachable  presence-sensor/binary, read only: 1 when the notification
//                app of the TV answers (the TV is on and can show a message),
//                0 otherwise. The green/red badge on the dashboard, a Yes/No
//                condition in scenes ("only if the TV is on").
//
// Showing a notification is not a device feature: it has a title, a message,
// an image… which a single feature value cannot carry. It is the scene action
// `show_notification` and the dashboard widget (src/scenes.js, src/widgets.js).
//
// Published with should_poll: false: the checks run in the container
// (src/monitor.js), at the interval of the configuration (Gladys#3198).
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { APPS } from './tvs.js';

export const DEVICE_TYPE = 'tv';
export const FEATURE_KEYS = { REACHABLE: 'reachable' };

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: { reachable: 'Reachable' },
  fr: { reachable: 'Joignable' },
  de: { reachable: 'Erreichbar' },
  es: { reachable: 'Accesible' },
};

/** External ids of a TV device and of its feature. */
export function tvIds(gladys, tvId) {
  const ids = gladys.externalIds(DEVICE_TYPE, tvId);
  return { device: ids.device, reachable: ids.feature(FEATURE_KEYS.REACHABLE) };
}

/** The platform id of a TV device, from its external id (null if not ours). */
export function tvIdOf(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

/**
 * The discovery payload of a TV.
 * @param {object} gladys
 * @param {object} tv see src/tvs.js
 * @param {string} language language of the feature name
 */
export function buildDevice(gladys, tv, language = 'fr') {
  const ids = tvIds(gladys, tv.id);
  const names = NAMES[language] ?? NAMES.en;
  return {
    name: tv.name,
    external_id: ids.device,
    model: APPS[tv.app].label,
    should_poll: false,
    // Read back when /data is lost (src/monitor.js, restoreFromGladys).
    params: [
      { name: 'ADDRESS', value: tv.address },
      { name: 'APP', value: tv.app },
      { name: 'PORT', value: String(tv.port) },
    ],
    features: [
      {
        name: names.reachable,
        external_id: ids.reachable,
        category: DEVICE_FEATURE_CATEGORIES.PRESENCE_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
        read_only: true,
        has_feedback: false,
        keep_history: true,
        min: 0,
        max: 1,
      },
    ],
  };
}
