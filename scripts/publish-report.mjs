import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const docsDir = path.join(repoRoot, "docs");
const sourceDir = process.env.DOCTOR_BRIEFING_OUTPUT_DIR || "/Users/weilinliu/user-data/outputs";

const latestMdPath = path.join(sourceDir, "latest.md");
const latestJsonPath = path.join(sourceDir, "latest.json");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugDate(value) {
  const date = String(value || "").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (date) return date;
  const compact = String(value || "").match(/\d{4}年\d{2}月\d{2}日/)?.[0];
  if (compact) return compact.replace("年", "-").replace("月", "-").replace("日", "");
  return new Date().toISOString().slice(0, 10);
}

function runSlug(value) {
  const text = String(value || "");
  const dateTime = text.match(/\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dateTime) return `${dateTime[1]}${dateTime[2]}${dateTime[3] || "00"}`;
  const compactTime = text.match(/(\d{2})(\d{2})(\d{2})/);
  if (compactTime) return compactTime[0];
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
}

function displayTime(value) {
  const text = String(value || "");
  const dateTime = text.match(/\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}(?::\d{2})?)/);
  if (dateTime) return dateTime[1];
  const compact = text.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}:${compact[2]}:${compact[3]}`;
  return "";
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`(.+?)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let blockquote = [];
  let table = [];
  let inCode = false;
  let code = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  const flushBlockquote = () => {
    if (!blockquote.length) return;
    html.push(`<blockquote>${blockquote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}</blockquote>`);
    blockquote = [];
  };

  const flushTable = () => {
    if (!table.length) return;
    const rows = table
      .filter((row) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(row))
      .map((row, index) => {
        const cells = row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => inlineMarkdown(cell.trim()));
        const tag = index === 0 ? "th" : "td";
        return `<tr>${cells.map((cell) => `<${tag}>${cell}</${tag}>`).join("")}</tr>`;
      });
    html.push(`<table>${rows.join("")}</table>`);
    table = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushBlockquote();
    flushTable();
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
        code = [];
      } else {
        flushAll();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*\|.+\|\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      table.push(line);
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      flushTable();
      blockquote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      if (!list || list.type !== "ul") list = { type: "ul", items: [] };
      list.items.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      if (!list || list.type !== "ol") list = { type: "ol", items: [] };
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    flushTable();
    paragraph.push(line.trim());
  }

  flushAll();
  return html.join("\n");
}

function pageShell({ title, body, active = "latest" }) {
  const nav = [
    ["latest", "最新", "./"],
    ["archive", "归档", "./archive.html"],
    ["md", "Markdown", "./latest.md"],
    ["json", "JSON", "./latest.json"],
  ];
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./assets/site.css">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="brand">博士热点简报</div>
      <nav class="nav">
        ${nav.map(([key, label, href]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
      </nav>
    </div>
  </header>
  <main class="page">
${body}
  </main>
</body>
</html>
`;
}

async function copyIfExists(from, to) {
  try {
    await fs.copyFile(from, to);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listReports() {
  const reportsDir = path.join(docsDir, "reports");
  let dateDirs = [];
  try {
    dateDirs = await fs.readdir(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const reports = [];
  for (const dirent of dateDirs) {
    if (!dirent.isDirectory()) continue;
    const date = dirent.name;

    let runDirs = [];
    try {
      runDirs = (await fs.readdir(path.join(reportsDir, date), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory());
    } catch {
      runDirs = [];
    }

    for (const runDirent of runDirs) {
      const runId = runDirent.name;
      const runDir = path.join(reportsDir, date, runId);
      const reportJson = path.join(runDir, "report.json");
      let meta = {};
      let manifest = {};
      try {
        meta = JSON.parse(await fs.readFile(reportJson, "utf8"));
      } catch {
        meta = {};
      }
      try {
        manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8"));
      } catch {
        manifest = {};
      }
      reports.push({
        date,
        runId,
        label: manifest.label || `${date} ${displayTime(meta.generated_at) || displayTime(runId)}`,
        generatedAt: meta.generated_at || "",
        publishedAt: manifest.published_at || meta.generated_at || date,
        total: meta.total_hotspots || "",
        main: Array.isArray(meta.main_board) ? meta.main_board.length : "",
        mode: meta.mode || "",
        hrefBase: `./reports/${date}/${runId}`,
      });
    }

    if (!runDirs.length) {
      const reportJson = path.join(reportsDir, date, "report.json");
      let meta = {};
      try {
        meta = JSON.parse(await fs.readFile(reportJson, "utf8"));
      } catch {
        meta = {};
      }
      reports.push({
        date,
        runId: "",
        label: date,
        generatedAt: meta.generated_at || "",
        publishedAt: meta.generated_at || date,
        total: meta.total_hotspots || "",
        main: Array.isArray(meta.main_board) ? meta.main_board.length : "",
        mode: meta.mode || "",
        hrefBase: `./reports/${date}`,
      });
    }
  }
  return reports.sort((a, b) => {
    const bTime = Date.parse(b.publishedAt) || 0;
    const aTime = Date.parse(a.publishedAt) || 0;
    if (bTime !== aTime) return bTime - aTime;
    return String(b.label).localeCompare(String(a.label));
  });
}

async function main() {
  const markdown = await fs.readFile(latestMdPath, "utf8");
  const reportJson = JSON.parse(await fs.readFile(latestJsonPath, "utf8"));
  const date = slugDate(reportJson.date || reportJson.generated_at || markdown);
  const generatedAt = reportJson.generated_at || "";
  const runId = runSlug(generatedAt || new Date().toISOString());
  const reportDir = path.join(docsDir, "reports", date);
  const runReportDir = path.join(reportDir, runId);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.mkdir(runReportDir, { recursive: true });
  await fs.mkdir(path.join(docsDir, "assets"), { recursive: true });

  await fs.copyFile(latestMdPath, path.join(docsDir, "latest.md"));
  await fs.copyFile(latestJsonPath, path.join(docsDir, "latest.json"));
  await fs.copyFile(latestMdPath, path.join(reportDir, "report.md"));
  await fs.copyFile(latestJsonPath, path.join(reportDir, "report.json"));
  await fs.copyFile(latestMdPath, path.join(runReportDir, "report.md"));
  await fs.copyFile(latestJsonPath, path.join(runReportDir, "report.json"));

  const evidenceCandidates = [
    path.join(sourceDir, `websearch-evidence-${date}.json`),
    path.join(sourceDir, "websearch-evidence.json"),
  ];
  for (const candidate of evidenceCandidates) {
    if (await copyIfExists(candidate, path.join(reportDir, "evidence.json"))) {
      await fs.copyFile(path.join(reportDir, "evidence.json"), path.join(runReportDir, "evidence.json"));
      break;
    }
  }

  const manifestPath = path.join(runReportDir, "manifest.json");
  let existingManifest = {};
  try {
    existingManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    existingManifest = {};
  }
  await fs.writeFile(manifestPath, JSON.stringify({
    date,
    run_id: runId,
    label: `${date} ${displayTime(generatedAt) || displayTime(runId)}`,
    generated_at: generatedAt,
    published_at: existingManifest.published_at || new Date().toISOString(),
    total_hotspots: reportJson.total_hotspots || "",
    main_board_count: Array.isArray(reportJson.main_board) ? reportJson.main_board.length : "",
    mode: reportJson.mode || "",
  }, null, 2) + "\n", "utf8");

  const body = `<div class="meta">更新日期：${escapeHtml(date)}${generatedAt ? ` ｜ 生成时间：${escapeHtml(generatedAt)}` : ""}</div>
<div class="toolbar">
  <a class="button" href="./latest.md">下载 Markdown</a>
  <a class="button" href="./latest.json">下载 JSON</a>
  <a class="button" href="./reports/${date}/${runId}/report.md">查看本期 Markdown</a>
  <a class="button" href="./reports/${date}/${runId}/report.json">查看本期 JSON</a>
</div>
<article class="report">
${renderMarkdown(markdown)}
</article>`;
  await fs.writeFile(path.join(docsDir, "index.html"), pageShell({ title: `博士热点简报 ${date}`, body }), "utf8");

  const reports = await listReports();
  const archiveRows = reports.map((report) => `<tr>
  <td>${escapeHtml(report.label)}</td>
  <td>${escapeHtml(report.generatedAt)}</td>
  <td>${escapeHtml(report.total)}</td>
  <td>${escapeHtml(report.main)}</td>
  <td>${escapeHtml(report.mode)}</td>
  <td><a href="${report.hrefBase}/report.md">MD</a> · <a href="${report.hrefBase}/report.json">JSON</a> · <a href="${report.hrefBase}/evidence.json">Evidence</a></td>
</tr>`).join("");
  const archiveBody = reports.length
    ? `<h1>历史简报</h1><p class="meta">共 ${reports.length} 期。最新一期会同步到首页、latest.md 和 latest.json；同一天多次生成会全部保留。</p><table class="archive-table"><thead><tr><th>期数</th><th>生成时间</th><th>热点数</th><th>主榜</th><th>生成方式</th><th>文件</th></tr></thead><tbody>${archiveRows}</tbody></table>`
    : '<div class="empty">还没有归档报告。</div>';
  await fs.writeFile(path.join(docsDir, "archive.html"), pageShell({ title: "博士热点简报归档", body: archiveBody, active: "archive" }), "utf8");

  console.log(JSON.stringify({ date, reports: reports.length, latest: path.join(docsDir, "index.html") }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
