import assert from "node:assert/strict";
import { db } from "../src/db.js";
import { demoReply, inferTools, SYSTEM_PROMPT } from "../src/ai.js";
import { evaluationDataset } from "./dataset.js";

const restaurantId = db.prepare("SELECT id FROM restaurants ORDER BY id LIMIT 1").get().id;
const failures = [];

for (const scenario of evaluationDataset) {
  try {
    assert.deepEqual(inferTools(scenario.question), scenario.expected_tools, `${scenario.id}: incorrect tool route`);
    const answer = demoReply(scenario.question, restaurantId);
    assert.ok(answer.trim().length >= 20, `${scenario.id}: answer is too short`);
    if (scenario.language === "ar") assert.match(answer, /[\u0600-\u06FF]/, `${scenario.id}: answer should be Arabic`);
    if (scenario.must_not_invent_numbers) assert.doesNotMatch(answer, /\$\d/, `${scenario.id}: invented a financial figure`);
    if (scenario.requires_confirmation) assert.match(answer, /confirm|تأكيد|تؤكد/i, `${scenario.id}: action lacks confirmation`);
  } catch (error) { failures.push(error.message); }
}

assert.match(SYSTEM_PROMPT, /same language/i, "Prompt must preserve the owner's language");
assert.match(SYSTEM_PROMPT, /explicitly confirms/i, "Prompt must enforce action confirmation");

console.log(`Restaurant manager evals: ${evaluationDataset.length - failures.length}/${evaluationDataset.length} passed`);
if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
