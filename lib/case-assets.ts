import { caseAssets } from "./case-assets.generated";

export const allCaseAssets = caseAssets;
export const publishedCaseAssets = caseAssets.filter(
  (item) => item.asset?.contentStatus === "published" && item.status === "已发布",
);

export function getAssetCaseBySlug(slug: string) {
  return publishedCaseAssets.find((item) => item.slug === slug);
}

