import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db.js";
import { dataConnectionStatus, importRestaurantData, parseCsv } from "../src/dataImport.js";

const restaurantId = db.prepare("SELECT id FROM restaurants ORDER BY id LIMIT 1").get().id;

test("CSV parser handles quoted commas", () => {
  const result = parseCsv('name,price,cost\n"Burger, Deluxe",18,7');
  assert.equal(result.rows[0].name, "Burger, Deluxe");
});

test("menu import validates and stores restaurant-scoped economics", () => {
  const name = `Import Test ${Date.now()}`;
  try {
    const result = importRestaurantData("menu_items", `name,price,cost,active\n${name},22.5,8.25,true`, restaurantId);
    assert.equal(result.imported, 1);
    const item = db.prepare("SELECT * FROM menu_items WHERE restaurant_id=? AND name=?").get(restaurantId, name);
    assert.equal(item.price, 22.5);
    assert.equal(item.cost, 8.25);
  } finally {
    db.prepare("DELETE FROM menu_items WHERE restaurant_id=? AND name=?").run(restaurantId, name);
  }
});

test("import rejects missing required columns", () => {
  assert.throws(() => importRestaurantData("inventory", "item_name,quantity\nFlour,10", restaurantId), /Missing required columns: threshold/);
});

test("connection status reports all supported data sources", () => {
  const status = dataConnectionStatus(restaurantId);
  assert.deepEqual(Object.keys(status), ["orders", "refunds", "menu_items", "inventory", "staff_shifts"]);
});
