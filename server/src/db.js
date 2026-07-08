import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.env.DATABASE_PATH || "./data/restaurant.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS owners (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS restaurants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER NOT NULL REFERENCES owners(id));
CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), name TEXT NOT NULL, price REAL NOT NULL, cost REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), item_name TEXT NOT NULL, quantity REAL NOT NULL, threshold REAL NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), items TEXT NOT NULL, total_price REAL NOT NULL, cost REAL NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_sessions (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), title TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES chat_sessions(id), role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL, type TEXT NOT NULL, date_range TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS refunds (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), order_id INTEGER, amount REAL NOT NULL, reason TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS staff_shifts (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), employee_name TEXT NOT NULL, role TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, hourly_rate REAL NOT NULL);
CREATE TABLE IF NOT EXISTS answer_feedback (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), session_id INTEGER NOT NULL REFERENCES chat_sessions(id), message_id INTEGER NOT NULL REFERENCES chat_messages(id), question TEXT NOT NULL, original_answer TEXT NOT NULL, rating TEXT NOT NULL CHECK(rating IN ('approved','needs_correction')), corrected_answer TEXT, correct_tools TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(restaurant_id,message_id));
CREATE TABLE IF NOT EXISTS knowledge_documents (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), title TEXT NOT NULL, source TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS knowledge_chunks (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, chunk_index INTEGER NOT NULL, content TEXT NOT NULL);
`);

function seed() {
  if (db.prepare("SELECT count(*) n FROM owners").get().n) return;
  const owner = db.prepare("INSERT INTO owners(email,password_hash) VALUES (?,?)").run("owner@harbor.test", bcrypt.hashSync("demo1234", 10)).lastInsertRowid;
  const restaurant = db.prepare("INSERT INTO restaurants(name,owner_id) VALUES (?,?)").run("Harbor & Hearth", owner).lastInsertRowid;
  const menu = [
    ["Truffle Burger", 18, 7.2], ["Grilled Salmon", 26, 13.5], ["Garden Bowl", 14, 5.1],
    ["Margherita Pizza", 16, 4.8], ["Tiramisu", 9, 3.1], ["Lobster Pasta", 31, 22.5]
  ];
  const insertMenu = db.prepare("INSERT INTO menu_items(restaurant_id,name,price,cost) VALUES (?,?,?,?)");
  menu.forEach((m) => insertMenu.run(restaurant, ...m));
  const insertInventory = db.prepare("INSERT INTO inventory(restaurant_id,item_name,quantity,threshold) VALUES (?,?,?,?)");
  [["Salmon fillet", 8, 10], ["Burger buns", 42, 15], ["Tomatoes", 12, 10], ["Lobster", 4, 8], ["Coffee beans", 18, 6]].forEach((x) => insertInventory.run(restaurant, ...x));
  const insertOrder = db.prepare("INSERT INTO orders(restaurant_id,items,total_price,cost,created_at) VALUES (?,?,?,?,?)");
  const now = new Date();
  for (let day = 0; day < 14; day++) {
    for (let i = 0; i < 18 + ((day * 7) % 13); i++) {
      const item = menu[(i + day) % menu.length];
      const qty = 1 + (i % 2);
      const d = new Date(now); d.setDate(now.getDate() - day); d.setHours(11 + (i % 11), (i * 13) % 60, 0, 0);
      insertOrder.run(restaurant, JSON.stringify([{ name: item[0], quantity: qty, price: item[1], cost: item[2] }]), item[1] * qty, item[2] * qty, d.toISOString());
    }
  }
}
seed();
