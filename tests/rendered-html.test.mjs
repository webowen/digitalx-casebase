import assert from "node:assert/strict";
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

test("renders the V1.4 map case workbench without replacing the home page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/workbench", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /地图案例工作台/);
  assert.match(html, /案例目录/);
  assert.match(html, /按分类/);
  assert.match(html, /按地区/);
  assert.match(html, /按专题/);
  assert.match(html, /筛选与分析/);
  assert.match(html, /完整阅读/);
  assert.match(html, /城市聚合图层/);
  assert.match(html, /当前工作台状态可分享/);
  assert.match(html, /省域/);
  assert.match(html, /项目阶段/);
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
