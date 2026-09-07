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
  assert.match(html, /开始标杆案例自动生产/);
  assert.match(html, /成熟报告保留原结构，零散材料才按精简案例框架组织文章/);
  assert.match(html, /项目名称/);
  assert.match(html, /大湾区文体中心黄金样例/);
  assert.match(html, /标杆报告模式/);
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
  assert.match(pipelineSource, /version: benchmarkMode \? "1\.2" : "1\.1"/);
  assert.match(pipelineSource, /联网资料研究/);
  assert.match(nativeProtocolSource, /项目身份与基础字段解析器/);
  assert.match(nativeProtocolSource, /事实与证据分析器/);
  assert.match(nativeProtocolSource, /资深案例编辑/);
  assert.match(nativeProtocolSource, /标杆报告写作要求/);
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
  assert.match(html, /智慧城市及数据要素典型应用案例一张图/);
  assert.match(html, /Smart City and Data Element Application Case Portfolio Map/);
  assert.match(html, /案例目录/);
  assert.match(html, /按分类/);
  assert.match(html, /按地区/);
  assert.match(html, /按专题/);
  assert.match(html, /新增案例/);
  assert.match(html, /Digital X AI/);
  assert.match(html, /当前地图筛选结果/);
  assert.match(html, /来源引用/);
  const workbenchSource = await readFile(
    new URL("../app/workbench/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workbenchSource, /这个项目为什么建设/);
  assert.match(workbenchSource, /实际建设了什么/);
  assert.match(workbenchSource, /数据从哪里来/);
  assert.match(workbenchSource, /有哪些业务闭环/);
  assert.match(html, /案例资产/);
  assert.match(html, /选择省份/);
});

test("directory and POI selection share the selectedCaseId navigation model", async () => {
  const source = await readFile(
    new URL("../app/workbench/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /parseReportFile/);
  assert.match(source, /accept="\.docx,\.zip,\.md,\.markdown"/);
  const focusCaseBody = source.match(
    /const focusCaseOnMap = useCallback\(\(item: SmartCityCase\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/,
  )?.[1];
  const poiBody = source.match(
    /const selectCasePoint = useCallback\(\(id: string\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/,
  )?.[1];

  assert.ok(focusCaseBody);
  assert.ok(poiBody);
  assert.match(focusCaseBody, /selectCase\([^;]+"directory"\)/s);
  assert.match(focusCaseBody, /setSelectedCaseId\(next\.selectedCaseId\)/);
  assert.match(focusCaseBody, /setCaseFocusRequest\(\(request\) => request \+ 1\)/);
  assert.match(focusCaseBody, /setActiveProvince\(next\.province\)/);
  assert.match(focusCaseBody, /setActiveCity\(next\.city\)/);
  assert.match(poiBody, /selectCase\([^;]+"poi"\)/s);
  assert.match(poiBody, /setDocumentOpen\(next\.documentOpen\)/);
  assert.match(source, /caseFocusRequest=\{caseFocusRequest\}/);
  assert.match(source, /查看案例/);
  assert.match(source, /选择省份/);
  assert.match(source, /选择城市/);
  assert.match(source, /provinceOptions/);
  assert.match(source, /getAdministrativeFocusPlace/);
  const mapSource = await readFile(
    new URL("../components/amap-case-map.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(mapSource, /className = "amap-case-popup"/);
  assert.match(mapSource, /查看案例/);
  assert.match(mapSource, /pin\.addEventListener\("click"/);
  assert.match(mapSource, /new AMap\.Marker\(/);
  assert.doesNotMatch(mapSource, /new AMap\.InfoWindow\(/);
  assert.match(mapSource, /new AMap\.DistrictSearch\(/);
  assert.match(mapSource, /new AMap\.Polygon\(/);
  assert.match(mapSource, /new AMap\.TileLayer\.Satellite\(/);
  assert.match(mapSource, /new AMap\.TileLayer\.RoadNet\(/);
  assert.match(mapSource, /amap:\/\/styles\/whitesmoke/);
  assert.match(mapSource, /features: \["bg", "point", "road", "building"\]/);
  assert.match(mapSource, /map\.setFeatures\(\["bg", "point", "road", "building"\]\)/);
  assert.match(mapSource, /map\.setLayers\(\[new AMap\.TileLayer\(\{ zIndex: 1 \}\)\]\)/);
  assert.match(mapSource, /aria-label="地图底图切换"/);
  assert.match(mapSource, /卫星影像/);
  assert.doesNotMatch(mapSource, /amap:\/\/styles\/light/);
  assert.match(mapSource, /point\.id === selectedPoint\.id/);
  assert.doesNotMatch(mapSource, /createShenzhenStarElement/);
  assert.match(mapSource, /const \{ precise, districts \} = splitCityMapPoints/);
  assert.match(mapSource, /new AMap\.MarkerCluster\(map, cityPoints/);
  assert.match(mapSource, /const point = findMarkerPoint\(context\.marker, points\)/);
  assert.match(mapSource, /context\.marker\.setzIndex\?\.\(kind === "case" \? 240 : 220\)/);
  assert.match(mapSource, /context\.marker\.setzIndex\?\.\(point\.active \? 320 : 260\)/);
  assert.equal((mapSource.match(/zIndex: 5,/g) || []).length, 2);
  assert.doesNotMatch(mapSource, /zIndex: (?:70|80),/);
  assert.match(mapSource, /createCaseMarkerElement\(selectedPoint/);
  assert.match(mapSource, /全域应用或待核验项目不生成普通 POI/);
  assert.doesNotMatch(mapSource, /InfoWindow/);
  assert.match(mapSource, /map\.setZoomAndCenter\(/);
  assert.match(mapSource, /Administrative navigation owns the camera/);
  assert.match(source, /view", "document"/);
  assert.match(source, /aria-label="关闭案例文档遮罩"/);
  assert.match(source, /openGroups/);
  assert.match(source, /openSubgroups/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.match(source, /<CaseDocument item=\{activeSelectedCase\}/);
  assert.doesNotMatch(source, /aria-label="关闭案例预览"/);
});

test("supports source-preserved and structured editorial reading", async () => {
  const documentSource = await readFile(
    new URL("../lib/case-document.ts", import.meta.url),
    "utf8",
  );
  const embeddedSource = await readFile(
    new URL("../components/case-document.tsx", import.meta.url),
    "utf8",
  );
  const immersiveSource = await readFile(
    new URL("../components/case-detail-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(documentSource, /contentModel\?\.editorialSections/);
  assert.match(documentSource, /caseDocumentSectionOrder/);
  assert.match(embeddedSource, /source-preserved/);
  assert.match(embeddedSource, /document\.preservesSourceStructure/);
  assert.match(embeddedSource, /第 \{String\(index \+ 1\)\.padStart\(2, "0"\)\} 部分/);
  assert.match(embeddedSource, /沉浸阅读/);
  assert.match(immersiveSource, /buildCaseDocument\(item\)/);
  assert.match(immersiveSource, /document\.preservesSourceStructure/);
  assert.match(immersiveSource, /原报告章节/);
});

test("admin exposes beta benchmark review and batch production governance", async () => {
  const adminSource = await readFile(
    new URL("../app/admin/page.tsx", import.meta.url),
    "utf8",
  );
  const boardSource = await readFile(
    new URL("../components/content-production-board.tsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /ContentProductionBoard/);
  assert.match(adminSource, /advanceCurrentProduction/);
  assert.match(adminSource, /推进到下一生产阶段/);
  assert.match(boardSource, /V1\.5\.0-beta\.1/);
  assert.match(boardSource, /V1\.5\.0-beta\.2/);
  assert.match(boardSource, /三份标杆案例终审驾驶舱/);
  assert.match(boardSource, /17份案例分三批生产/);
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

test("clusters cases in city mid views and fits the national camera to China", async () => {
  const source = await readFile(
    new URL("../components/amap-case-map.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /context\.data/);
  assert.match(source, /context\.marker/);
  assert.match(source, /context\.count/);
  assert.match(source, /displayMode === "city"/);
  assert.match(source, /splitCityMapPoints/);
  assert.match(source, /maxZoom: 11/);
  assert.match(source, /createClusterMarker\(AMap, context, "case"\)/);
  assert.match(source, /context\.clusterData/);
  assert.match(source, /search\.search\("中国"/);
  assert.match(source, /map\.setFitView\(polygons/);
  assert.match(source, /amap-district-marker/);
});

test("keeps national, Guangdong and Shenzhen return controls plus the desktop AI assistant", async () => {
  const workbench = await readFile(new URL("../app/workbench/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(workbench, />\s*全国\s*</);
  assert.match(workbench, />\s*广东省\s*</);
  assert.match(workbench, />\s*深圳市\s*</);
  assert.match(workbench, /RESEARCH ASSISTANT/);
  assert.match(styles, /@media \(min-width: 1024px\)[\s\S]*?\.workbench-panel-right[\s\S]*?translateX\(0\) !important/);
});

test("keeps the immersive paged case reader available for future imported cases", async () => {
  const source = await readFile(
    new URL("../components/case-detail-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /ReadingFlow = "scroll" \| "paged"/);
  assert.match(source, /reader-paged-flow/);
  assert.match(source, /aria-label="下一页"/);
  assert.match(source, /案例导读/);
  assert.match(source, /阅读/);
  assert.match(source, /研读/);
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
