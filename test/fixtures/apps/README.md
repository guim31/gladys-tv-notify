# What the notification apps expect

No real TV was available: the fake receivers of `test/helpers/fakeTv.js` and
the expectations of `test/notification.test.js` follow these sources. The
request of a real app can be checked with `node scripts/probe.mjs <tv> --notify`.

## Notifications for Android TV / Fire TV (port 7676)

Closed-source app (dream apps). The protocol is the one of the library
[`notifications-android-tv`](https://github.com/engrbm87/notifications_android_tv)
(MIT, version 0.1.5, the one Home Assistant's `nfandroidtv` integration pins)
and of the payload of Home Assistant's former `nfandroidtv` notify platform
(Apache-2.0):

- `POST /`, `multipart/form-data`, every value a form part;
- `msg`, `title`, `duration` (seconds), `fontsize` (small 1, medium 0,
  large 2, max 3), `position` (bottom-right 0, bottom-left 1, top-right 2,
  top-left 3, center 4), `bkgcolor` (`#607d8b`, `#000000`, `#303F9F`,
  `#4CAF50`, `#F44336`, `#00BCD4`, `#009688`, `#FFC107`, `#E91E63`),
  `transparency` (0 % 1, 25 % 2, 50 % 3, 75 % 4, 100 % 5), `interrupt` (0/1),
  plus `type` 0, `offset` 0, `app`, `force` true of the former payload;
- `filename`: the icon file, always sent (a transparent 1 × 1 PNG by default);
  `filename2`: the picture;
- HTTP 200 on success. Home Assistant also sends a plain `GET /` to check the
  app answers.

The library's 1.x versions send the color as `color` instead of `bkgcolor`;
Home Assistant still uses 0.1.5 and `bkgcolor`, kept here.

## PiPup (port 7979)

[rogro82/PiPup](https://github.com/rogro82/PiPup), no license file: read for
the protocol only, nothing copied.

- `POST /notify`, `application/json` (`duration`, `position`, `title`,
  `message`, `backgroundColor` `#AARRGGBB`, `media`…) or `multipart/form-data`
  with the same fields as text and an `image` file (`imageWidth`);
- positions: TopRight 0, TopLeft 1, BottomRight 2, BottomLeft 3, Center 4;
- any other method or path: HTTP 400 "invalid method" / "unknown uri";
- NanoHTTPD reads the text parts with the charset of the `Content-Type`
  header: the integration declares UTF-8.

## TvOverlay (port 5001)

[gugutab/TvOverlay](https://github.com/gugutab/TvOverlay), no license file
(the README documents the REST API): read for the protocol only.

- `POST /notify`, `application/json`: `title`, `message`, `source`, `image`
  (an MDI icon, an image URL or a base64 bitmap), `largeIcon`, `smallIcon`,
  `corner` (`bottom_start`, `bottom_end`, `top_start`, `top_end`), `duration`
  (seconds);
- `GET /get`: the settings of the app (may include its MQTT password: the
  probe script prints its key names only).
