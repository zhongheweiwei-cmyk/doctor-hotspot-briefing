#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${DOCTOR_BRIEFING_OUTPUT_DIR:-/Users/weilinliu/user-data/outputs}"
DATE_VALUE="${DOCTOR_BRIEFING_DATE:-$(date +%F)}"
CODEX_BIN="${CODEX_BIN:-/Applications/Codex.app/Contents/Resources/codex}"
SKILL_DIR="${DOCTOR_BRIEFING_SKILL_DIR:-/Users/weilinliu/.codex/skills/doctor-hotspot-briefing}"
PROMPT_FILE="$SKILL_DIR/references/web_search_daily_prompt.md"
CODEX_LAST_MESSAGE="$OUTPUT_DIR/codex-last-message-$DATE_VALUE.txt"

if [[ ! -x "$CODEX_BIN" ]]; then
  echo "Codex CLI not found or not executable: $CODEX_BIN" >&2
  exit 1
fi

for required in "$SKILL_DIR/SKILL.md" "$SKILL_DIR/references/websearch_collection_protocol.md" "$PROMPT_FILE"; do
  if [[ ! -f "$required" ]]; then
    echo "Required doctor hotspot skill file missing: $required" >&2
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

CODEX_ARGS=(
  --search
  --ask-for-approval never
  exec
  --cd "$REPO_ROOT"
  --sandbox danger-full-access
  --skip-git-repo-check
  --output-last-message "$CODEX_LAST_MESSAGE"
)

if [[ -n "${CODEX_MODEL:-}" ]]; then
  CODEX_ARGS+=(--model "$CODEX_MODEL")
fi

"$CODEX_BIN" "${CODEX_ARGS[@]}" - <<PROMPT
你正在无人值守地生成博士热点简报。必须使用本机最新版 doctor-hotspot-briefing skill 和每日提示词，不要使用旧报告、旧 latest、Claude App、Claude API、Coze 或 XCrawl。

固定输入文件：
- Skill: $SKILL_DIR/SKILL.md
- WebSearch protocol: $SKILL_DIR/references/websearch_collection_protocol.md
- Daily prompt: $PROMPT_FILE

执行要求：
1. 先读取以上三个文件，严格按 Daily prompt 和 websearch_collection_protocol.md 执行。
2. 使用 web_search / live web search 模式收集证据，按 9 层强制覆盖矩阵全打；层3两轮不同关键词；层6中国意识形态/官方议程必须覆盖。
3. 生成正式日报，不要中途提问，不要停在方案。
4. 将产物写入 $OUTPUT_DIR：
   - latest.md
   - latest.json
   - websearch-evidence-$DATE_VALUE.json
5. latest.json 必须包含：
   - date: "$DATE_VALUE"
   - total_hotspots
   - main_board: 10 条
   - extended_board: 15-30 条
   - mode: "Claude web_search 手动模式 / 未调用 XCrawl"
6. latest.md 必须包含：
   - 今日趋势
   - 60秒速览
   - 主榜 10 条
   - 扩展榜
   - 按 8 类分组
   - 数据概览
   - 平台算法信号
   - 信息源清单
   - 9层强制覆盖矩阵执行状态
   - 报告末尾标注：生成方式：Claude web_search 手动模式 / 未调用 XCrawl
7. 不要修改 GitHub Pages 站点文件；发布由后续脚本处理。

现在开始，一口气跑完。
PROMPT

echo "Codex generation finished. Last message: $CODEX_LAST_MESSAGE"
