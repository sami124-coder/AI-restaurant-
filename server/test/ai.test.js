import test from "node:test";
import assert from "node:assert/strict";
import { demoReply, SYSTEM_PROMPT } from "../src/ai.js";
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

