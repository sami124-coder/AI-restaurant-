import { db } from "./db.js";
import { searchKnowledgeBase } from "./knowledge.js";

const isoDay = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const rangeFor = (range = "week") => {
  const end = new Date(); const start = new Date();
  const days = range === "today" ? 0 : range === "month" ? 30 : 7;
  start.setDate(end.getDate() - days);
  return [range === "today" ? `${isoDay(start)}T00:00:00.000Z` : start.toISOString(), end.toISOString()];
};

export const toolDefinitions = [
  ["get_daily_sales", "Get sales, order count, profit and peak hour for a date", { date: { type: "string", description: "YYYY-MM-DD date" } }],
  ["get_profit_summary", "Get revenue, cost, profit and margin for a range", { range: { type: "string", enum: ["today", "week", "month"] } }],
  ["get_top_dishes", "Get best-selling dishes by revenue", {}],
  ["get_low_performance_items", "Find low-margin or low-selling menu items", {}],
  ["get_inventory_status", "Get stock levels and low-stock alerts", {}],
  ["get_refund_summary", "Get refund count, value, and common reasons for a range", { range: { type: "string", enum: ["today", "week", "month"] } }],
  ["search_knowledge_base", "Search uploaded restaurant books and SOPs for relevant guidance", { query: { type: "string" } }],
  ["create_report", "Create and save an operations report", { type: { type: "string" }, date_range: { type: "string", enum: ["today", "week", "month"] } }],
  ["suggest_staffing", "Suggest staffing from order demand", { level: { type: "string", enum: ["normal", "busy", "auto"] }, date_time: { type: "string" } }],
  ["flag_menu_item", "Activate or deactivate a menu item", { item_id: { type: "integer" }, action: { type: "string", enum: ["activate", "deactivate"] } }]
].map(([name, description, properties]) => ({ type: "function", name, description, strict: true, parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } }));

const ordersBetween = (restaurantId, start, end) => db.prepare("SELECT * FROM orders WHERE restaurant_id=? AND created_at BETWEEN ? AND ? ORDER BY created_at").all(restaurantId, start, end);
const totals = (orders) => {
  const revenue = orders.reduce((s, o) => s + o.total_price, 0);
  const cost = orders.reduce((s, o) => s + o.cost, 0);
  return { revenue: +revenue.toFixed(2), cost: +cost.toFixed(2), profit: +(revenue - cost).toFixed(2), margin_percent: revenue ? +(((revenue - cost) / revenue) * 100).toFixed(1) : 0, orders: orders.length };
};

export function executeTool(name, args, restaurantId) {
  if (name === "get_daily_sales") {
    const date = args.date || isoDay();
    const rows = ordersBetween(restaurantId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`);
    const hours = rows.reduce((a, o) => { const h = new Date(o.created_at).getHours(); a[h] = (a[h] || 0) + o.total_price; return a; }, {});
    const peak = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    return { date, ...totals(rows), peak_hour: peak ? `${peak[0]}:00–${+peak[0] + 1}:00` : null };
  }
  if (name === "get_profit_summary") {
    const [start, end] = rangeFor(args.range); return { range: args.range, ...totals(ordersBetween(restaurantId, start, end)) };
  }
  if (name === "get_top_dishes" || name === "get_low_performance_items") {
    const [start, end] = rangeFor("month"); const map = {};
    ordersBetween(restaurantId, start, end).forEach((o) => JSON.parse(o.items).forEach((i) => {
      const x = map[i.name] ||= { name: i.name, units: 0, revenue: 0, profit: 0 };
      x.units += i.quantity; x.revenue += i.price * i.quantity; x.profit += (i.price - i.cost) * i.quantity;
    }));
    const items = Object.values(map).map((x) => ({ ...x, revenue: +x.revenue.toFixed(2), profit: +x.profit.toFixed(2), margin_percent: x.revenue ? +(x.profit / x.revenue * 100).toFixed(1) : 0 }));
    return name === "get_top_dishes" ? items.sort((a, b) => b.revenue - a.revenue).slice(0, 5) : items.filter((x) => x.margin_percent < 35 || x.units < 5).sort((a, b) => a.margin_percent - b.margin_percent);
  }
  if (name === "get_inventory_status") {
    const items = db.prepare("SELECT id,item_name,quantity,threshold FROM inventory WHERE restaurant_id=? ORDER BY quantity<=threshold DESC,item_name").all(restaurantId);
    return { items: items.map((x) => ({ ...x, status: x.quantity <= x.threshold ? "low" : "ok" })), low_stock_count: items.filter((x) => x.quantity <= x.threshold).length };
  }
  if (name === "get_refund_summary") {
    const [start, end] = rangeFor(args.range);
    const rows = db.prepare("SELECT amount,reason FROM refunds WHERE restaurant_id=? AND created_at BETWEEN ? AND ?").all(restaurantId, start, end);
    const reasons = rows.reduce((result, row) => { const reason = row.reason || "Unspecified"; result[reason] = (result[reason] || 0) + 1; return result; }, {});
    return { range: args.range, refunds: rows.length, refunded_amount: +rows.reduce((sum, row) => sum + row.amount, 0).toFixed(2), top_reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count })) };
  }
  if (name === "search_knowledge_base") {
    return { query: args.query, results: searchKnowledgeBase(args.query, restaurantId) };
  }
  if (name === "suggest_staffing") {
    const date = (args.date_time || new Date().toISOString()).slice(0, 10);
    const sales = executeTool("get_daily_sales", { date }, restaurantId);
    const demand = args.level === "busy" ? Math.max(sales.orders, 40) : sales.orders;
    return { date_time: args.date_time, expected_orders: demand, recommendation: demand >= 40 ? "Schedule 1 extra server and 1 extra line cook for peak service." : demand >= 25 ? "Add 1 flexible server during peak hour." : "Standard staffing is sufficient.", basis: "orders and observed peak demand" };
  }
  if (name === "flag_menu_item") {
    const result = db.prepare("UPDATE menu_items SET active=? WHERE id=? AND restaurant_id=?").run(args.action === "activate" ? 1 : 0, args.item_id, restaurantId);
    return { updated: result.changes === 1, item_id: args.item_id, action: args.action };
  }
  if (name === "create_report") {
    const summary = executeTool("get_profit_summary", { range: args.date_range }, restaurantId);
    const inventory = executeTool("get_inventory_status", {}, restaurantId);
    const content = { type: args.type, summary, inventory_alerts: inventory.items.filter((x) => x.status === "low"), generated_at: new Date().toISOString() };
    const id = db.prepare("INSERT INTO reports(restaurant_id,type,date_range,content) VALUES (?,?,?,?)").run(restaurantId, args.type, args.date_range, JSON.stringify(content)).lastInsertRowid;
    return { report_id: id, ...content };
  }
  throw new Error(`Unknown tool: ${name}`);
}
