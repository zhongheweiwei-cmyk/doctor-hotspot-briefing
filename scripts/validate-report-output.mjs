#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const sourceDir = process.env.DOCTOR_BRIEFING_OUTPUT_DIR || "/Users/weilinliu/user-data/outputs";
const expectedDate = process.env.DOCTOR_BRIEFING_DATE || new Date().toISOString().slice(0, 10);

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function readRequired(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function reportDate(reportJson, markdown) {
  const candidates = [
    reportJson.date,
    reportJson.generated_at,
    reportJson.generatedAt,
    markdown,
  ];
  for (const value of candidates) {
    const text = String(value || "");
    const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const cn = text.match(/\d{4}年\d{2}月\d{2}日/)?.[0];
    if (cn) return cn.replace("年", "-").replace("月", "-").replace("日", "");
  }
  return expectedDate;
}

function countTotal(reportJson) {
  if (Number.isFinite(reportJson.total_hotspots)) return reportJson.total_hotspots;
  if (Array.isArray(reportJson.items)) return reportJson.items.length;
  const main = Array.isArray(reportJson.main_board) ? reportJson.main_board.length : 0;
  const extended = Array.isArray(reportJson.extended_board) ? reportJson.extended_board.length : 0;
  return main + extended;
}

const latestMdPath = path.join(sourceDir, "latest.md");
const latestJsonPath = path.join(sourceDir, "latest.json");
const markdown = readRequired(latestMdPath, "latest.md");
const reportJson = parseJson(readRequired(latestJsonPath, "latest.json"), "latest.json");
const date = reportDate(reportJson, markdown);
const evidencePath = path.join(sourceDir, `websearch-evidence-${date}.json`);
const fallbackEvidencePath = path.join(sourceDir, "websearch-evidence.json");
const evidenceText = fs.existsSync(evidencePath)
  ? readRequired(evidencePath, "websearch evidence")
  : readRequired(fallbackEvidencePath, "fallback websearch evidence");
const evidenceJson = parseJson(evidenceText, "websearch evidence");

if (!Array.isArray(reportJson.main_board)) fail("latest.json main_board must be an array");
if (reportJson.main_board.length !== 10) fail(`main_board must contain 10 items, got ${reportJson.main_board.length}`);

const total = countTotal(reportJson);
if (total < 25 || total > 40) fail(`total hotspots must be 25-40, got ${total}`);

if (!Array.isArray(evidenceJson.items)) fail("evidence JSON must contain items array");
if (evidenceJson.items.length < 25 || evidenceJson.items.length > 50) {
  fail(`evidence items must be 25-50, got ${evidenceJson.items.length}`);
}

const heatVerified = evidenceJson.items.filter((item) => item?.heat_evidence?.heat_verified === true).length;
if (heatVerified < 25) fail(`heat-verified evidence items must be at least 25, got ${heatVerified}`);

if (!/9\s*层.*覆盖矩阵/.test(markdown)) fail("latest.md must mention 9层强制覆盖矩阵");
if (!markdown.includes("生成方式：Claude web_search 手动模式 / 未调用 XCrawl")) {
  fail("latest.md must include the required generation mode marker");
}

const requiredSections = ["今日趋势", "60秒速览", "主榜", "扩展榜", "按 8 类分组", "数据概览", "平台算法信号", "信息源清单"];
for (const section of requiredSections) {
  if (!markdown.includes(section)) fail(`latest.md missing section marker: ${section}`);
}

console.log(JSON.stringify({
  ok: true,
  date,
  total_hotspots: total,
  main_board: reportJson.main_board.length,
  evidence_items: evidenceJson.items.length,
  heat_verified: heatVerified,
}, null, 2));
