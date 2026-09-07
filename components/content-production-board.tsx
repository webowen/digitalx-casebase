"use client";

import {
  productionReadiness,
  productionStageLabels,
  productionSummary,
} from "@/lib/case-production";
import type { SmartCityCase } from "@/lib/case-model";

type ContentProductionBoardProps = {
  cases: SmartCityCase[];
  onEdit: (item: SmartCityCase) => void;
};

function ProgressBar({
  value,
  maximum,
  color = "from-blue-600 to-cyan-400",
}: {
  value: number;
  maximum: number;
  color?: string;
}) {
  const width = maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function ContentProductionBoard({
  cases,
  onEdit,
}: ContentProductionBoardProps) {
  const summary = productionSummary(cases);
  const benchmarks = cases.filter(
    (item) =>
      item.contentMigration?.production?.release === "V1.5.0-beta.1",
  );
  const batchCases = cases.filter(
    (item) =>
      item.contentMigration?.production?.release === "V1.5.0-beta.2",
  );
  const waves = Array.from(
    new Map(
      batchCases.map((item) => [
        item.contentMigration!.production!.waveId,
        item.contentMigration!.production!.waveLabel,
      ]),
    ),
  ).sort(([left], [right]) => left.localeCompare(right));

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded border border-cyan-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-cyan-700">
              V1.5.0-beta.1｜标杆案例真实内容生产与终审
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              三份标杆案例终审驾驶舱
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              只有来源、正文、指标、图片和六项人工门槛同时达标，才允许形成正式批准版本。
              系统展示真实缺口，不会把AI样稿自动标记为完成。
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-800 shadow-sm">
            {summary.finalReview} 份人工终审中
          </span>
        </div>
        <div className="grid gap-3 p-4 xl:grid-cols-3">
          {benchmarks.map((item) => {
            const readiness = productionReadiness(item);
            const production = item.contentMigration!.production!;
            return (
              <article
                key={item.id}
                className="rounded border border-cyan-100 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                    {item.city} · {item.category}
                  </span>
                  <span className="rounded bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-800">
                    {productionStageLabels[production.stage]}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-900">
                  {item.title}
                </h3>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded bg-slate-50 px-1 py-2">
                    <strong className="block text-sm text-slate-800">
                      {readiness.qualityScore}
                    </strong>
                    <span className="text-[9px] text-slate-500">质量分</span>
                  </div>
                  <div className="rounded bg-slate-50 px-1 py-2">
                    <strong className="block text-sm text-slate-800">
                      {readiness.sourceCount}
                    </strong>
                    <span className="text-[9px] text-slate-500">来源</span>
                  </div>
                  <div className="rounded bg-slate-50 px-1 py-2">
                    <strong className="block text-sm text-slate-800">
                      {readiness.characters}
                    </strong>
                    <span className="text-[9px] text-slate-500">正文字符</span>
                  </div>
                  <div className="rounded bg-slate-50 px-1 py-2">
                    <strong className="block text-sm text-slate-800">
                      {readiness.mediaCount}
                    </strong>
                    <span className="text-[9px] text-slate-500">复核图片</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                    <span>六项人工门槛</span>
                    <span>{readiness.approvedGates}/6</span>
                  </div>
                  <ProgressBar value={readiness.approvedGates} maximum={6} />
                </div>
                <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                  下一步：{production.nextAction}
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="mt-3 w-full rounded border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
                >
                  进入内容终审
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-indigo-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-indigo-700">
              V1.5.0-beta.2｜存量案例批量生产治理
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              17份案例分三批生产，不执行低质量一键扩写
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              每份案例必须依次经过项目身份、联网研究、证据整理、正文成稿、质量检查和人工终审。
              第一批优先处理城市底座、安全韧性及用户重点业务方向。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-indigo-50 px-3 py-2">
              <strong className="block text-lg text-indigo-800">
                {summary.queued}
              </strong>
              <span className="text-[10px] text-slate-500">排队</span>
            </div>
            <div className="rounded bg-sky-50 px-3 py-2">
              <strong className="block text-lg text-sky-800">
                {summary.inProduction}
              </strong>
              <span className="text-[10px] text-slate-500">生产中</span>
            </div>
            <div className="rounded bg-emerald-50 px-3 py-2">
              <strong className="block text-lg text-emerald-800">
                {summary.approved}
              </strong>
              <span className="text-[10px] text-slate-500">已终审</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-3">
          {waves.map(([waveId, waveLabel]) => {
            const waveCases = batchCases.filter(
              (item) => item.contentMigration?.production?.waveId === waveId,
            );
            return (
              <article
                key={waveId}
                className="rounded border border-slate-200 bg-slate-50/50"
              >
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {waveLabel}
                    </h3>
                    <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-indigo-700">
                      {waveCases.length}份
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-slate-200">
                  {waveCases.map((item) => {
                    const production = item.contentMigration!.production!;
                    const readiness = productionReadiness(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onEdit(item)}
                        className="block w-full px-4 py-3 text-left hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-800">
                              {item.title}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              {productionStageLabels[production.stage]} · 质量{" "}
                              {readiness.qualityScore} · 来源{" "}
                              {readiness.sourceCount}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${
                              production.priority === "P0"
                                ? "bg-rose-50 text-rose-700"
                                : production.priority === "P1"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {production.priority}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                          {production.rationale}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
