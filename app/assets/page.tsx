import Link from "next/link";
import { allCaseAssets } from "@/lib/case-assets";

export default function CaseAssetsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return <CaseAssetsContent searchParams={searchParams} />;
}

async function CaseAssetsContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project = "" } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4">
          <div><p className="brand-eyebrow text-[10px] font-bold">DIGITAL X ASSETS</p><h1 className="mt-1 text-xl font-semibold">案例资产工作台</h1></div>
          <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-xs hover:bg-slate-50">返回案例地图</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold">研究新项目</p>
          <form action="/lab/ai-case-studio" className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input name="project" defaultValue={project} placeholder="输入项目名称，生成 candidate 候选案例资产" className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500" />
            <button className="brand-gradient-button rounded-full px-5 py-2 text-sm font-semibold text-white">进入 AI 研究</button>
          </form>
          <p className="mt-2 text-[11px] text-slate-500">复用现有 AI 研究链路；研究结果必须先成为 candidate，人工检查后才能把 Frontmatter 改为 published。</p>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold">真实案例资产</h2><p className="mt-1 text-xs text-slate-500">数据源：knowledge-base/cases/</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{allCaseAssets.length} 个</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr>{["项目名称","地区","分类","状态","图片","来源","POI","最后核验","操作"].map((item) => <th key={item} className="border-b border-slate-200 px-4 py-3 font-medium">{item}</th>)}</tr></thead>
              <tbody>{allCaseAssets.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="max-w-[300px] px-4 py-4 font-semibold">{item.title}<code className="mt-1 block truncate text-[10px] font-normal text-slate-400">{item.asset?.casePath}</code></td>
                <td className="px-4 py-4">{item.province} · {item.city}{item.district ? ` · ${item.district}` : ""}</td><td className="px-4 py-4">{item.category}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 ${item.asset?.contentStatus === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.asset?.contentStatus}</span></td>
                <td className="px-4 py-4 tabular-nums">{item.asset?.imageCount ?? 0}</td><td className="px-4 py-4 tabular-nums">{item.asset?.sourceCount ?? 0}</td><td className="px-4 py-4">{item.asset?.poiStatus === 'verified' ? '已核验' : '待确认'}</td><td className="px-4 py-4">{item.asset?.lastVerifiedAt || '待核验'}</td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link href={`/cases/${item.slug}`} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">预览</Link><Link href={`/cases/${item.slug}?view=research`} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">检查</Link><a href={`/knowledge-base/cases/${item.slug}/images.md`} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">图片</a><a href={`/knowledge-base/cases/${item.slug}/sources/source.md`} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">来源</a><span title="发布状态由 case.md Frontmatter 管理，提交 Git 后生效" className="cursor-help rounded border border-dashed border-slate-300 px-2 py-1 text-slate-500">{item.asset?.contentStatus === 'published' ? '取消发布' : '发布'}*</span></div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[10px] text-slate-500">* 为避免部署环境伪写入，发布/取消发布以 case.md 的 content_status 为唯一事实来源，修改并提交后自动进入或退出公开地图。</p>
        </section>
      </div>
    </main>
  );
}

