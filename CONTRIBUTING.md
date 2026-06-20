# Contributing to Routebook

Thanks for taking an interest in Routebook.

Routebook is meant to stay small and focused: it helps people clarify ideas into plans and AI task briefs. Before adding features, ask whether the change makes the first-time planning experience clearer for non-technical users.

## Development

```bash
npm install
npm run desktop
```

Run checks before opening a pull request:

```bash
npm run smoke
npm audit --audit-level=high
node --check server.js
node --check desktop/main.js
node --check desktop/preload.js
```

## Product Boundaries

Good contributions:

- improve plain-language questions,
- improve multi-window isolation,
- improve backup and data portability,
- improve model setup clarity,
- fix packaging and install issues,
- improve accessibility and localization.

Please avoid turning Routebook into:

- a full project execution agent,
- a model marketplace,
- a local-model orchestration tool,
- or a memory database product.

## Security and Privacy

Never commit:

- `models.json`,
- `config.json`,
- `windows/`,
- real API keys,
- private conversation logs,
- machine-specific paths or LAN addresses.

Backups should not include model API keys.
