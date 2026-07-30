import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const runtimeEnv = {
  DEEPSEEK_API_KEY: "test-only-placeholder",
  DASHSCOPE_API_KEY: "test-only-placeholder",
  WSA_API_KEY: "test-only-placeholder",
  ZHIPU_API_KEY: "test-only-placeholder",
  TAVILY_API_KEY: "test-only-placeholder",
  AI_CASE_RESEARCH_PROVIDER: "tavily",
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("renders development preview metadata", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders the real AI parser entry in the admin workspace", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/admin", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /DeepSeek基础解析 · Tavily联网研究/);
  assert.match(html, /开始真实AI结构化解析/);
  assert.match(html, /Tavily核验正式项目名称并补充权威资料/);
  assert.match(html, /低成本模式/);
  assert.match(html, /只明确省份时，以省会城市中心作为地图展示锚点/);
});

test("keeps the compatibility content model and visible parser pipeline", async () => {
  const modelSource = await readFile(
    new URL("../lib/case-model.ts", import.meta.url),
    "utf8",
  );
  const compatibilitySource = await readFile(
    new URL("../lib/case-content-model.ts", import.meta.url),
    "utf8",
  );
  const pipelineSource = await readFile(
    new URL("../lib/ai-case-pipeline.ts", import.meta.url),
    "utf8",
  );
  const nativeProtocolSource = await readFile(
    new URL("../lib/ai-case-native-protocol.ts", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL("../app/admin/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(modelSource, /contentModel\?: CaseContentModel/);
  assert.match(modelSource, /parsePipeline\?: CasePipelineRun/);
  assert.match(compatibilitySource, /normalizeCaseContentModel/);
  assert.match(compatibilitySource, /publishable: score >= 70/);
  assert.match(pipelineSource, /human_review_pending/);
  assert.match(pipelineSource, /researchCaseSources/);
  assert.match(pipelineSource, /requestDeepSeekJson/);
  assert.match(pipelineSource, /version: "1\.1"/);
  assert.match(pipelineSource, /联网资料研究/);
  assert.match(nativeProtocolSource, /项目身份与基础字段解析器/);
  assert.match(nativeProtocolSource, /事实与证据分析器/);
  assert.match(nativeProtocolSource, /资深案例编辑/);
  assert.match(nativeProtocolSource, /identityResolution/);
  assert.match(adminSource, /AI 解析任务链/);
  assert.match(adminSource, /Digital X 内容规范质量/);
  assert.match(adminSource, /V1\.0 原生解析协议/);
});

test("renders the V1.4 map case workbench as the default home page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Digital X 城市数智应用案例库/);
  assert.match(html, /Digital X Urban Digital Intelligence Application Case Library/);
  assert.match(html, /案例目录/);
  assert.match(html, /按分类/);
  assert.match(html, /按地区/);
  assert.match(html, /按专题/);
  assert.match(html, /筛选与分析/);
  assert.match(html, /城市聚合图层/);
  assert.match(html, /当前工作台状态可分享/);
  assert.match(html, /省域/);
});

test("selecting a directory case does not silently narrow the directory to one city", async () => {
  const source = await readFile(
    new URL("../app/workbench/page.tsx", import.meta.url),
    "utf8",
  );
  const selectCaseBody = source.match(
    /const selectCase = useCallback\(\(item: SmartCityCase\) => \{([\s\S]*?)\n  \}, \[\]\);/,
  )?.[1];

  assert.ok(selectCaseBody);
  assert.match(selectCaseBody, /setSelectedCaseSlug\(item\.slug\)/);
  assert.match(selectCaseBody, /setMapLevel\("project"\)/);
  assert.doesNotMatch(selectCaseBody, /setActiveProvince/);
  assert.doesNotMatch(selectCaseBody, /setActiveCity/);
  assert.match(source, /aria-label="关闭案例预览"/);
  assert.match(source, /max-w-xl/);
  assert.match(source, /完整阅读/);
});

test("keeps the V1.3 public home available as a legacy archive", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/legacy", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /从地图找到城市做过的数智项目/);
  assert.match(html, /返回新版/);
});

test("uses only documented MarkerCluster render callback fields", async () => {
  const source = await readFile(
    new URL("../components/amap-case-map.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /context\.data/);
  assert.match(source, /context\.marker/);
  assert.match(source, /context\.count/);
});

test("renders the immersive paged case reader", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/cases/shenzhen-low-altitude-airspace-service", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /flow-paged/);
  assert.match(html, /reader-paged-flow/);
  assert.match(html, /aria-label="下一页"/);
  assert.match(html, /案例要点|案例摘要/);
  assert.match(html, /阅读/);
  assert.match(html, /研读/);
});

test("rejects an empty AI parse request before calling the model", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/ai/parse-case", {
      method: "POST",
      body: new FormData(),
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error?.code, "missing_source");
});

test("rejects an unsafe media object key before storage access", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/media/object?key=../private"),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid media key/);
});

test("rejects a missing media upload before storage access", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: new FormData(),
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 415);
  assert.match(await response.text(), /仅支持 JPG、PNG 或 WebP 图片/);
});
