# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Stored in `/data`** (`/data/tvs.json`): the list of TVs the user added —
  name, address, app and port. No secret, no account, no token.
- **Credentials of a camera**, when the user writes them in the picture URL of
  the scene action (`http://user:password@camera/…`): they live in the scene,
  which every Gladys user can read (the documentation says so and advises a
  view-only camera account), are sent only to that camera in answer to its
  Basic or Digest challenge, and are never written to the logs (the logged URL
  keeps neither the credentials nor the query string).
- **Network**, from its container, only towards the addresses the user
  entered: TCP connections to the app port of each TV (the reachability
  check), one HTTP POST per notification to the TV's app, one HTTP GET per
  notification to the picture URL (HTTPS certificates of cameras are not
  verified: LAN cameras use self-signed ones). Answers are size- and
  time-bounded. Nothing leaves the local network unless the user enters an
  outside address.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the notification apps installed on the TV, and the cameras.
