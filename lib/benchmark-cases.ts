import { evaluateCaseQuality } from "./case-content-model";
import {
  caseDocumentSectionOrder,
  caseDocumentSectionTitles,
} from "./case-document";
import type {
  CaseContentModel,
  CaseContentSection,
  CaseContentSectionId,
  CaseContentSource,
  CaseMetric,
  CaseScenario,
  SmartCityCase,
} from "./case-model";

type BenchmarkDraft = {
  slug: string;
  summary: string;
  owner: string;
  implementationUnit: string;
  operationUnit: string;
  projectStage: SmartCityCase["projectStage"];
  outcomes: string[];
  sources: CaseContentSource[];
  sections: Record<
    CaseContentSectionId,
    { summary: string; paragraphs: string[]; points?: string[]; sourceIds: string[] }
  >;
  scenarios: CaseScenario[];
  metrics: CaseMetric[];
  milestones: NonNullable<CaseContentModel["milestones"]>;
  dataAssets: NonNullable<CaseContentModel["dataAssets"]>;
  limitations: string[];
  replicationConditions: string[];
};

const migratedAt = "2026-07-31T00:00:00.000Z";

function source(
  id: string,
  title: string,
  url: string,
  publisher: string,
  publishedAt: string,
  sourceType: CaseContentSource["sourceType"],
  excerpt: string,
): CaseContentSource {
  return {
    id,
    title,
    url,
    publisher,
    publishedAt,
    sourceType,
    excerpt,
    evidenceLevel: "强",
    reviewed: true,
  };
}

function buildSections(draft: BenchmarkDraft): CaseContentSection[] {
  return caseDocumentSectionOrder.map((id) => {
    const section = draft.sections[id];
    return {
      id,
      title: caseDocumentSectionTitles[id],
      summary: section.summary,
      paragraphs: section.paragraphs,
      points: section.points || [],
      claimIds: [`${draft.slug}-${id}`],
      mediaIds: [],
    };
  });
}

function migrateBenchmarkCase(
  item: SmartCityCase,
  draft: BenchmarkDraft,
): SmartCityCase {
  const editorialSections = buildSections(draft);
  const claims = editorialSections.map((section) => {
    const sourceIds = draft.sections[section.id].sourceIds;
    return {
      id: `${draft.slug}-${section.id}`,
      statement: section.summary,
      type: "source_claim" as const,
      evidenceStatus: "source_claimed" as const,
      sourceIds,
      sectionId: section.id,
      confidence: 0.86,
      conflict: "",
      reviewed: true,
    };
  });
  const withoutQuality: Omit<CaseContentModel, "quality"> = {
    schemaVersion: "1.0",
    generationMode: "native",
    contentLevel: "deep",
    editorialSections,
    sources: draft.sources,
    claims,
    organizations: [
      {
        name: draft.owner,
        role: "建设/牵头",
        sourceIds: draft.sources.map((item) => item.id),
        reviewed: true,
      },
      {
        name: draft.implementationUnit,
        role: "实施",
        sourceIds: draft.sources.map((item) => item.id),
        reviewed: false,
      },
      {
        name: draft.operationUnit,
        role: "运营",
        sourceIds: draft.sources.map((item) => item.id),
        reviewed: false,
      },
    ],
    dataAssets: draft.dataAssets,
    scenarios: draft.scenarios,
    metrics: draft.metrics,
    milestones: draft.milestones,
    limitations: draft.limitations,
    replicationConditions: draft.replicationConditions,
    manualReviewStatus: "in_review",
  };
  const enriched: SmartCityCase = {
    ...item,
    summary: draft.summary,
    owner: draft.owner,
    implementationUnit: draft.implementationUnit,
    operationUnit: draft.operationUnit,
    projectStage: draft.projectStage,
    outcomes: draft.outcomes,
    researchSources: draft.sources.map(({ title, url }) => ({ title, url })),
    sourceUrl: draft.sources[0]?.url,
    sourceTitle: draft.sources[0]?.title,
    sourceNote:
      "V1.5 标杆样稿：正文依据公开权威来源编辑整理，事实、机构分工和指标口径仍需内容负责人终审。",
    contentMigration: {
      protocolVersion: "1.0",
      status: "benchmark_draft",
      benchmark: true,
      migratedAt,
      migratedFrom: "v1.4",
      reviewStatus: "in_review",
      sourceCount: draft.sources.length,
      substantiveSectionCount: editorialSections.length,
      notes: "已完成七部分原生内容迁移；保留原案例 ID、slug、地图位置与发布状态。",
    },
    contentModel: {
      ...withoutQuality,
      quality: evaluateCaseQuality(
        {
          ...item,
          summary: draft.summary,
          owner: draft.owner,
          implementationUnit: draft.implementationUnit,
          operationUnit: draft.operationUnit,
          projectStage: draft.projectStage,
          outcomes: draft.outcomes,
          researchSources: draft.sources.map(({ title, url }) => ({ title, url })),
          contentMigration: undefined,
        },
        withoutQuality,
      ),
    },
    updatedAt: migratedAt,
  };
  return enriched;
}

const guangzhou: BenchmarkDraft = {
  slug: "guangzhou-cim-platform",
  summary:
    "广州以工程建设项目审批制度改革为业务入口，将三维电子报建、BIM、GIS 与城市基础空间数据汇聚到 CIM 基础平台，并逐步把能力延伸到规划审查、施工监管、城市更新和城市运行场景。这个案例的核心不是建设一张三维城市大屏，而是让统一空间底座进入建设管理的真实业务流程。",
  owner: "广州市住房和城乡建设主管部门",
  implementationUnit: "广州市相关信息化建设与技术支撑单位（具体分工待终审）",
  operationUnit: "广州市住房和城乡建设主管部门及相关业务单位",
  projectStage: "持续运维",
  outcomes: [
    "形成面向规划、设计、施工图审查和竣工归档的三维协同路径。",
    "推动 BIM、GIS、物联网与工程建设业务数据在统一空间底座中关联。",
    "为城市更新、智慧社区和城市运行等后续场景提供可复用的空间能力。",
  ],
  sources: [
    source(
      "gz-2024-whitepaper",
      "《广州市城市信息模型（CIM）平台白皮书（2024）》",
      "https://zfcj.gz.gov.cn/attachment/7/7864/7864679/9783012.pdf",
      "广州市住房和城乡建设局",
      "2024",
      "政策文件",
      "说明广州 CIM 平台在规划、设计、建设、管理和运营等阶段的能力与应用方向。",
    ),
    source(
      "gz-policy",
      "广州市城市信息模型（CIM）平台建设政策解读",
      "https://zfcj.gz.gov.cn/gkmlpt/content/5/5612/post_5612383.html",
      "广州市住房和城乡建设局",
      "2020",
      "官方网站",
      "说明广州作为国家 CIM 平台试点，以三维电子报建为切入口推进建设。",
    ),
    source(
      "mohurd-guide",
      "《城市信息模型（CIM）基础平台技术导则》",
      "https://www.mct.gov.cn/preview/whhlyqyzcxxfw/zhgl/202012/P020201226505222859472.pdf",
      "住房和城乡建设部",
      "2020",
      "政策文件",
      "提出 CIM 基础平台在功能、数据、运维和性能方面的通用要求，并总结试点经验。",
    ),
    source(
      "gz-plan",
      "《广州市智能建造与建筑工业化协同发展“十四五”规划》",
      "https://www.gz.gov.cn/zwgk/ghjh/fzgh/ssw/content/post_8458928.html",
      "广州市人民政府",
      "2022",
      "政策文件",
      "提出将 CIM 能力向工程建设、交通、水务、园林、城市管理等领域延伸。",
    ),
  ],
  sections: {
    project_overview: {
      summary:
        "广州 CIM 是以城市三维空间数据为底座、以工程建设管理为首要落点的城市级基础平台。",
      paragraphs: [
        "广州进入国家 CIM 平台试点后，没有把目标限定为建立三维模型库，而是以工程建设项目审批改革为切口，把规划条件、设计模型、施工图、竣工成果和城市基础空间数据纳入同一空间坐标体系。平台由此承担两类职责：一类是汇聚和治理 BIM、GIS、倾斜摄影、物联网等多源数据，另一类是向审批、建设、更新和运行系统提供统一的空间服务。",
        "从产品边界看，CIM 基础平台更接近城市数字空间的公共能力层，而不是替代所有业务系统。审批系统、施工监管系统和城市更新平台仍然负责各自业务，CIM 通过模型、编码、接口和空间分析把不同阶段的数据关联起来。这一定位决定了评价项目时应重点观察实际调用和业务闭环，而不是模型数量或大屏视觉效果。",
      ],
      points: ["城市级统一空间底座", "工程建设审批作为首要入口", "以服务接口支撑多部门业务复用"],
      sourceIds: ["gz-2024-whitepaper", "gz-policy", "mohurd-guide"],
    },
    why_build: {
      summary:
        "建设动因来自工程数据割裂、二维审查能力不足，以及项目全生命周期成果难以持续复用。",
      paragraphs: [
        "传统工程建设流程中，规划、设计、施工图审查、施工和竣工档案分别形成大量图纸、模型和表格。各环节的数据标准、坐标基准和交付要求并不完全一致，导致同一项目在不同系统中反复填报，形成的数据也难以直接用于后续监管和城市更新。",
        "复杂建筑、地下空间和成片更新项目仅依靠二维图纸，难以直观判断空间冲突、规划符合性和周边影响。广州选择三维电子报建和模型辅助审查作为突破口，是因为这一环节既有明确业务责任，也能检验三维数据是否真正可计算、可校核、可归档。",
      ],
      sourceIds: ["gz-policy", "gz-2024-whitepaper"],
    },
    how_build: {
      summary:
        "总体路径是统一标准与时空基准，汇聚多尺度模型，再把模型服务嵌入审批和建设管理系统。",
      paragraphs: [
        "平台建设首先需要解决数据标准问题，包括模型分级、对象编码、空间坐标、属性字段、质量检查和更新机制。只有模型能够稳定入库并与项目、地块、建筑和设施建立关联，后续分析才不会退化为一次性展示。",
        "在能力层面，平台提供三维浏览、模型轻量化、空间查询、方案比对、规划辅助核验和服务发布等通用组件。业务部门通过接口调用这些组件，把三维审查、施工现场监测、竣工成果归档等动作嵌入原有流程；平台则保留数据版本和服务关系，支撑跨阶段追溯。",
      ],
      points: ["标准先行与统一编码", "多源模型汇聚和轻量化", "通用空间能力服务化", "业务系统按职责调用"],
      sourceIds: ["mohurd-guide", "gz-2024-whitepaper"],
    },
    core_scenarios: {
      summary:
        "核心场景包括三维电子报建与辅助审查、施工过程监管、竣工归档，以及城市更新和社区治理。",
      paragraphs: [
        "在审批场景中，申报单位提交符合标准的三维成果，系统对模型完整性和基础规则进行检查，审查人员再结合规划条件、周边环境和专业意见完成业务判断。自动检查承担的是辅助作用，不能替代法定审查结论。",
        "在建设和运营场景中，项目模型可与施工进度、现场感知和竣工成果关联，并在后续城市更新、智慧社区和运行管理中继续使用。数据能否跨阶段延续，是判断平台从项目工具升级为城市底座的关键。",
      ],
      sourceIds: ["gz-2024-whitepaper", "gz-plan"],
    },
    implementation_operation: {
      summary:
        "实施上需要平台建设、数据治理、业务改造和持续运维并行推进，而不是先建平台再寻找场景。",
      paragraphs: [
        "CIM 涉及住建、规划、城管、交通和项目建设单位等多类主体。实施过程中应按业务场景明确数据提供者、质量责任人、平台运维方和结果使用者，并通过接口清单和更新频率把责任固化。若只完成历史模型汇聚而没有持续更新机制，平台会快速失真。",
        "运营重点包括模型入库质检、服务可用性、权限分级、版本追溯和跨系统接口监测。对于工程模型中的敏感结构、地下设施和个人信息，还需要执行最小授权和用途控制。公开材料未完整披露具体合同、投资和单位分工，这些字段在正式发布前仍需核验。",
      ],
      sourceIds: ["mohurd-guide", "gz-2024-whitepaper"],
    },
    innovation_outcomes: {
      summary:
        "项目的可验证价值在于形成三维辅助审查和跨阶段数据复用路径，而非简单宣称实现全自动审批。",
      paragraphs: [
        "广州把三维电子报建与 CIM 平台结合，使规划、设计和建设成果可以在统一空间环境中表达，并为复杂空间关系的人工审查提供辅助。公开资料同时显示，平台能力已经向城市更新、智慧社区和运行监测等方向扩展，说明空间底座开始服务多个业务域。",
        "现有公开材料更多描述能力范围和应用方向，缺少统一口径的办理时长、错误发现率、模型复用率和运维成本数据。因此本案例不把“效率大幅提升”等宣传性语言当作已核验成效，而把这些指标列为后续评估项。",
      ],
      points: ["三维成果进入工程审批流程", "建设数据具备跨阶段复用基础", "平台能力可向更新与运行场景扩展"],
      sourceIds: ["gz-policy", "gz-2024-whitepaper", "gz-plan"],
    },
    lessons_boundaries: {
      summary:
        "可复制的是标准、治理和业务嵌入方法；不可直接复制的是广州既有数据基础、组织关系和项目规模。",
      paragraphs: [
        "其他城市建设 CIM 时，应先选择责任明确、数据稳定且使用频率高的业务场景，再反推所需模型精度和平台能力。若先追求全域高精度建模，容易产生昂贵但难以更新的数据资产。平台采购也应把接口、版本管理和持续调用纳入验收，而不是只验收可视化页面。",
        "CIM 不能替代专业审查、法定审批和线下工程质量责任。三维模型质量依赖设计和建设单位持续交付，跨部门使用还受数据权限、标准兼容和运维预算约束。复制项目时必须保留人工复核和责任边界。",
      ],
      sourceIds: ["mohurd-guide", "gz-2024-whitepaper"],
    },
  },
  scenarios: [
    {
      id: "gz-scenario-review",
      name: "三维电子报建与辅助审查",
      problem: "二维图纸难以直观判断复杂空间关系，申报成果标准不一。",
      dataInputs: ["规划条件", "BIM 设计模型", "地形与周边建筑", "项目基础信息"],
      systemActions: ["模型质检", "坐标匹配", "空间叠加", "规则辅助校核"],
      businessActions: ["申报单位整改", "审查人员复核", "部门形成法定审查意见"],
      result: "形成可追溯的三维辅助审查过程和标准化成果。",
      sourceIds: ["gz-policy", "gz-2024-whitepaper"],
    },
    {
      id: "gz-scenario-renewal",
      name: "城市更新空间研判",
      problem: "更新片区现状、项目和设施信息分散，方案比选缺少统一空间环境。",
      dataInputs: ["现状建筑", "地块权属", "规划方案", "公共设施与感知数据"],
      systemActions: ["多源数据关联", "方案叠加比对", "空间影响分析"],
      businessActions: ["主管部门组织研判", "专业单位校核", "形成更新方案依据"],
      result: "为更新项目提供统一、可复用的空间表达与协同底座。",
      sourceIds: ["gz-2024-whitepaper", "gz-plan"],
    },
  ],
  metrics: [],
  milestones: [
    { date: "2019", event: "广州进入国家 CIM 平台建设试点并以工程建设审批为切入口。", sourceIds: ["gz-policy"] },
    { date: "2024", event: "发布新版 CIM 平台白皮书，梳理建设、管理和运营应用方向。", sourceIds: ["gz-2024-whitepaper"] },
  ],
  dataAssets: [
    { name: "BIM 工程模型", category: "工程建设数据", source: "建设与设计单位", usage: "辅助审查、施工监管和竣工归档", sensitivity: "按项目和专业分级授权", sourceIds: ["gz-2024-whitepaper"] },
    { name: "城市三维与 GIS 数据", category: "基础空间数据", source: "相关主管部门", usage: "空间定位、叠加分析和城市更新", sensitivity: "部分数据受测绘与公共安全要求约束", sourceIds: ["mohurd-guide"] },
  ],
  limitations: ["公开资料缺少统一口径的效率与成本指标。", "具体实施、运营单位和合同边界仍需人工核验。", "自动规则检查不能替代专业人员与法定审批责任。"],
  replicationConditions: ["建立统一模型交付和质量标准。", "选择高频、责任明确的首批业务场景。", "明确跨部门数据更新、权限和运维责任。"],
};

const beijing: BenchmarkDraft = {
  slug: "beijing-urban-operation-command",
  summary:
    "北京以超大城市运行保障为目标，将网格事件、专业监管、运行监测和指挥调度组织成市、区、街道多级协同体系。“一网统管”的重点不是把所有系统合并成一个大屏，而是通过事件发现、分拨、处置、反馈和评价形成可追踪的治理闭环。",
  owner: "北京市城市管理相关主管部门",
  implementationUnit: "北京市城市运行管理相关技术支撑单位（具体分工待终审）",
  operationUnit: "市、区、街道三级城市运行管理体系",
  projectStage: "持续运维",
  outcomes: ["形成市、区、街道多级指挥调度路径。", "将监测预警与事件处置机制结合。", "推动燃气、供热、管线、垃圾等专业场景接入统一协同体系。"],
  sources: [
    source("bj-plan", "《北京市“十四五”时期城市管理发展规划》", "https://www.beijing.gov.cn/zhengce/zhengcefagui/202204/t20220412_2672524.html", "北京市人民政府", "2022", "政策文件", "提出升级网格化管理平台，完善线上线下协同、监测和事件分拨能力。"),
    source("bj-monitor", "北京市城市运行监测平台升级改造项目采购需求", "https://csglw.beijing.gov.cn/zwxx/zwtzgg/202404/P020240401654511082710.pdf", "北京市城市管理委员会", "2024", "招投标公告", "说明平台覆盖监测、分析、预测预警、调度指挥和场景配置等能力。"),
    source("bj-system", "北京市城市运行管理工作体系相关政策材料", "https://csglw.beijing.gov.cn/sy/sycxfw/xxcx/qtxx/202204/P020220418527636349354.pdf", "北京市城市管理委员会", "2022", "政策文件", "说明市、区、街道三级调度指挥体系和工作机制。"),
    source("bj-scenes", "北京城市管理“一网统管”应用场景建设情况", "https://jxj.beijing.gov.cn/jxdt/gzdt/202301/t20230119_2905031.html", "北京市经济和信息化局", "2023", "官方网站", "列举地下管线、生活垃圾、燃气安全、建筑垃圾和智慧供热等应用场景。"),
  ],
  sections: {
    project_overview: { summary: "北京城市运行综合指挥体系以跨层级、跨部门的运行监测和事件协同为核心。", paragraphs: ["平台面向超大城市日常运行和重要保障任务，汇聚网格事件、行业运行、设施状态和专业系统信息，形成监测、研判、预警和调度的共同工作界面。它并非取消原有专业系统，而是建立跨部门共享的事件语言、调度链路和责任关系。", "从组织上看，市级关注全市态势、重大事件和跨区协调，区级承担属地统筹，街道连接网格和现场处置，专业部门负责业务判断与执行。数字平台只有与这套组织体系结合，才能把可视化信息转化为处置结果。"], points: ["运行监测与事件处置并重", "市区街三级协同", "专业系统保留业务职责"], sourceIds: ["bj-plan", "bj-monitor", "bj-system"] },
    why_build: { summary: "建设动因是城市运行风险跨专业、事件来源分散，以及重大保障任务需要统一调度。", paragraphs: ["燃气、供热、地下管线、垃圾和道路等问题分别由不同专业部门管理，但现实事件常常跨越部门边界。热线、网格巡查、感知设备和行业系统发现的问题，如果缺少统一编码和协同入口，会出现重复派单、责任不清和处置结果难以追踪。", "超大城市还需要在极端天气、重大活动和突发事件中快速形成全局态势。单纯汇总指标不能解决问题，系统必须把异常转化为有责任主体、时限和反馈要求的任务。"], sourceIds: ["bj-plan", "bj-system"] },
    how_build: { summary: "总体架构由运行数据汇聚、监测分析、事件中枢、指挥调度和场景配置组成。", paragraphs: ["运行数据层接入网格、热线、行业监管和设施感知信息，并通过目录、标准和权限进行治理。监测分析层形成专题指标、异常识别和趋势研判；事件中枢对来源不同的事件进行去重、分类、分级和流转。", "指挥调度层把事件派发到属地或专业部门，记录签收、处置、反馈和复核过程。场景配置能力则让平台能够针对燃气、供热、管线等业务建立不同规则，而不必为每个专题重复建设一套孤立系统。"], points: ["统一事件编码与责任映射", "监测预警连接调度处置", "场景化配置复用公共能力"], sourceIds: ["bj-monitor", "bj-plan"] },
    core_scenarios: { summary: "典型场景覆盖设施运行、安全风险、环境秩序和重大活动保障。", paragraphs: ["在燃气、供热和地下管线场景中，系统将设施状态、巡检结果、施工活动和事件信息组合研判，发现异常后按影响范围和专业责任分级派发。专业部门完成核查处置，平台记录反馈并支持跨层级升级。", "在生活垃圾、建筑垃圾和城市环境场景中，平台把视频、车辆、网格和投诉线索关联到具体地点与责任单位。对重大活动或极端天气，则通过专题态势、资源清单和会商调度支撑统一保障。"], sourceIds: ["bj-scenes", "bj-monitor"] },
    implementation_operation: { summary: "项目运营重点是组织机制、值守制度、事件规则和专业系统接口的持续维护。", paragraphs: ["三级体系需要明确何种事件由街道处置、何种事件需要区级统筹、何种情况升级到市级，并设置签收、反馈和复核时限。平台规则必须与实际职责同步更新，否则自动分拨会把错误更快地传递到基层。", "技术运维除系统可用性外，还包括数据时效、接口状态、事件字典和专题场景配置。对视频、个人诉求和关键设施数据，应按岗位实施最小授权并保留访问记录。公开资料未完整披露系统建设成本和每类事件的运营绩效，本案例不作推断。"], sourceIds: ["bj-system", "bj-monitor"] },
    innovation_outcomes: { summary: "公开资料支持的主要成果是形成多级调度体系和一批专业应用场景，具体效率仍需运行数据验证。", paragraphs: ["政策和采购材料显示，北京已经把城市运行监测、预测预警、调度指挥和场景配置纳入统一体系，并围绕燃气、供热、地下管线、垃圾等领域建设应用。这表明平台从通用态势展示向专业业务协同延伸。", "但“发现更快、处置更快”需要以事件基线、平均处置时长、按期办结率、重复派单率和闭环复核率等指标证明。现有来源未提供统一、连续的量化口径，因此标杆样稿只确认机制和场景，不把预期效果写成既成事实。"], points: ["三级调度机制具备政策依据", "多类专业场景已纳入建设范围", "成效指标仍需运行台账核验"], sourceIds: ["bj-plan", "bj-scenes", "bj-monitor"] },
    lessons_boundaries: { summary: "一网统管可复制的核心是事件和责任闭环，而不是简单建设统一大屏。", paragraphs: ["复制时应先梳理事件目录、权责清单和升级规则，再决定平台功能。每个场景都要回答谁发现、谁判断、谁处置、谁复核，以及数据在各环节如何留下证据。没有这一机制，数据汇聚越多反而越容易形成新的信息负担。", "平台不能代替专业部门作出安全、执法或应急判断，也不应把所有基层事项无限上收。算法预警存在误报和漏报，视频与诉求数据涉及隐私，必须保留人工判断、申诉纠错、权限审计和数据留存边界。"], sourceIds: ["bj-system", "bj-plan"] },
  },
  scenarios: [
    { id: "bj-scenario-utility", name: "城市生命线异常协同处置", problem: "设施异常跨属地和专业部门，处置链条长。", dataInputs: ["设施监测", "巡检记录", "施工信息", "网格与热线事件"], systemActions: ["异常识别", "事件分级", "责任匹配", "升级提醒"], businessActions: ["专业单位核查", "属地协同", "处置反馈", "复核销号"], result: "形成从异常发现到反馈销号的可追踪闭环。", sourceIds: ["bj-monitor", "bj-scenes"] },
    { id: "bj-scenario-event", name: "重大活动运行保障", problem: "多部门保障信息分散，缺少统一态势和调度入口。", dataInputs: ["重点区域态势", "保障资源", "交通与环境事件", "值守信息"], systemActions: ["专题汇聚", "风险提示", "任务分拨", "过程留痕"], businessActions: ["联合会商", "资源调配", "现场处置", "结果报告"], result: "支撑跨部门、跨层级的统一运行保障。", sourceIds: ["bj-plan", "bj-monitor"] },
  ],
  metrics: [],
  milestones: [{ date: "2022", event: "规划明确升级网格化管理平台和一网统管协同能力。", sourceIds: ["bj-plan"] }, { date: "2024", event: "城市运行监测平台升级需求进一步明确预测预警与调度指挥能力。", sourceIds: ["bj-monitor"] }],
  dataAssets: [{ name: "城市运行事件", category: "治理事件数据", source: "网格、热线和专业部门", usage: "分类、分拨、处置和复核", sensitivity: "可能包含个人诉求和现场信息，需分级授权", sourceIds: ["bj-plan"] }, { name: "设施与行业运行数据", category: "城市运行数据", source: "燃气、供热、管线等专业系统", usage: "监测预警与专题研判", sensitivity: "关键基础设施数据需严格控制", sourceIds: ["bj-monitor", "bj-scenes"] }],
  limitations: ["公开资料未提供统一连续的处置效率指标。", "具体组织分工和系统接口会随职责调整而变化。", "算法预警不能替代专业判断和现场核实。"],
  replicationConditions: ["先完成事件目录与权责清单。", "建立市、区、街道和专业部门的升级机制。", "持续维护数据接口、规则和运行绩效指标。"],
};

const hangzhou: BenchmarkDraft = {
  slug: "hangzhou-city-brain-traffic",
  summary:
    "杭州城市大脑以交通治理为早期突破口，把交通流、视频事件、信号控制和交警处置连接成感知—分析—控制—反馈闭环。其标杆意义不在“城市大脑”概念本身，而在于从可度量的高频场景切入，并用实际运行结果持续校准算法和治理流程。",
  owner: "杭州市城市治理与交通管理相关部门",
  implementationUnit: "杭州城市大脑相关平台与技术支撑单位（具体分工待终审）",
  operationUnit: "杭州市交通管理与城市治理相关单位",
  projectStage: "持续运维",
  outcomes: ["以交通治理作为城市大脑首个规模化场景。", "形成交通事件发现、信号优化和指挥处置的运行闭环。", "带动平台能力向公共交通和更多城市治理领域扩展。"],
  sources: [
    source("hz-history", "杭州城市大脑建设历程", "https://zfgb.hangzhou.gov.cn/18/106220253/t104220253064/528818.shtml", "杭州市人民政府公报", "2025", "官方网站", "回顾2016年提出城市大脑、2017年交通系统1.0上线及后续综合版演进。"),
    source("hz-transport", "杭州城市大脑交通系统2.0应用情况", "https://jtj.shenyang.gov.cn/jtzw/jtzhxx/202203/t20220302_2798057.html", "交通运输部门网站（来源注明交通运输部）", "2022", "官方网站", "介绍交通监测、拥堵识别、信号配时和效果评估等能力。"),
    source("hz-cac", "城市大脑让杭州交通治理更智能", "https://www.cac.gov.cn/2018-08/15/c_1123271738.htm", "中央网络安全和信息化委员会办公室", "2018", "官方网站", "报道早期交通事件识别和交警到场时间等运行数据。"),
    source("hz-data", "杭州以数据要素提升城市交通治理案例", "https://www.nda.gov.cn/sjj/ywpd/szjj/1213/20240906165648487934177_pc.html", "国家数据局", "2024", "官方网站", "介绍公交线网、接驳线路、路口和道路运行优化等后续实践。"),
    source("hz-open", "杭州城市大脑交通治理与服务开放实践", "https://zjic.zj.gov.cn/ywdh/ggkf/202104/t20210401_6492492.shtml", "浙江省相关主管部门", "2021", "官方网站", "说明治理侧与出行服务侧的数据融合和能力分工。"),
  ],
  sections: {
    project_overview: { summary: "杭州城市大脑从交通这一高频、可感知、可度量的场景起步，逐步形成城市级数据与算法协同能力。", paragraphs: ["杭州在2016年前后提出城市大脑构想，并将交通作为率先落地的领域。交通系统汇聚道路流量、视频、信号灯、事件和警务处置等信息，通过算法分析支持拥堵研判、信号优化和事件发现，再由交管部门执行和反馈。", "这一项目不是单一软件产品，而是由数据接入、算法服务、交通控制、指挥处置和公众服务共同构成的运行体系。随着能力演进，相关数据与机制逐步延伸到公交线网、地铁接驳和更多城市治理场景。"], points: ["以交通场景验证城市级平台", "数据算法与业务处置结合", "从单点优化走向体系协同"], sourceIds: ["hz-history", "hz-transport", "hz-open"] },
    why_build: { summary: "建设动因是交通治理依赖人工巡查和经验配时，跨系统数据难以及时形成统一决策。", paragraphs: ["传统交通管理拥有视频、卡口、信号和警情等大量系统，但数据常按设备和部门分散。人工查看视频发现事件速度有限，固定或分时信号方案也难以及时适应路网变化。", "交通是适合验证数据闭环的场景：问题发生频率高，空间和时间边界明确，信号控制和警力处置能够形成具体动作，通行速度、排队长度和到场时间等结果又可以反向评价策略。"], sourceIds: ["hz-transport", "hz-cac"] },
    how_build: { summary: "系统通过多源交通数据融合、事件算法、信号优化和业务反馈构成闭环。", paragraphs: ["感知层接入路口流量、视频、卡口、信号状态和警情等数据；分析层识别拥堵和异常事件，计算路网运行指标；控制与协同层把策略下发到信号系统或推送给交通管理人员。", "算法输出并不是最终治理结论。交管部门需要确认事件、调度警力、调整控制策略并记录结果，系统再根据执行效果持续评估。平台化能力还可向公交线网、地铁接驳和公众出行服务开放，但不同场景需要独立的业务规则和绩效口径。"], points: ["多源感知形成实时路网状态", "算法识别与信号控制结合", "执行结果反哺策略评估"], sourceIds: ["hz-transport", "hz-open"] },
    core_scenarios: { summary: "核心场景包括交通事件自动发现、区域信号优化和公共交通线网协同。", paragraphs: ["在事件发现中，算法从视频和运行数据识别事故、拥堵或异常停车等情况，向交管人员提供位置和线索；人工确认后调度处置，处理结果回写系统。公开报道给出了早期事件识别和到场时间数据，但这些指标属于特定阶段和统计口径，不能直接代表当前全域表现。", "在信号优化和公共交通场景中，系统根据路口和路段状态调整配时或评估方案，并利用客流、线路和换乘数据支持公交线路与地铁接驳优化。每项优化都需要对照基线观察速度、延误和服务覆盖变化。"], sourceIds: ["hz-cac", "hz-transport", "hz-data"] },
    implementation_operation: { summary: "项目持续运营依赖数据质量、算法评估、交通业务协同和安全合规。", paragraphs: ["交通数据具有高频、实时和强空间关联特征，摄像机、信号机和接口故障会直接影响算法判断。因此运营不仅要维护模型，还要监测设备在线率、数据延迟、事件误报漏报和策略执行结果，并针对道路施工、季节和出行结构变化更新参数。", "组织上需要平台团队、交管部门、公交和地铁运营等主体共同参与。算法建议必须保留人工干预和回退方案，涉及车辆轨迹、视频和个人出行的数据应执行用途限制、脱敏和访问审计。"], sourceIds: ["hz-transport", "hz-open"] },
    innovation_outcomes: { summary: "项目证明了交通数据闭环可以支持事件处置和路网优化，但指标必须标注时间、范围和来源。", paragraphs: ["中央网信办2018年报道曾披露阶段性数据，包括系统发现大量视频与交通事件、识别准确率以及交警平均到场时间变化。这些数据可作为早期运行证据，但属于报道口径，不应外推为所有道路和当前状态。", "国家数据局2024年案例进一步记录了公交线路、地铁接驳、路口和道路速度等优化成果，反映杭州智慧交通已从信号和事件扩展到综合出行治理。由于不同材料覆盖的系统范围不同，本案例将指标分别保留来源和时期，避免合并成一个夸大的总体结论。"], points: ["早期事件发现与处置具有公开运行数据", "后续应用扩展到公交和路网优化", "所有数字均按原来源与时期解释"], sourceIds: ["hz-cac", "hz-data"] },
    lessons_boundaries: { summary: "最值得复制的是从可度量场景建立数据和业务闭环，而不是照搬“城市大脑”品牌或技术架构。", paragraphs: ["其他城市可优先选择拥堵路口、快速路事件或公交接驳等边界清晰的场景，建立优化前基线、策略动作、责任人和结果指标，再逐步扩大数据和区域范围。平台建设应允许算法、设备和业务系统按接口替换，避免形成封闭的一体化黑箱。", "交通算法受到道路结构、设备覆盖、驾驶行为和管理规则影响，在杭州有效的模型不能直接迁移到另一座城市。算法识别也会产生误报和偏差，信号优化可能把延误转移到支路或慢行交通，因此必须保留人工审核、多目标评价和公众影响评估。"], sourceIds: ["hz-history", "hz-transport", "hz-data"] },
  },
  scenarios: [
    { id: "hz-scenario-event", name: "交通事件自动发现与处置", problem: "人工巡查发现事故和异常事件不及时。", dataInputs: ["道路视频", "交通流量", "车辆轨迹摘要", "信号状态"], systemActions: ["异常识别", "事件定位", "风险分级", "处置提示"], businessActions: ["交警确认", "警力调度", "现场处置", "结果回写"], result: "缩短事件从发现到进入处置流程的时间，并留下可评估记录。", sourceIds: ["hz-cac", "hz-transport"] },
    { id: "hz-scenario-signal", name: "区域信号协调优化", problem: "固定配时难以适应实时流量变化，局部优化可能转移拥堵。", dataInputs: ["路口流量", "排队长度", "相邻路口状态", "历史通行指标"], systemActions: ["路网研判", "方案计算", "仿真或规则校验", "效果评估"], businessActions: ["交管人员确认策略", "信号系统执行", "异常时人工回退"], result: "在明确区域和时段内改善信号协调，并通过前后指标验证。", sourceIds: ["hz-transport"] },
    { id: "hz-scenario-transit", name: "公共交通线网与接驳优化", problem: "公交线路重叠或与地铁接驳不足，资源配置与客流变化不匹配。", dataInputs: ["公交客流", "线路运行", "地铁客流", "道路速度"], systemActions: ["客流分析", "线路效率识别", "接驳需求评估"], businessActions: ["主管部门论证", "运营单位调整线路", "跟踪乘客反馈"], result: "支持线路优化和地铁接驳服务调整。", sourceIds: ["hz-data"] },
  ],
  metrics: [
    { name: "早期视频事件识别准确率", value: "96", unit: "%", period: "2018年报道口径", baseline: "未披露统一基线", evidenceStatus: "source_claimed", sourceIds: ["hz-cac"], reviewed: true },
    { name: "交警平均到场时间变化", value: "减少2.2", unit: "分钟", period: "2018年报道口径", baseline: "报道未披露完整样本范围", evidenceStatus: "source_claimed", sourceIds: ["hz-cac"], reviewed: true },
    { name: "优化或取消低效重复公交线路", value: "80", unit: "条", period: "2024年案例口径", baseline: "国家数据局案例所述项目范围", evidenceStatus: "source_claimed", sourceIds: ["hz-data"], reviewed: true },
    { name: "优化路口", value: "50", unit: "个", period: "2024年案例口径", baseline: "国家数据局案例所述项目范围", evidenceStatus: "source_claimed", sourceIds: ["hz-data"], reviewed: true },
  ],
  milestones: [{ date: "2016", event: "杭州提出城市大脑构想并选择交通作为突破口。", sourceIds: ["hz-history"] }, { date: "2017-10", event: "城市大脑交通系统1.0上线。", sourceIds: ["hz-history"] }, { date: "2018-12", event: "城市大脑综合版发布，能力向更多治理领域扩展。", sourceIds: ["hz-history"] }],
  dataAssets: [{ name: "道路交通流与信号数据", category: "交通运行数据", source: "道路检测与信号控制系统", usage: "拥堵研判、配时优化和效果评估", sensitivity: "设备与运行数据按业务授权", sourceIds: ["hz-transport"] }, { name: "视频与交通事件", category: "城市感知数据", source: "道路视频和交警业务系统", usage: "事件识别、定位和处置协同", sensitivity: "视频和车辆相关数据需脱敏与审计", sourceIds: ["hz-cac"] }, { name: "公共交通客流与线路", category: "公共交通数据", source: "公交与轨道运营系统", usage: "线路效率和接驳需求分析", sensitivity: "以聚合数据支持规划分析", sourceIds: ["hz-data"] }],
  limitations: ["早期公开指标只代表特定阶段与范围。", "不同材料覆盖的交通系统边界并不完全一致。", "算法优化可能产生空间和交通方式之间的外溢影响。"],
  replicationConditions: ["选择边界清晰且可量化的交通场景。", "建立执行前基线和持续效果评估。", "保留人工干预、算法回退与多目标评价机制。"],
};

const drafts = new Map(
  [guangzhou, beijing, hangzhou].map((draft) => [draft.slug, draft]),
);

export const benchmarkCaseSlugs = Array.from(drafts.keys());

export function migrateBuiltInCases(cases: SmartCityCase[]): SmartCityCase[] {
  return cases.map((item) => {
    const draft = drafts.get(item.slug);
    if (!draft) {
      return {
        ...item,
        contentMigration: {
          protocolVersion: "1.0",
          status: "legacy",
          benchmark: false,
          migratedAt: "",
          migratedFrom: "v1.4",
          reviewStatus: "pending",
          sourceCount: item.researchSources?.length || (item.sourceUrl ? 1 : 0),
          substantiveSectionCount: 0,
          notes: "尚未进入 V1.5 原生七部分内容迁移。",
        },
      };
    }
    return migrateBenchmarkCase(item, draft);
  });
}

export function getMigrationSummary(cases: SmartCityCase[]) {
  const migrated = cases.filter(
    (item) => item.contentMigration?.status !== "legacy",
  );
  return {
    total: cases.length,
    migrated: migrated.length,
    benchmarkDrafts: migrated.filter(
      (item) => item.contentMigration?.status === "benchmark_draft",
    ).length,
    approved: migrated.filter(
      (item) => item.contentMigration?.status === "approved",
    ).length,
  };
}
