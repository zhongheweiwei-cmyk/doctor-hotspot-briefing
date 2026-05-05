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
