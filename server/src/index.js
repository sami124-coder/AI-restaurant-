import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { getAssistantReply } from "./ai.js";
import { executeTool } from "./tools.js";
import { dataConnectionStatus, importRestaurantData } from "./dataImport.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "3mb" }));
const secret = process.env.JWT_SECRET || "development-only-secret";

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), secret); next(); }
  catch { res.status(401).json({ error: "Authentication required" }); }
}
app.get("/api/health", (_, res) => res.json({ status: "ok", ai: process.env.OPENAI_API_KEY ? "openai" : "demo" }));
app.post("/api/auth/login", (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid email and password are required" });
  const owner = db.prepare("SELECT * FROM owners WHERE email=?").get(parsed.data.email);
  if (!owner || !bcrypt.compareSync(parsed.data.password, owner.password_hash)) return res.status(401).json({ error: "Invalid credentials" });
  const restaurant = db.prepare("SELECT id,name FROM restaurants WHERE owner_id=?").get(owner.id);
  res.json({ token: jwt.sign({ ownerId: owner.id, restaurantId: restaurant.id }, secret, { expiresIn: "12h" }), restaurant });
});
app.get("/api/dashboard", auth, (req, res) => {
  res.json({ sales: executeTool("get_daily_sales", {}, req.user.restaurantId), inventory: executeTool("get_inventory_status", {}, req.user.restaurantId), topDishes: executeTool("get_top_dishes", {}, req.user.restaurantId).slice(0, 3) });
});
app.get("/api/data/status", auth, (req, res) => res.json(dataConnectionStatus(req.user.restaurantId)));
app.post("/api/data/import", auth, (req, res, next) => {
  try {
    const parsed = z.object({
      type: z.enum(["orders", "refunds", "menu_items", "inventory", "staff_shifts"]),
      csv: z.string().min(1).max(2_500_000)
    }).parse(req.body);
    res.status(201).json(importRestaurantData(parsed.type, parsed.csv, req.user.restaurantId));
  } catch (error) { next(error); }
});
app.get("/api/chat/sessions", auth, (req, res) => res.json(db.prepare("SELECT * FROM chat_sessions WHERE restaurant_id=? ORDER BY created_at DESC").all(req.user.restaurantId)));
app.get("/api/chat/sessions/:id/messages", auth, (req, res) => {
  const session = db.prepare("SELECT id FROM chat_sessions WHERE id=? AND restaurant_id=?").get(req.params.id, req.user.restaurantId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(db.prepare("SELECT role,content,timestamp FROM chat_messages WHERE session_id=? ORDER BY id").all(session.id));
});
app.post("/api/chat", auth, async (req, res, next) => {
  try {
    const parsed = z.object({ message: z.string().trim().min(1).max(4000), sessionId: z.number().int().positive().optional() }).parse(req.body);
    let sessionId = parsed.sessionId;
    if (sessionId && !db.prepare("SELECT id FROM chat_sessions WHERE id=? AND restaurant_id=?").get(sessionId, req.user.restaurantId)) return res.status(404).json({ error: "Session not found" });
    if (!sessionId) sessionId = Number(db.prepare("INSERT INTO chat_sessions(restaurant_id,title) VALUES (?,?)").run(req.user.restaurantId, parsed.message.slice(0, 48)).lastInsertRowid);
    db.prepare("INSERT INTO chat_messages(session_id,role,content) VALUES (?,'user',?)").run(sessionId, parsed.message);
    const history = db.prepare("SELECT role,content FROM chat_messages WHERE session_id=? ORDER BY id DESC LIMIT 20").all(sessionId).reverse();
    const result = await getAssistantReply(history, req.user.restaurantId);
    const messageId = Number(db.prepare("INSERT INTO chat_messages(session_id,role,content) VALUES (?,'assistant',?)").run(sessionId, result.content).lastInsertRowid);
    res.json({ sessionId, message: { id: messageId, role: "assistant", content: result.content, toolsUsed: result.toolsUsed } });
  } catch (error) { next(error); }
});
app.post("/api/feedback", auth, (req, res, next) => {
  try {
    const parsed = z.object({
      sessionId: z.number().int().positive(),
      messageId: z.number().int().positive(),
      question: z.string().trim().min(1).max(4000),
      originalAnswer: z.string().trim().min(1).max(12000),
      rating: z.enum(["approved", "needs_correction"]),
      correctedAnswer: z.string().trim().max(12000).optional(),
      correctTools: z.array(z.string().min(1).max(80)).max(12).default([])
    }).parse(req.body);
    if (parsed.rating === "needs_correction" && !parsed.correctedAnswer) return res.status(400).json({ error: "Please provide the corrected answer." });
    const message = db.prepare("SELECT m.id FROM chat_messages m JOIN chat_sessions s ON s.id=m.session_id WHERE m.id=? AND m.session_id=? AND m.role='assistant' AND s.restaurant_id=?").get(parsed.messageId, parsed.sessionId, req.user.restaurantId);
    if (!message) return res.status(404).json({ error: "Assistant message not found." });
    db.prepare(`INSERT INTO answer_feedback(restaurant_id,session_id,message_id,question,original_answer,rating,corrected_answer,correct_tools)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(restaurant_id,message_id) DO UPDATE SET question=excluded.question,original_answer=excluded.original_answer,rating=excluded.rating,corrected_answer=excluded.corrected_answer,correct_tools=excluded.correct_tools,created_at=CURRENT_TIMESTAMP`)
      .run(req.user.restaurantId, parsed.sessionId, parsed.messageId, parsed.question, parsed.originalAnswer, parsed.rating, parsed.correctedAnswer || null, JSON.stringify(parsed.correctTools));
    res.status(201).json({ saved: true });
  } catch (error) { next(error); }
});
app.get("/api/training/export", auth, (req, res) => {
  const rows = db.prepare("SELECT question,original_answer,rating,corrected_answer,correct_tools,created_at FROM answer_feedback WHERE restaurant_id=? ORDER BY id").all(req.user.restaurantId);
  res.json(rows.map((row) => ({
    question: row.question,
    correct_tools: JSON.parse(row.correct_tools),
    approved_answer: row.corrected_answer || row.original_answer,
    source: row.rating === "approved" ? "owner_approved" : "owner_corrected",
    created_at: row.created_at
  })));
});
if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(currentDir, "../../web/dist");
  app.use(express.static(webDist));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}
app.use((error, _req, res, _next) => { console.error(error); res.status(error.name === "ZodError" ? 400 : 500).json({ error: error.name === "ZodError" ? "Invalid request" : "Unable to complete request" }); });
app.listen(process.env.PORT || 4000, () => console.log(`API listening on http://localhost:${process.env.PORT || 4000}`));
