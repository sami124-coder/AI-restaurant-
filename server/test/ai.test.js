import test from "node:test";
import assert from "node:assert/strict";
import { demoReply, inferTools, SYSTEM_PROMPT } from "../src/ai.js";
import { db } from "../src/db.js";

const restaurantId = db.prepare("SELECT id FROM restaurants ORDER BY id LIMIT 1").get().id;

test("greeting receives a conversational response without fabricated figures", () => {
  const reply = demoReply("hello", restaurantId);
  assert.match(reply, /ready/i);
  assert.doesNotMatch(reply, /\$\d/);
  assert.doesNotMatch(reply, /Demo analysis|{\s*"/);
});

test("profit question returns readable data and an action", () => {
  const reply = demoReply("What is my profit this week?", restaurantId);
  assert.match(reply, /Revenue: \$/);
  assert.match(reply, /Profit: \$/);
  assert.match(reply, /Recommendation:/);
  assert.doesNotMatch(reply, /{\s*"/);
});

test("inventory answer identifies low stock in plain language", () => {
  const reply = demoReply("What needs restocking?", restaurantId);
  assert.match(reply, /Inventory needs attention/);
  assert.match(reply, /reorder at/);
});

test("system prompt requires confirmation for data-changing tools", () => {
  assert.match(SYSTEM_PROMPT, /explicitly confirms/i);
});

test("ambiguous questions trigger clarification instead of invented analysis", () => {
  const reply = demoReply("Can you analyze this?", restaurantId);
  assert.match(reply, /one specific restaurant question/i);
  assert.match(reply, /Useful things to ask/i);
  assert.doesNotMatch(reply, /\$\d/);
});

test("broad attention question combines multiple operational risks", () => {
  const reply = demoReply("What needs my attention?", restaurantId);
  assert.match(reply, /Inventory:/);
  assert.match(reply, /Menu profit:/);
  assert.match(reply, /Today:/);
  assert.match(reply, /Priority:/);
});

test("weak dish question returns margin evidence and a focused action", () => {
  const reply = demoReply("Which dish is hurting my profit?", restaurantId);
  assert.match(reply, /Menu profit risks/);
  assert.match(reply, /margin/);
  assert.match(reply, /Recommendation:/);
});

test("help explains the supported decision areas", () => {
  const reply = demoReply("What can you do?", restaurantId);
  assert.match(reply, /Summarize today/);
  assert.match(reply, /Suggest staffing/);
});

test("Arabic sales question receives an Arabic data-backed answer", () => {
  const reply = demoReply("كيف أداء المطعم اليوم؟", restaurantId);
  assert.match(reply, /أداء اليوم/);
  assert.match(reply, /المبيعات:/);
  assert.match(reply, /التوصية:/);
});

test("Arabic profit question returns real figures in Arabic", () => {
  const reply = demoReply("كم أرباح هذا الأسبوع؟", restaurantId);
  assert.match(reply, /ملخص الربح/);
  assert.match(reply, /الإيرادات:/);
  assert.match(reply, /\$/);
});

test("Arabic ambiguous question asks for clarification", () => {
  const reply = demoReply("حلل هذا", restaurantId);
  assert.match(reply, /القرار غير واضح/);
  assert.doesNotMatch(reply, /\$\d/);
});

test("tool traces identify staffing analysis in Arabic and English", () => {
  assert.deepEqual(inferTools("Do we need more staff tonight?"), ["get_daily_sales", "suggest_staffing"]);
  assert.deepEqual(inferTools("هل أحتاج موظفين إضافيين الليلة؟"), ["get_daily_sales", "suggest_staffing"]);
});

test("broad questions trace all supporting decision tools", () => {
  assert.deepEqual(inferTools("What needs my attention?"), ["get_daily_sales", "get_low_performance_items", "get_inventory_status"]);
});
