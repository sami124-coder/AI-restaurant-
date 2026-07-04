import { db } from "./db.js";

const requiredColumns = {
  orders: ["created_at", "total_price", "cost"],
  refunds: ["amount", "created_at"],
  menu_items: ["name", "price", "cost"],
  inventory: ["item_name", "quantity", "threshold"],
  staff_shifts: ["employee_name", "role", "start_at", "end_at", "hourly_rate"]
};

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export function parseCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV must contain a header and at least one data row.");
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`Row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
  return { headers, rows };
}

const number = (value, field, row) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Row ${row}: ${field} must be a non-negative number.`);
  return parsed;
};
const date = (value, field, row) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Row ${row}: ${field} must be a valid date.`);
  return parsed.toISOString();
};

export function importRestaurantData(type, csv, restaurantId) {
  if (!requiredColumns[type]) throw new Error("Unsupported import type.");
  const { headers, rows } = parseCsv(csv);
  const missing = requiredColumns[type].filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  if (rows.length > 10000) throw new Error("A single import cannot exceed 10,000 rows.");

  const run = db.transaction(() => {
    let imported = 0;
    rows.forEach((row, index) => {
      const line = index + 2;
      if (type === "orders") {
        const items = row.items?.trim() || JSON.stringify([{ name: row.item_name || "Imported sale", quantity: number(row.quantity || 1, "quantity", line), price: number(row.total_price, "total_price", line), cost: number(row.cost, "cost", line) }]);
        try { JSON.parse(items); } catch { throw new Error(`Row ${line}: items must be valid JSON when provided.`); }
        db.prepare("INSERT INTO orders(restaurant_id,items,total_price,cost,created_at) VALUES (?,?,?,?,?)").run(restaurantId, items, number(row.total_price, "total_price", line), number(row.cost, "cost", line), date(row.created_at, "created_at", line));
      } else if (type === "refunds") {
        db.prepare("INSERT INTO refunds(restaurant_id,order_id,amount,reason,created_at) VALUES (?,?,?,?,?)").run(restaurantId, row.order_id ? number(row.order_id, "order_id", line) : null, number(row.amount, "amount", line), row.reason || null, date(row.created_at, "created_at", line));
      } else if (type === "menu_items") {
        const existing = db.prepare("SELECT id FROM menu_items WHERE restaurant_id=? AND lower(name)=lower(?)").get(restaurantId, row.name);
        if (existing) db.prepare("UPDATE menu_items SET price=?,cost=?,active=? WHERE id=?").run(number(row.price, "price", line), number(row.cost, "cost", line), row.active?.toLowerCase() === "false" ? 0 : 1, existing.id);
        else db.prepare("INSERT INTO menu_items(restaurant_id,name,price,cost,active) VALUES (?,?,?,?,?)").run(restaurantId, row.name, number(row.price, "price", line), number(row.cost, "cost", line), row.active?.toLowerCase() === "false" ? 0 : 1);
      } else if (type === "inventory") {
        const existing = db.prepare("SELECT id FROM inventory WHERE restaurant_id=? AND lower(item_name)=lower(?)").get(restaurantId, row.item_name);
        if (existing) db.prepare("UPDATE inventory SET quantity=?,threshold=? WHERE id=?").run(number(row.quantity, "quantity", line), number(row.threshold, "threshold", line), existing.id);
        else db.prepare("INSERT INTO inventory(restaurant_id,item_name,quantity,threshold) VALUES (?,?,?,?)").run(restaurantId, row.item_name, number(row.quantity, "quantity", line), number(row.threshold, "threshold", line));
      } else {
        const start = date(row.start_at, "start_at", line); const end = date(row.end_at, "end_at", line);
        if (end <= start) throw new Error(`Row ${line}: end_at must be after start_at.`);
        db.prepare("INSERT INTO staff_shifts(restaurant_id,employee_name,role,start_at,end_at,hourly_rate) VALUES (?,?,?,?,?,?)").run(restaurantId, row.employee_name, row.role, start, end, number(row.hourly_rate, "hourly_rate", line));
      }
      imported++;
    });
    return imported;
  });
  return { type, imported: run(), imported_at: new Date().toISOString() };
}

export function dataConnectionStatus(restaurantId) {
  const count = (table) => db.prepare(`SELECT count(*) count FROM ${table} WHERE restaurant_id=?`).get(restaurantId).count;
  return {
    orders: count("orders"),
    refunds: count("refunds"),
    menu_items: count("menu_items"),
    inventory: count("inventory"),
    staff_shifts: count("staff_shifts")
  };
}
