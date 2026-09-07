import assert from "node:assert/strict";
import test from "node:test";
import { runCaseParserPipeline } from "../lib/ai-case-pipeline";

function deepSeekResponse(content: unknown, index: number) {
  return new Response(
    JSON.stringify({
      id: `deepseek-stage-${index}`,
      choices: [{ message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 100 + index, completion_tokens: 50 + index },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("runs identity, research, evidence and article as distinct native stages", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    tavily: process.env.TAVILY_API_KEY,
    research: process.env.AI_CASE_RESEARCH_PROVIDER,
  };
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.TAVILY_API_KEY = "test-key";
  process.env.AI_CASE_RESEARCH_PROVIDER = "tavily";

  let deepSeekCalls = 0;
  let tavilyCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("api.deepseek.com")) {
      deepSeekCalls += 1;
      const request = JSON.parse(String(init?.body || "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = request.messages?.[0]?.content || "";
      if (prompt.includes("项目身份与基础字段解析器")) {
        return deepSeekResponse(
          {
            protocolVersion: "1.0",
            compatible: true,
            incompatibilityReason: "",
            case: {
              title: "湖北省BIM云平台智慧工地监管系统",
              province: "湖北省",
              city: "武汉市",
              district: "",
              category: "CIM / 数字孪生",
              year: 2024,
              owner: "湖北省住房和城乡建设厅",
              locationLevel: "省级",
              coverageType: "省域统筹",
              sourceType: "新闻报道",
              evidenceLevel: "中",
              summary: "面向省域智慧工地监管建设的BIM云平台。",
              painPoints: ["项目数据分散"],
              solution: ["汇聚项目BIM与监管数据"],
              outcomes: [],
              aiTags: ["BIM", "智慧工地"],
              expertView: "",
              sourceTitle: "湖北省BIM云平台介绍",
              sourceExcerpt: "建设湖北省BIM云平台智慧工地监管系统。",
              projectStage: "验收运营",
              investmentAmount: "",
              fundingSource: "",
              implementationUnit: "",
              operationUnit: "",
              lng: 114.3055,
              lat: 30.5928,
              locationConfidence: 0.55,
              locationMethod: "province_capital_default",
              locationReason: "省级项目使用武汉市中心作为展示锚点。",
              researchReport: "",
            },
            identity: {
              canonicalTitle: "湖北省BIM云平台智慧工地监管系统",
              candidates: ["湖北省BIM云平台智慧工地监管系统"],
              aliases: ["湖北省BIM云平台"],
              confidence: 0.65,
              needsReview: true,
              reason: "等待联网证据确认。",
              evidence: [],
            },
            mediaPlan: [],
            fieldAssessments: [
              {
                field: "title",
                confidence: 0.65,
                evidence: "原文标题",
                needsReview: true,
                reason: "需联网确认",
              },
            ],
            reviewItems: ["确认正式项目名称"],
          },
          deepSeekCalls,
        );
      }
      if (prompt.includes("事实与证据分析器")) {
        return deepSeekResponse(
          {
            protocolVersion: "1.0",
            identityResolution: {
              canonicalTitle: "湖北省建筑工程BIM云平台智慧工地监管系统",
              candidates: [
                "湖北省建筑工程BIM云平台智慧工地监管系统",
                "湖北省BIM云平台智慧工地监管系统",
              ],
              aliases: ["湖北省BIM云平台"],
              confidence: 0.88,
              needsReview: false,
              reason: "联网来源给出完整名称。",
              evidence: [
                {
                  sourceId: "source-1",
                  quote: "湖北省建筑工程BIM云平台智慧工地监管系统",
                },
              ],
            },
            claims: [
              {
                id: "claim-1",
                statement: "项目面向省域智慧工地监管。",
                type: "source_claim",
                evidenceStatus: "source_claimed",
                sourceIds: ["source-1"],
                sectionId: "project_overview",
                confidence: 0.75,
                conflict: "",
              },
            ],
            organizations: [
              {
                name: "湖北省住房和城乡建设厅",
                role: "建设/牵头",
                sourceIds: ["source-1"],
              },
            ],
            dataAssets: [
              {
                name: "工程项目BIM数据",
                category: "工程建设",
                source: "建设项目",
                usage: "智慧工地监管",
                sensitivity: "内部",
                sourceIds: ["source-1"],
              },
            ],
            scenarios: [
              {
                id: "scenario-1",
                name: "智慧工地监管",
                problem: "项目数据分散",
                dataInputs: ["工程项目BIM数据"],
                systemActions: ["汇聚与关联"],
                businessActions: ["监管人员核查"],
                result: "形成统一监管视图",
                sourceIds: ["source-1"],
              },
            ],
            metrics: [],
            milestones: [],
            limitations: ["公开资料未披露量化成效"],
            replicationConditions: ["需要统一工程数据标准"],
            reviewItems: ["核验实际运行成效"],
          },
          deepSeekCalls,
        );
      }
      assert.match(prompt, /资深案例编辑/);
      return deepSeekResponse(
        {
          protocolVersion: "1.0",
          contentLevel: "quick",
          standfirst: "该项目面向湖北省域智慧工地监管。",
          keyFindings: ["以BIM数据支撑统一监管"],
          sections: [
            {
              id: "project_overview",
              title: "项目概况",
              summary: "项目建设省域智慧工地监管能力。",
              paragraphs: ["项目以工程项目BIM数据为基础。"],
              points: [],
              claimIds: ["claim-1"],
              mediaIds: [],
            },
          ],
        },
        deepSeekCalls,
      );
    }
    if (url.includes("api.tavily.com")) {
      tavilyCalls += 1;
      return new Response(
        JSON.stringify({
          results: [
            {
              title: `检索来源${tavilyCalls}`,
              url: `https://example.com/source-${tavilyCalls}`,
              content: "湖北省BIM云平台智慧工地监管系统相关公开资料。",
              score: 0.9,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = await runCaseParserPipeline({
      sourceText: "湖北省建设BIM云平台智慧工地监管系统。",
      sourceUrl: "https://example.com/original",
      file: null,
      researchMode: true,
      mediaCandidates: [],
    });

    assert.equal(deepSeekCalls, 3);
    assert.equal(tavilyCalls, 2);
    assert.equal(response.meta.pipeline.version, "1.1");
    assert.equal(response.result.contentModel?.generationMode, "native");
    assert.equal(response.result.contentModel?.editorialSections.length, 7);
    assert.deepEqual(
      response.result.contentModel?.editorialSections.map(
        (section) => section.id,
      ),
      [
        "project_overview",
        "why_build",
        "how_build",
        "core_scenarios",
        "implementation_operation",
        "innovation_outcomes",
        "lessons_boundaries",
      ],
    );
    assert.equal(
      response.result.case.title,
      "湖北省建筑工程BIM云平台智慧工地监管系统",
    );
    assert.equal(response.result.identity.needsReview, false);
    assert.equal(response.result.contentModel?.claims[0]?.sourceIds[0], "source-1");
    assert.equal(response.result.contentModel?.dataAssets.length, 1);
    assert.equal(response.result.contentModel?.scenarios.length, 1);
    assert.equal(
      response.meta.pipeline.stages.find(
        (stage) => stage.id === "fact_evidence_extraction",
      )?.provider,
      "deepseek",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.deepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalEnv.deepseek;
    if (originalEnv.tavily === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = originalEnv.tavily;
    if (originalEnv.research === undefined)
      delete process.env.AI_CASE_RESEARCH_PROVIDER;
    else process.env.AI_CASE_RESEARCH_PROVIDER = originalEnv.research;
  }
});

test("benchmark mode accepts a project name and builds a long-form production chain", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    tavily: process.env.TAVILY_API_KEY,
    research: process.env.AI_CASE_RESEARCH_PROVIDER,
  };
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.TAVILY_API_KEY = "test-key";
  process.env.AI_CASE_RESEARCH_PROVIDER = "tavily";

  let deepSeekCalls = 0;
  let tavilyCalls = 0;
  const sectionIds = [
    "project_overview",
    "why_build",
    "how_build",
    "core_scenarios",
    "implementation_operation",
    "innovation_outcomes",
    "lessons_boundaries",
  ];
  const longParagraph =
    "大湾区文化体育中心智慧运营管理平台案例报告围绕项目事实、建设背景、系统能力、运营机制和复制边界展开，强调以场馆运营管理为主线组织数据、流程、角色和服务能力，避免把宣传材料简单改写成摘要。".repeat(2);

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("api.deepseek.com")) {
      deepSeekCalls += 1;
      const request = JSON.parse(String(init?.body || "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = request.messages?.[0]?.content || "";
      if (prompt.includes("项目身份与基础字段解析器")) {
        assert.match(prompt, /标杆案例生产要求/);
        return deepSeekResponse(
          {
            protocolVersion: "1.0",
            compatible: true,
            incompatibilityReason: "",
            case: {
              title: "大湾区文化体育中心智慧运营管理平台",
              province: "广东省",
              city: "广州市",
              district: "",
              category: "城市运行",
              year: 2026,
              owner: "大湾区文化体育中心",
              locationLevel: "园区/项目点",
              coverageType: "单点项目",
              sourceType: "新闻报道",
              evidenceLevel: "中",
              summary: "面向大型文体场馆运营的智慧管理平台。",
              painPoints: ["场馆运营流程复杂", "多系统协同要求高"],
              solution: ["建设智慧运营管理平台", "统一汇聚场馆运行数据"],
              outcomes: ["获得科创赛事奖项"],
              aiTags: ["智慧场馆", "智慧运营", "数字孪生"],
              expertView: "",
              sourceTitle: "项目名称线索",
              sourceExcerpt: "项目名称：大湾区文化体育中心智慧运营管理平台",
              projectStage: "验收运营",
              investmentAmount: "",
              fundingSource: "",
              implementationUnit: "",
              operationUnit: "",
              lng: 113.2644,
              lat: 23.1291,
              locationConfidence: 0.55,
              locationMethod: "city_center_inferred",
              locationReason: "仅项目名称输入，暂以广州市中心作为展示锚点。",
              researchReport: "",
            },
            identity: {
              canonicalTitle: "大湾区文化体育中心智慧运营管理平台",
              candidates: ["大湾区文化体育中心智慧运营管理平台"],
              aliases: ["大湾区文体中心智慧平台"],
              confidence: 0.6,
              needsReview: true,
              reason: "仅项目名称输入，等待联网核验。",
              evidence: [],
            },
            mediaPlan: [
              {
                candidateId: "candidate-ui-1",
                kind: "platform_ui",
                sectionId: "capabilities",
                caption: "平台界面候选图",
                alt: "智慧运营平台界面",
                confidence: 0.68,
                needsReview: true,
                reason: "附近文字包含智慧平台界面说明。",
              },
            ],
            fieldAssessments: [
              {
                field: "title",
                confidence: 0.6,
                evidence: "用户输入的项目名称",
                needsReview: true,
                reason: "需联网核验正式名称。",
              },
            ],
            reviewItems: ["核验项目正式名称和建设主体"],
          },
          deepSeekCalls,
        );
      }
      if (prompt.includes("事实与证据分析器")) {
        assert.match(prompt, /claims 目标为 18—36 条/);
        return deepSeekResponse(
          {
            protocolVersion: "1.0",
            identityResolution: {
              canonicalTitle: "大湾区文化体育中心智慧运营管理平台",
              candidates: ["大湾区文化体育中心智慧运营管理平台"],
              aliases: ["大湾区文体中心智慧平台"],
              confidence: 0.82,
              needsReview: false,
              reason: "联网来源与原始线索一致。",
              evidence: [{ sourceId: "source-1", quote: "大湾区文化体育中心智慧运营管理平台" }],
            },
            claims: sectionIds.flatMap((sectionId, sectionIndex) =>
              [1, 2, 3].map((number) => ({
                id: `claim-${sectionIndex + 1}-${number}`,
                statement: `第${sectionIndex + 1}章第${number}条事实陈述支撑场馆智慧运营案例报告。`,
                type: "source_claim",
                evidenceStatus: "source_claimed",
                sourceIds: ["source-1"],
                sectionId,
                confidence: 0.76,
                conflict: "",
              })),
            ),
            organizations: [
              {
                name: "大湾区文化体育中心",
                role: "建设/牵头",
                sourceIds: ["source-1"],
              },
            ],
            dataAssets: [
              {
                name: "场馆运行数据",
                category: "城市运营",
                source: "场馆管理系统",
                usage: "运营监测与协同处置",
                sensitivity: "内部",
                sourceIds: ["source-1"],
              },
            ],
            scenarios: [
              {
                id: "scenario-1",
                name: "场馆智慧运营",
                problem: "大型场馆运营对象多、响应链条长。",
                dataInputs: ["设备运行数据", "客流与活动数据"],
                systemActions: ["汇聚监测", "异常预警", "协同派单"],
                businessActions: ["运营人员复核处置"],
                result: "支撑活动保障和日常运维。",
                sourceIds: ["source-1"],
              },
            ],
            metrics: [
              {
                name: "获奖情况",
                value: "三等奖",
                unit: "",
                period: "公开报道期间",
                baseline: "",
                evidenceStatus: "source_claimed",
                sourceIds: ["source-1"],
              },
            ],
            milestones: [{ date: "2026", event: "平台获得科创赛事奖项", sourceIds: ["source-1"] }],
            limitations: ["公开资料未披露完整投资额和量化运营成效。"],
            replicationConditions: ["需要场馆运行数据、设备接口和运营组织协同。"],
            reviewItems: ["核验平台实际模块和图片授权。"],
          },
          deepSeekCalls,
        );
      }
      assert.match(prompt, /标杆报告写作要求/);
      return deepSeekResponse(
        {
          protocolVersion: "1.0",
          contentLevel: "deep",
          standfirst: "该案例以大型文体场馆智慧运营为主线，展示场馆数字化平台从建设到运营的应用价值。",
          keyFindings: ["场馆运营是主线", "数据与流程协同是核心", "公开成效仍需复核"],
          sections: sectionIds.map((sectionId, sectionIndex) => ({
            id: sectionId,
            title: [
              "项目概况",
              "为什么建设",
              "如何建设",
              "核心场景与业务闭环",
              "实施与运营",
              "创新与实际成效",
              "经验、边界与适用条件",
            ][sectionIndex],
            summary: `第${sectionIndex + 1}章形成报告化判断。`,
            paragraphs: Array.from(
              { length: 4 },
              (_, paragraphIndex) =>
                `${longParagraph}本段为第${sectionIndex + 1}章第${paragraphIndex + 1}段，用于验证标杆案例生产链能够形成连续长文，而不是短摘要。`,
            ),
            points:
              sectionIndex === 2
                ? ["建议补充平台界面图、运营大屏图和系统架构图。"]
                : [],
            claimIds: [`claim-${sectionIndex + 1}-1`, `claim-${sectionIndex + 1}-2`],
            mediaIds: sectionIndex === 2 ? ["candidate-ui-1"] : [],
          })),
        },
        deepSeekCalls,
      );
    }
    if (url.includes("api.tavily.com")) {
      tavilyCalls += 1;
      return new Response(
        JSON.stringify({
          results: [
            {
              title: `大湾区文体中心来源${tavilyCalls}`,
              url: `https://example.com/bay-area-source-${tavilyCalls}`,
              content: "大湾区文化体育中心智慧运营管理平台相关公开资料，包含建设内容、平台能力、获奖和运营线索。",
              score: 0.9,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const response = await runCaseParserPipeline({
      sourceText: "项目名称：大湾区文化体育中心智慧运营管理平台",
      sourceUrl: "",
      file: null,
      researchMode: true,
      productionMode: "benchmark",
      mediaCandidates: [
        {
          id: "candidate-ui-1",
          sourceKind: "pdf_page",
          pageNumber: 3,
          sourceUrl: "",
          nearbyText: "智慧运营平台界面与运营大屏",
          visualScore: 0.92,
        },
      ],
    });

    const articleChars =
      response.result.contentModel?.editorialSections.reduce(
        (total, section) =>
          total +
          section.summary.length +
          section.paragraphs.join("").length +
          section.points.join("").length,
        0,
      ) || 0;
    assert.equal(deepSeekCalls, 3);
    assert.equal(tavilyCalls, 4);
    assert.equal(response.meta.benchmarkMode, true);
    assert.equal(response.meta.pipeline.version, "1.2");
    assert.equal(response.result.case.title, "大湾区文化体育中心智慧运营管理平台");
    assert.equal(response.result.contentModel?.contentLevel, "deep");
    assert.ok(articleChars >= 3_000);
    assert.equal(
      response.meta.pipeline.stages.find((stage) => stage.id === "article_generation")?.status,
      "completed",
    );
    assert.ok(
      response.result.contentModel?.editorialSections.some((section) =>
        section.mediaIds.includes("candidate-ui-1"),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.deepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalEnv.deepseek;
    if (originalEnv.tavily === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = originalEnv.tavily;
    if (originalEnv.research === undefined)
      delete process.env.AI_CASE_RESEARCH_PROVIDER;
    else process.env.AI_CASE_RESEARCH_PROVIDER = originalEnv.research;
  }
});

test("stops after identity when the source is not a compatible case", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /api\.deepseek\.com/);
    calls += 1;
    return deepSeekResponse(
      {
        protocolVersion: "1.0",
        compatible: false,
        incompatibilityReason: "该资料是普通活动通知，不属于城市数字化项目。",
        case: {
          title: "",
          province: "",
          city: "",
          district: "",
          category: "城市运行",
          year: 0,
          owner: "",
          locationLevel: "市级",
          coverageType: "城市级平台",
          sourceType: "新闻报道",
          evidenceLevel: "弱",
          summary: "",
          painPoints: [],
          solution: [],
          outcomes: [],
          aiTags: [],
          expertView: "",
          sourceTitle: "活动通知",
          sourceExcerpt: "",
          projectStage: "前期谋划",
          investmentAmount: "",
          fundingSource: "",
          implementationUnit: "",
          operationUnit: "",
          lng: 0,
          lat: 0,
          locationConfidence: 0,
          locationMethod: "city_center_inferred",
          locationReason: "",
          researchReport: "",
        },
        identity: {
          canonicalTitle: "",
          candidates: [],
          aliases: [],
          confidence: 0,
          needsReview: true,
          reason: "没有识别到项目。",
          evidence: [],
        },
        mediaPlan: [],
        fieldAssessments: [],
        reviewItems: [],
      },
      calls,
    );
  };

  try {
    const response = await runCaseParserPipeline({
      sourceText: "欢迎参加本周末普通公益活动。",
      sourceUrl: "",
      file: null,
      researchMode: true,
      mediaCandidates: [],
    });
    assert.equal(calls, 1);
    assert.equal(response.meta.searchQueryCount, 0);
    assert.equal(response.meta.pipeline.status, "blocked");
    assert.equal(
      response.meta.pipeline.stages.find(
        (stage) => stage.id === "project_identity",
      )?.status,
      "blocked",
    );
    assert.doesNotMatch(
      response.meta.pipeline.stages.find(
        (stage) => stage.id === "project_identity",
      )?.message || "",
      /“”/,
    );
    assert.equal(
      response.meta.pipeline.stages.find(
        (stage) => stage.id === "web_research",
      )?.status,
      "skipped",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  }
});

test("keeps a review-required source title candidate when models omit the canonical title", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /api\.deepseek\.com/);
    calls += 1;
    const request = JSON.parse(String(init?.body || "{}")) as {
      messages?: Array<{ content?: string }>;
    };
    const prompt = request.messages?.[0]?.content || "";
    if (prompt.includes("项目身份与基础字段解析器")) {
      return deepSeekResponse(
        {
          protocolVersion: "1.0",
          compatible: true,
          incompatibilityReason: "",
          case: {
            title: "",
            province: "湖北省",
            city: "武汉市",
            district: "",
            category: "CIM / 数字孪生",
            year: 0,
            owner: "",
            locationLevel: "省级",
            coverageType: "省域统筹",
            sourceType: "新闻报道",
            evidenceLevel: "弱",
            summary: "",
            painPoints: [],
            solution: [],
            outcomes: [],
            aiTags: [],
            expertView: "",
            sourceTitle: "",
            sourceExcerpt: "",
            projectStage: "前期谋划",
            investmentAmount: "",
            fundingSource: "",
            implementationUnit: "",
            operationUnit: "",
            lng: 114.3055,
            lat: 30.5928,
            locationConfidence: 0.45,
            locationMethod: "province_capital_default",
            locationReason: "使用省会作为展示锚点。",
            researchReport: "",
          },
          identity: {
            canonicalTitle: "",
            candidates: [],
            aliases: [],
            confidence: 0,
            needsReview: true,
            reason: "",
            evidence: [],
          },
          mediaPlan: [],
          fieldAssessments: [],
          reviewItems: [],
        },
        calls,
      );
    }
    if (prompt.includes("事实与证据分析器")) {
      return deepSeekResponse(
        {
          protocolVersion: "1.0",
          identityResolution: {
            canonicalTitle: "",
            candidates: [],
            aliases: [],
            confidence: 0,
            needsReview: true,
            reason: "联网证据不足。",
            evidence: [],
          },
          claims: [
            {
              id: "claim-1",
              statement: "材料提到湖北省建设BIM云平台。",
              type: "source_claim",
              evidenceStatus: "source_claimed",
              sourceIds: ["source-original"],
              sectionId: "project_overview",
              confidence: 0.6,
              conflict: "",
            },
          ],
          organizations: [],
          dataAssets: [],
          scenarios: [],
          metrics: [],
          milestones: [],
          limitations: ["正式名称待核验"],
          replicationConditions: [],
          reviewItems: ["确认正式名称"],
        },
        calls,
      );
    }
    return deepSeekResponse(
      {
        protocolVersion: "1.0",
        contentLevel: "quick",
        standfirst: "项目名称仍待核验。",
        keyFindings: [],
        sections: [
          {
            id: "project_overview",
            title: "项目概况",
            summary: "材料提到湖北省建设BIM云平台。",
            paragraphs: [],
            points: [],
            claimIds: ["claim-1"],
            mediaIds: [],
          },
        ],
      },
      calls,
    );
  };

  try {
    const response = await runCaseParserPipeline({
      sourceText:
        "来源标题：监管“看得见”！湖北省BIM云平台智慧工地监管系统上线",
      sourceUrl: "",
      file: null,
      researchMode: false,
      mediaCandidates: [],
    });
    assert.equal(calls, 3);
    assert.equal(
      response.result.case.title,
      "湖北省BIM云平台智慧工地监管系统",
    );
    assert.equal(response.result.identity.needsReview, true);
    assert.ok(response.result.identity.confidence <= 0.45);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  }
});
