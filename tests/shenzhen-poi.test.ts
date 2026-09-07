import assert from "node:assert/strict";
import test from "node:test";
import shenzhenPoiAudit from "../knowledge-base/index/shenzhen-poi-audit-v1.json";

test("深圳56条索引均有且仅有一条治理结论", () => {
  assert.equal(shenzhenPoiAudit.length, 56);
  assert.equal(new Set(shenzhenPoiAudit.map((item) => item.case_id)).size, 56);
});

test("退出地图与全市级项目不伪造经纬度", () => {
  const nonPointItems = shenzhenPoiAudit.filter((item) =>
    ["excluded", "citywide"].includes(item.status),
  );
  assert.ok(nonPointItems.length > 0);
  nonPointItems.forEach((item) => {
    assert.equal(item.lng, null);
    assert.equal(item.lat, null);
  });
});

test("地图点位保留定位层级、方法和置信度", () => {
  const mappedItems = shenzhenPoiAudit.filter((item) =>
    ["mapped", "district"].includes(item.status),
  );
  assert.ok(mappedItems.length > 0);
  mappedItems.forEach((item) => {
    assert.equal(typeof item.lng, "number");
    assert.equal(typeof item.lat, "number");
    assert.ok(item.poi_method.length >= 8);
    assert.ok(["high", "medium"].includes(item.poi_confidence));
  });
});
