# Notifications Android/Fire TV for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that shows
notifications on Android TV, Google TV, Nvidia Shield and Fire TV: a message over the film, with an
icon and a picture. The classic: **the doorbell rings, the visitor's picture appears on the TV**.

It talks, on the local network, to a notification app installed on the TV:
**Notifications for Android TV** / **Notifications for Fire TV** (port 7676), **PiPup** (7979) or
**TvOverlay** (5001) — the equivalent of Home Assistant's `nfandroidtv` integration.

> **Developed without the hardware: feedback welcome.** The integration is covered by automated
> tests against simulated apps (built from the published protocols, see
> [`test/fixtures/apps`](test/fixtures/apps/README.md)), but has not yet been tried with a real
> TV. Tell us on the Gladys forum how it works with yours.

Not affiliated with the authors of these apps, nor with Google or Amazon.

## Features

- **One device per TV** with a **Reachable** feature (presence sensor): the TV's app answers, so
  the TV is on. Checked by the integration itself (one TCP connection, nothing shown on screen).
- **Scene action "Show a notification on the TV"**: title and message with scene variables,
  display time, position, background color, transparency, one of 19 icons, and a **picture
  downloaded from a camera's snapshot URL** (Basic or Digest authentication). It returns
  `sent` = 1 or 0, so a scene can warn a phone instead when the TV is off.
- **Dashboard widget "Message on the TV"**: the TV state, a **Write a message** form, up to three
  quick messages.
- **Configuration actions**: add or update a TV, remove a TV, send a test notification.
- Everything in English, French, German and Spanish.

| Option       | Notifications for Android TV / Fire TV | PiPup      | TvOverlay        |
| ------------ | -------------------------------------- | ---------- | ---------------- |
| Position     | 4 corners + center                     | 4 + center | 4 corners        |
| Color        | 9 colors                               | 9 colors   | the app's layout |
| Transparency | yes                                    | yes        | the app's layout |
| Icon         | yes                                    | no         | yes (MDI)        |
| Picture      | yes                                    | yes        | yes              |

## Requirements

- Gladys Assistant **5.2.0** or later (the widget's form button).
- A TV on the same local network as Gladys with one of the apps installed and opened once:
  [Notifications for Android TV](https://play.google.com/store/apps/details?id=de.cyberdream.androidtv.notifications.google),
  [Notifications for Fire TV](https://www.amazon.com/dp/B00OESCXEK),
  [PiPup](https://github.com/rogro82/PiPup) or
  [TvOverlay](https://play.google.com/store/apps/details?id=com.tabdeveloper.tvoverlay).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-tv-notify` (or install it from the catalog once it is
   listed).
2. In **Configuration**, run **Add or update a TV** for each TV (name, IP address shown by the app,
   app).
3. Open the **Discover** tab and press **Add to Gladys**, then **Send a test notification**.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

It pairs with [Android TV Remote](https://github.com/guim31/gladys-integration-android-tv-remote)
and [Android TV ADB](https://github.com/guim31/gladys-androidtv-adb), which **control** the TV:
this one **displays messages** on it.

## Limitations

- Local network only, no cloud. `.local` names do not resolve in the container: use an IP address.
- Gladys does not let an integration read the image of another camera device: the picture comes
  from the camera's own **snapshot URL** (IP cameras, Frigate, go2rtc…). Credentials written in
  that URL are readable by every Gladys user (scenes are), and never logged.
- Options differ per app (table above).
- "Reachable" means the app answers: some TVs keep their network alive in standby for a while.
- Not tested on real TVs yet.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test: the SDK's fake Gladys + fake TV apps and camera on loopback
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .   # store validator
node scripts/probe.mjs 192.168.1.30           # read-only probe of a real TV (add --notify to show one)
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            handlers → monitor, configuration actions
src/monitor.js        TV list, reachability checks, states, notifications
src/notification.js   notification fields → the request of each app
src/client.js         sends a notification, checks a TV
src/image.js          picture download (Basic / Digest), image type sniffing
src/http.js           node:http request with deadline and size cap, TCP probe, URL redaction
src/digest.js         HTTP Digest authentication
src/tvs.js            validation of the TV fields, apps and ports, ids
src/devices.js        Gladys device of a TV
src/scenes.js         scene action
src/widgets.js        dashboard widget
src/messages.js       texts sent from the container, four languages
src/icons.js          notification icons (generated by scripts/build-icons.mjs)
src/store.js          /data persistence
src/config.js         configuration defaults and normalization
```

Releases are made by the Release workflow (Actions → Release); see [CLAUDE.md](CLAUDE.md).

## Credits

- [Home Assistant](https://www.home-assistant.io) — the
  [`nfandroidtv`](https://www.home-assistant.io/integrations/nfandroidtv/) integration (Apache-2.0):
  the payload of "Notifications for Android TV", kept as a test fixture, and what users expect
  (image from a camera URL with Basic/Digest authentication).
- [notifications-android-tv](https://github.com/engrbm87/notifications_android_tv) by Rami Mousleh
  (MIT): the protocol of the app, its value maps and its default icon.
- [PiPup](https://github.com/rogro82/PiPup) by rogro82 and
  [TvOverlay](https://github.com/gugutab/TvOverlay) by gugutab: their documented HTTP APIs (read,
  nothing copied).
- [Material Design Icons](https://pictogrammers.com) by Pictogrammers (Apache-2.0): the
  notification icons.
- The Digest authentication comes from [gladys-fritzbox](https://github.com/guim31/gladys-fritzbox).

## License

Apache-2.0, see [LICENSE](LICENSE).
