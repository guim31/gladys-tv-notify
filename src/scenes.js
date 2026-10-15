// -----------------------------------------------------------------------------
// Scene action (manifest `scene_actions`, Gladys 5.1+).
//
// - show_notification: shows a notification on a TV — title and message (scene
//   variables allowed), duration, position, background color, transparency,
//   icon, and a picture downloaded from a URL (a camera's snapshot). The
//   doorbell rings → the visitor's picture appears over the film.
//
// A TV that is off is not an error: the action resolves `sent: 0`, so the
// scene can go on with "Continue only if" and warn a phone instead. Only a
// wrong device or an empty notification fail the action.
//
// Outputs are numbers (1/0), not booleans: the core's "Continue only if"
// compares with ===, and its value field only produces numbers and strings,
// so a boolean output could never be matched (Gladys 5.2.0).
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  async show_notification(monitor, { fields }) {
    const tv = monitor.tvOfDevice(fields.device);
    const result = await monitor.notify(tv, fields);
    return { sent: result.sent ? 1 : 0 };
  },
};
