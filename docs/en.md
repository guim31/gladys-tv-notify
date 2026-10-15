# Notifications Android/Fire TV

Show notifications on your TV from Gladys: a message over the film, with a picture if you want.
The great classic: **the doorbell rings, the visitor's picture appears on the TV**. Also: the
washing machine is done, a window is still open at bedtime, "Dinner is ready!" sent from the kitchen
tablet.

It works with a free notification app installed on the TV: **Notifications for Android TV** (Android
TV, Google TV, Nvidia Shield…), **Notifications for Fire TV** (Amazon Fire TV and Fire TV Stick),
**PiPup** or **TvOverlay**. Each TV becomes a Gladys device that says whether it is on (its app
answers), so a scene can choose between the TV and a phone.

> **Developed without the hardware: feedback welcome.** The integration is covered by automated
> tests against simulated apps, but has not yet been tried with a real TV in a real Gladys
> installation. Tell us on the Gladys forum how it works with yours.

This integration is not affiliated with the authors of these apps, nor with Google or Amazon.

## What you get

- **One device per TV**, with one feature, **Reachable** (presence sensor, yes/no): yes when the
  notification app of the TV answers, which in practice means the TV is on.
- A scene action, **Show a notification on the TV**: title, message (scene variables accepted),
  display time, position, background color, transparency, icon and a picture downloaded from a
  camera's snapshot URL. It tells the scene whether the notification was shown.
- A dashboard widget, **Message on the TV**: the state of the TV, a **Write a message** button that
  opens a small form, and up to three quick messages, one tap each.
- Three buttons in the configuration: add or update a TV, remove a TV, send a test notification.

## Requirements

- Gladys Assistant **5.2.0** or later (the widget form needs it).
- A TV running Android TV, Google TV or Fire OS, on the **same local network** as Gladys.
- One of the notification apps installed and opened once on the TV (next section).
- The address of the TV: an IP address (a fixed one is best: reserve it in the DHCP settings of
  your router) or a DNS name. `.local` names (mDNS) cannot be resolved inside the integration.

## Installing the app on the TV

### Android TV, Google TV, Nvidia Shield

Install **Notifications for Android TV** from the Google Play Store of the TV (search for
"Notifications for Android TV"), then open it once: it shows the IP address of the TV and asks for
the permission to display over other apps. Leave the app installed: it keeps listening in the
background on port **7676**. Check on its store page which options its free version includes.

### Fire TV

Install **Notifications for Fire TV** from the Amazon Appstore of the Fire TV, then open it once. It
is the same app for the Fire TV, with the same protocol: choose "Notifications for Android TV / Fire
TV" in Gladys.

### PiPup or TvOverlay instead

- **PiPup** (port **7979**) is an open source alternative. When it is installed outside the Play
  Store, it needs the permission to draw over other apps, given once with ADB:
  `adb shell appops set nl.rogro82.pipup SYSTEM_ALERT_WINDOW allow`.
- **TvOverlay** (port **5001**), from the Play Store, also needs that permission (same ADB command
  with `com.tabdeveloper.tvoverlay`). The look of its notifications (colors, layout) is chosen in
  the app itself.

Our integrations
[Android TV Remote](https://github.com/guim31/gladys-integration-android-tv-remote) and
[Android TV ADB](https://github.com/guim31/gladys-androidtv-adb) **control** the TV (power, volume,
apps); this one **displays messages** on it. They work side by side on the same TV. With ADB set up
for the second one, the command above can be sent from your computer with the same ADB access.

## Configuration

### Settings

| Setting                 | Default  | Use                                                                             |
| ----------------------- | -------- | ------------------------------------------------------------------------------- |
| **Language**            | Français | names of the features, messages of the actions, text of the test notification   |
| **Check the TVs every** | 30 s     | how often the integration checks that each TV answers                           |
| **Unreachable after**   | 1 minute | time without any answer before a TV shows as unreachable (Wi-Fi misses a check) |

A check is one connection to the app of the TV: **nothing appears on the screen**, and the TV is not
woken up. The apps have no account and no quota: the integration only talks to them on your local
network, never to the internet.

### Adding a TV

1. In **Integrations → Notifications Android/Fire TV → Configuration**, fill in **Add or update a
   TV**: a name, the IP address shown by the app, and the app installed. Leave the port empty unless
   you changed it in the app.
2. The answer says whether the app answers. If it does not, turn the TV on, open the app once, and
   run the action again.
3. Open the **Discover** tab and create the device of the TV.

The same action with the same name or the same address updates the TV (new address, other app): its
device stays the same. **Remove a TV** stops the checks; delete its device in Gladys as well if you
no longer need it.

### Testing

**Send a test notification**, with the TV chosen in the list, shows a short message on the screen.
The answer says what happened: shown, the TV does not answer, or the app refused the notification
(the wrong app chosen, or another port).

## Devices

Each TV is a device with one feature:

| Feature       | Type in Gladys           | Shows                                                           |
| ------------- | ------------------------ | --------------------------------------------------------------- |
| **Reachable** | presence sensor (yes/no) | yes when the app of the TV answers (the TV is on), no otherwise |

On the dashboard, Gladys labels a feature that is alone of its type with the name of the type: the
device box may read "Presence" instead of "Reachable". The value is the same.

The state is refreshed by the integration itself at the chosen interval, and published only when it
changes (plus once every 12 hours, so the dashboard never shows "no recent value"). A notification
that is shown also marks the TV as reachable at once.

Some TVs keep their network on in standby: the app may keep answering for a while after the screen
goes off. The state tells "the TV can show a notification", which is what a scene needs.

## Dashboard widget

**Message on the TV** shows:

- the state of the TV (on and reachable, off or unreachable);
- **Write a message**: a tap opens a small form (message and display time), **Send** shows it on
  the TV;
- up to three **quick messages**, written once in the settings of the widget ("Dinner is ready!",
  "Bedtime!"), shown with one tap.

Settings: the TV (empty: the first TV of the integration) and the three quick messages. After each
message, a short note says whether it was shown.

## Scene action and triggers

**Show a notification on the TV** (category "Integrations" of the scene editor):

| Field                       | Use                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| **TV**                      | the TV (required)                                                                         |
| **Title**                   | optional; Notifications for Android TV shows "Gladys" when it is empty                    |
| **Message**                 | the text (required); scene variables accepted, e.g. the name of a device or a temperature |
| **Display time (seconds)**  | 1 to 300, 10 by default                                                                   |
| **Position**                | a corner of the screen or its center (TvOverlay: corners only)                            |
| **Background color**        | nine colors (not with TvOverlay, which uses its own layout)                               |
| **Background transparency** | opaque to fully transparent (not with TvOverlay)                                          |
| **Icon**                    | doorbell, camera, parcel, washing machine, meal… (not with PiPup)                         |
| **Picture URL**             | optional: a picture downloaded at each notification, see below                            |

The action returns **Notification shown (1 or 0)**. A TV that is off is not an error: the value is 0
and the scene goes on, so a **Continue only if** step can send the message to a phone instead. Only
a device of another integration, or a notification without text, makes the action fail.

The integration declares **no scene trigger**: what happens to the TV is its **Reachable** feature,
usable in the usual "a device state changes" trigger (the TV turns on or off).

### Picture of a camera

The integration cannot read the image of a Gladys camera device: Gladys only gives an integration
access to its own devices. It downloads the picture from the **snapshot URL of the camera**
instead, at the moment of the notification. Examples:

- most IP cameras: `http://192.168.1.40/snapshot.jpg`, or the URL given in their manual (Hikvision
  `http://192.168.1.40/ISAPI/Streaming/channels/101/picture`, Reolink
  `http://192.168.1.40/cgi-bin/api.cgi?cmd=Snap&channel=0&user=…&password=…`);
- Frigate: `http://192.168.1.50:5000/api/front_door/latest.jpg`;
- go2rtc: `http://192.168.1.50:1984/api/frame.jpeg?src=front_door`.

A user name and a password can be written in the URL (`http://viewer:password@192.168.1.40/…`):
the integration answers the camera's Basic or Digest challenge with them, and never writes them in
its logs. **A scene is readable by every Gladys user**: create a camera account limited to viewing
for this use.

The picture must be a JPEG, PNG, GIF or WebP of 4 MB at most, downloaded in 6 seconds at most. When
the download fails, the notification is shown without the picture.

## Scene examples

- **Who is at the door**: trigger "the doorbell button is pressed" → **Show a notification on the
  TV** with the title "Doorbell", the message "Someone is at the door", the doorbell icon, a 30
  second display time and the snapshot URL of the entrance camera. The picture of the visitor
  appears over the film.
- **TV or phone**: same scene, followed by **Continue only if** "Notification shown" equals 0, then
  **Send a message** to your phone: when the TV is off, the phone takes over.
- **Laundry done**: trigger "the power of the washing machine plug falls below 5 W" → notification
  "The laundry is done" with the washing machine icon, only if the **Reachable** feature of the TV
  is yes.
- **Bedtime**: at 9 pm on school days → notification "Bedtime in 10 minutes!" in the center of the
  screen, in amber.

## Troubleshooting

- **"does not answer"**: the TV is off, in deep standby, or the app is not running. Open the app
  once on the TV; on some TVs, allow it to start in the background or disable the battery
  optimization for it. Check the IP address shown by the app.
- **"refused the notification (HTTP 404 or 400)"**: another app answers on that port. Check the app
  chosen in **Add or update a TV**, and the port if you changed it in the app.
- **Nothing on the screen but "shown"**: the app lacks the permission to display over other apps
  (see the ADB command above), or a full-screen app hides overlays.
- **No picture**: open the snapshot URL in a browser of a computer of the same network; check the
  user name and password, and the integration logs (one warning per failing URL, password hidden).
- **The state stays unreachable while the TV is on**: the Gladys machine and the TV must be on the
  same network, without client isolation (guest Wi-Fi often blocks it).
- More details: set `LOG_LEVEL=debug` on the integration to see every check and every notification.

## Limits

- Local network only: the integration talks to the app of the TV over HTTP on your network; no
  cloud, no account.
- No image of a Gladys camera device itself (see above): a snapshot URL is needed.
- The apps differ: no colors, transparency or center position with TvOverlay, no icon with PiPup.
- No reading of what the TV shows, no control of the TV: see our Android TV Remote and Android TV
  ADB integrations for that.
- Notifications are shown by the app over most content, but some protected or full-screen apps can
  hide them.
- Not tried yet on real TVs (see the note at the top): feedback welcome.
