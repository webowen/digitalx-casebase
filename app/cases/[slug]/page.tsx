import { CaseDetailClient } from "@/components/case-detail-client";
import { getCaseBySlug, smartCityCases } from "@/lib/mock-cases";
import { getAssetCaseBySlug, publishedCaseAssets } from "@/lib/case-assets";

export function generateStaticParams() {
  return [...publishedCaseAssets, ...smartCityCases].map((item) => ({ slug: item.slug }));
}

export default async function CaseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CaseDetailClient slug={slug} initialItem={getAssetCaseBySlug(slug) || getCaseBySlug(slug)} />;
}
