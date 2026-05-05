# Doctor Hotspot Briefing

Public archive site for daily doctor hotspot briefings.

## Public URL

- Latest report: https://zhongheweiwei-cmyk.github.io/doctor-hotspot-briefing/
- Archive: https://zhongheweiwei-cmyk.github.io/doctor-hotspot-briefing/archive.html
- Latest Markdown: https://zhongheweiwei-cmyk.github.io/doctor-hotspot-briefing/latest.md
- Latest JSON: https://zhongheweiwei-cmyk.github.io/doctor-hotspot-briefing/latest.json

## Files

- `docs/index.html` - latest report page for GitHub Pages
- `docs/archive.html` - historical report index
- `docs/latest.md` - latest Markdown report
- `docs/latest.json` - latest structured JSON report
- `docs/reports/YYYY-MM-DD/` - archived Markdown, JSON, and evidence files

## Publish Current Local Output

```bash
node scripts/publish-report.mjs
```

The script imports files from `/Users/weilinliu/user-data/outputs`, updates the static site, and refreshes the archive.

## Push To GitHub

```bash
./scripts/push-site.sh
```

GitHub Pages publishes from the `docs/` directory on the `main` branch.

## Codex Automations

The unattended daily runs are handled by Codex app automations, not launchd. They run at 08:30 and 20:30 every day and use the latest local `doctor-hotspot-briefing` skill and prompt:

- Skill: `/Users/weilinliu/.codex/skills/doctor-hotspot-briefing/SKILL.md`
- Prompt: `/Users/weilinliu/.codex/skills/doctor-hotspot-briefing/references/web_search_daily_prompt.md`
- Workspace: `/Users/weilinliu/doctor-hotspot-briefing-site`
- Public site: `https://zhongheweiwei-cmyk.github.io/doctor-hotspot-briefing/`

Manual local test without pushing:

```bash
NO_PUSH=1 ./scripts/run-daily-and-publish.sh
```

Publish existing local `latest.md/latest.json` only:

```bash
PUBLISH_ONLY=1 NO_PUSH=1 ./scripts/run-daily-and-publish.sh
```

Run and publish manually:

```bash
./scripts/run-daily-and-publish.sh
```

The Codex automations generate `latest.md`, `latest.json`, and `websearch-evidence-YYYY-MM-DD.json`, then update the GitHub Pages archive and push to GitHub. Failed runs must not push partial output.
