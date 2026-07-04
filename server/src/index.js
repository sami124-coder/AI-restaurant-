import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db.js";
import { getAssistantReply } from "./ai.js";
import { executeTool } from "./tools.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "64kb" }));
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
    const reply = await getAssistantReply(history, req.user.restaurantId);
    db.prepare("INSERT INTO chat_messages(session_id,role,content) VALUES (?,'assistant',?)").run(sessionId, reply);
    res.json({ sessionId, message: { role: "assistant", content: reply } });
  } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => { console.error(error); res.status(error.name === "ZodError" ? 400 : 500).json({ error: error.name === "ZodError" ? "Invalid request" : "Unable to complete request" }); });
app.listen(process.env.PORT || 4000, () => console.log(`API listening on http://localhost:${process.env.PORT || 4000}`));

