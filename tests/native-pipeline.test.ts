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
