import test from "node:test";
import assert from "node:assert/strict";
import { allCaseAssets, publishedCaseAssets } from "../lib/case-assets";

test("published knowledge-base assets enter the public case collection", () => {
  const luohu = allCaseAssets.find((item) => item.slug === "luohu-cim-platform");
  assert.ok(luohu);
  assert.equal(luohu.asset?.contentStatus, "published");
  assert.ok(publishedCaseAssets.some((item) => item.slug === "luohu-cim-platform"));
});

test("only published assets enter the public collection", () => {
  assert.ok(publishedCaseAssets.every((item) => item.asset?.contentStatus === "published"));
});
