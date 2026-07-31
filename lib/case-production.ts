import type {
  CaseProductionProfile,
  CaseProductionStage,
  SmartCityCase,
} from "./case-model";

export const productionStageLabels: Record<CaseProductionStage, string> = {
  queued: "待进入生产",
  researching: "联网研究",
  evidence_ready: "证据包整理",
  draft_ready: "七章正文成稿",
  quality_review: "质量规则检查",
  final_review: "人工终审",
  approved: "终审通过",
  blocked: "阻断待处理",
};

export const productionStageOrder: CaseProductionStage[] = [
  "queued",
  "researching",
  "evidence_ready",
  "draft_ready",
  "quality_review",
  "final_review",
  "approved",
];

const batchAssignments: Record<
  string,
  Pick<CaseProductionProfile, "waveId" | "waveLabel" | "priority" | "rationale">
> = {
  "case-001": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "深圳低空经济与城市级运行监管具备较高政策热度和业务拓展价值。",
  },
  "case-008": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "防汛应急属于高价值城市安全场景，适合优先建立证据型案例。",
  },
  "case-009": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "雄安数字孪生具有国家战略示范性，适合作为城市级底座类标杆。",
  },
  "case-015": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "山地城市CIM与地下空间治理能够补齐复杂空间治理类型。",
  },
  "case-016": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "极端天气与生命线监测具有明确治理闭环和可核验业务指标。",
  },
  "case-020": {
    waveId: "beta2-wave-01",
    waveLabel: "第一批｜底座、安全与韧性",
    priority: "P0",
    rationale: "时空大数据平台可支撑CIM、数字孪生和多部门应用的共性底座研究。",
  },
  "case-007": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "数字孪生园区运营与用户的工程建设、资产运营方向高度相关。",
  },
  "case-010": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "港城联动能够补充交通物流和城市运行协同案例。",
  },
  "case-011": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "城市云脑适合与北京、杭州案例进行横向比较。",
  },
  "case-012": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "区市联动一网统管可验证不同层级治理机制。",
  },
  "case-014": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "水环境监管具备感知、预警、处置和复核的完整场景链。",
  },
  "case-018": {
    waveId: "beta2-wave-02",
    waveLabel: "第二批｜园区、交通与城市运行",
    priority: "P1",
    rationale: "工业互联网与能耗管理可补充园区生产运营类案例。",
  },
  "case-002": {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2",
    rationale: "与深圳低空案例形成同类对照，待第一批方法稳定后再生产。",
  },
  "case-006": {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2",
    rationale: "生态价值转化需要补充资金与运营机制证据后再进入正文生产。",
  },
  "case-013": {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2",
    rationale: "政务智能问答更新较快，需在生产时重点核对模型与实际办事闭环。",
  },
  "case-017": {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2",
    rationale: "智慧停车适合作为成熟专题应用，在前两批后统一补充。",
  },
  "case-019": {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2",
    rationale: "智慧文旅需同时核验公共服务和消费转化证据。",
  },
};

export function contentCharacterCount(item: SmartCityCase) {
  return (item.contentModel?.editorialSections || []).reduce(
    (total, section) =>
      total +
      section.summary.length +
      section.paragraphs.join("").length +
      section.points.join("").length,
    0,
  );
}

export function createBenchmarkProductionProfile(
  item: SmartCityCase,
): CaseProductionProfile {
  const characters = contentCharacterCount(item);
  const sourceCount = item.contentModel?.sources.length || 0;
  const mediaCount = (item.media || []).filter((media) => media.included).length;
  const nextAction =
    characters < 3_000
      ? `继续扩写正文至至少3,000字（当前${characters}字），但不得用重复内容凑字数。`
      : mediaCount === 0
        ? "补充至少一张可追溯的平台、大屏、架构或现场图片并完成人工复核。"
        : sourceCount < 3
          ? "补充权威来源并建立关键陈述—来源关联。"
          : "由内容负责人完成六项终审门槛。";
  return {
    release: "V1.5.0-beta.1",
    waveId: "beta1-benchmark-01",
    waveLabel: "标杆案例终审批次",
    priority: "P0",
    stage: "final_review",
    ownerRole: "内容负责人",
    targetSourceCount: 3,
    targetCharacterCount: 3_000,
    nextAction,
    rationale: "作为内容规范样板，先完成真实证据、图片和人工终审，再复制到其余案例。",
    lastAdvancedAt: "2026-07-31T00:00:00.000Z",
  };
}

export function createBatchProductionProfile(
  item: SmartCityCase,
): CaseProductionProfile {
  const assignment = batchAssignments[item.id] || {
    waveId: "beta2-wave-03",
    waveLabel: "第三批｜服务、生态与专题应用",
    priority: "P2" as const,
    rationale: "等待前序批次形成稳定生产方法后再处理。",
  };
  return {
    release: "V1.5.0-beta.2",
    ...assignment,
    stage: "queued",
    ownerRole: "案例研究编辑",
    targetSourceCount: 3,
    targetCharacterCount: 3_000,
    nextAction: "先核验正式项目名称和项目边界，再执行不超过两组的定向联网研究。",
    lastAdvancedAt: "2026-07-31T00:00:00.000Z",
  };
}

export function productionReadiness(item: SmartCityCase) {
  const production = item.contentMigration?.production;
  const characters = contentCharacterCount(item);
  const sourceCount = item.contentModel?.sources.length || 0;
  const substantiveSections =
    item.contentModel?.editorialSections.filter(
      (section) =>
        section.claimIds.length > 0 &&
        Boolean(section.summary || section.paragraphs.length || section.points.length),
    ).length || 0;
  const mediaCount = (item.media || []).filter(
    (media) => media.included && media.reviewed,
  ).length;
  const approvedGates =
    item.contentMigration?.reviewGates.filter((gate) => gate.status === "approved")
      .length || 0;
  const blockers: string[] = [];
  if (item.identity?.needsReview !== false) blockers.push("正式项目名称尚未确认");
  if (production && sourceCount < production.targetSourceCount) {
    blockers.push(`权威来源不足${production.targetSourceCount}个`);
  }
  if (substantiveSections < 7) blockers.push("七部分未全部获得事实支撑");
  if (production && characters < production.targetCharacterCount) {
    blockers.push(`正文少于${production.targetCharacterCount.toLocaleString()}字`);
  }
  if (mediaCount === 0) blockers.push("缺少已复核图片证据");
  if (approvedGates < 6) blockers.push(`仍有${6 - approvedGates}项人工门槛未批准`);
  return {
    characters,
    sourceCount,
    substantiveSections,
    mediaCount,
    approvedGates,
    qualityScore: item.contentModel?.quality.score || 0,
    blockers,
    readyForPublish: blockers.length === 0 && Boolean(item.contentModel?.quality.publishable),
  };
}

export function canAdvanceProduction(item: SmartCityCase) {
  const production = item.contentMigration?.production;
  if (!production) return { allowed: false, reason: "案例尚未进入内容生产批次。" };
  const readiness = productionReadiness(item);
  if (production.stage === "queued") return { allowed: true, reason: "" };
  if (production.stage === "researching" && readiness.sourceCount < production.targetSourceCount) {
    return {
      allowed: false,
      reason: `至少补充${production.targetSourceCount}个可追溯来源后才能进入证据整理。`,
    };
  }
  if (
    production.stage === "evidence_ready" &&
    (readiness.substantiveSections < 7 ||
      readiness.characters < production.targetCharacterCount)
  ) {
    return {
      allowed: false,
      reason: "七部分必须全部形成事实支撑，且正文达到目标长度后才能进入成稿。",
    };
  }
  if (production.stage === "quality_review" && readiness.qualityScore < 70) {
    return { allowed: false, reason: "质量评分达到70分后才能提交人工终审。" };
  }
  if (production.stage === "final_review" && readiness.blockers.length > 0) {
    return { allowed: false, reason: readiness.blockers.join("；") };
  }
  return { allowed: true, reason: "" };
}

export function advanceProduction(item: SmartCityCase): SmartCityCase {
  const production = item.contentMigration?.production;
  if (!production) return item;
  const check = canAdvanceProduction(item);
  if (!check.allowed) return item;
  const currentIndex = productionStageOrder.indexOf(production.stage);
  const nextStage =
    productionStageOrder[Math.min(currentIndex + 1, productionStageOrder.length - 1)];
  return {
    ...item,
    contentMigration: {
      ...item.contentMigration!,
      production: {
        ...production,
        stage: nextStage,
        nextAction:
          nextStage === "researching"
            ? "执行项目身份、建设主体、采购验收、场景与成效的定向联网研究。"
            : nextStage === "evidence_ready"
              ? "整理事实陈述、来源关系、主体角色、数据资产、指标和图片候选。"
              : nextStage === "draft_ready"
                ? "按七部分规范生成连续正文，不得脱离证据包新增事实。"
                : nextStage === "quality_review"
                  ? "运行质量评分，解决项目身份、来源、指标、图片和事实冲突问题。"
                  : nextStage === "final_review"
                    ? "由内容负责人逐项批准六项终审门槛。"
                    : "内容生产流程已完成。",
        lastAdvancedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function productionSummary(cases: SmartCityCase[]) {
  const items = cases.filter((item) => item.contentMigration?.production);
  return {
    total: items.length,
    benchmarks: items.filter(
      (item) => item.contentMigration?.production?.release === "V1.5.0-beta.1",
    ).length,
    queued: items.filter(
      (item) => item.contentMigration?.production?.stage === "queued",
    ).length,
    inProduction: items.filter((item) =>
      ["researching", "evidence_ready", "draft_ready", "quality_review"].includes(
        item.contentMigration?.production?.stage || "",
      ),
    ).length,
    finalReview: items.filter(
      (item) => item.contentMigration?.production?.stage === "final_review",
    ).length,
    approved: items.filter(
      (item) => item.contentMigration?.production?.stage === "approved",
    ).length,
  };
}
