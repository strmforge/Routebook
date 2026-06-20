# Security Policy

Routebook is an early open-source desktop app.

## Supported Versions

Security fixes target the latest released version.

## Reporting a Vulnerability

Please do not open a public issue for a real vulnerability that includes secrets, private data, or exploit details.

Open a private GitHub security advisory if available, or contact the repository owner through GitHub.

## Data Model

Routebook stores user data locally:

- model profiles and API keys in `models.json`,
- chat windows under `windows/`,
- exported backups without API keys.

Routebook sends the current window's relevant conversation to the configured model provider. It should not send unrelated windows as fallback context.

## Release Builds

Community builds are currently unsigned. Operating-system warnings are expected on first launch.
