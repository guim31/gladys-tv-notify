# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Notifications on Android TV, Google TV and Fire TV through the free apps
  "Notifications for Android TV" / "Notifications for Fire TV", PiPup or
  TvOverlay, on the local network.
- One Gladys device per TV with a **Reachable** feature: whether its app
  answers (the TV is on), checked by the integration at the chosen interval
  without anything shown on the screen.
- Scene action **Show a notification on the TV**: title, message (scene
  variables), display time, position, background color, transparency, icon,
  and a picture downloaded from a camera's snapshot URL (Basic or Digest
  authentication). It returns whether the notification was shown, so a scene
  can fall back to a phone when the TV is off.
- Dashboard widget **Message on the TV**: the state of the TV, a form to type
  a message, up to three quick messages.
- Configuration actions: add or update a TV, remove a TV, send a test
  notification.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-tv-notify/commits/main
