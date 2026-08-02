import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProjectTitle } from "../lib/ai-case-native-protocol";

test("removes an unseparated narrative subtitle after a complete platform name", () => {
  assert.equal(
    normalizeProjectTitle(
      "大湾区文化体育中心智慧运营管理平台从大型场馆建设交付走向“建、管、服、营”一体化运营",
    ),
    "大湾区文化体育中心智慧运营管理平台",
  );
});

test("removes narrative subtitles separated by a dash or colon", () => {
  assert.equal(
    normalizeProjectTitle("某城市运行管理平台——从分散处置走向协同治理"),
    "某城市运行管理平台",
  );
  assert.equal(
    normalizeProjectTitle("某园区数字孪生系统：面向全过程的协同管理"),
    "某园区数字孪生系统",
  );
});

test("keeps legitimate compound project names intact", () => {
  assert.equal(
    normalizeProjectTitle("深圳市统一政务服务平台建设项目"),
    "深圳市统一政务服务平台建设项目",
  );
  assert.equal(
    normalizeProjectTitle("大湾区文化体育中心智慧运营管理平台"),
    "大湾区文化体育中心智慧运营管理平台",
  );
});
