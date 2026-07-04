import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, Send, Sparkles, TrendingUp, Package, Utensils, LogOut, ShieldCheck, CircleDollarSign, Database, Upload, X, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import "./styles.css";
import "./decision.css";
import "./data-panel.css";
import "./feedback.css";

const api = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

function Login({ onLogin }) {
  const [email, setEmail] = useState("owner@harbor.test"); const [password, setPassword] = useState("demo1234"); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); try { const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem("token", data.token); localStorage.setItem("restaurant", data.restaurant.name); window.dispatchEvent(new Event("auth-change")); onLogin(); } catch (x) { setError(x.message); } };
  return <main className="login"><section><div className="brand"><span><Bot /></span><b>Restaurant Decision AI</b></div><h1>Daily profit decisions.<br/><em>In seconds.</em></h1><p>The AI decision layer for restaurant owners — ask, understand, then approve.</p><div className="superpowers"><span>Daily summary</span><span>Menu profit</span><span>Stock warnings</span></div><form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error && <small>{error}</small>}<button>Open decision center</button></form></section><aside><div className="quote">“What deserves my attention tonight?”</div><div className="answer"><Sparkles size={18}/><div><b>Your next best move</b><br/>Two inventory items are below threshold. Review them before dinner service.</div></div><div className="boundary"><ShieldCheck/> You stay in control. AI recommends; you approve every operational change.</div></aside></main>;
}

const importOptions = { orders: "Orders & historical sales", refunds: "Refunds", menu_items: "Menu prices & costs", inventory: "Inventory levels", staff_shifts: "Staff shifts & labor cost" };

function DataPanel({ onClose, onImported }) {
  const [type, setType] = useState("orders"); const [file, setFile] = useState(); const [status, setStatus] = useState(); const [busy, setBusy] = useState(false); const [counts, setCounts] = useState();
  useEffect(()=>{api("/data/status").then(setCounts).catch(()=>{});},[]);
  const upload=async(event)=>{event.preventDefault();if(!file)return;setBusy(true);setStatus();try{const result=await api("/data/import",{method:"POST",body:JSON.stringify({type,csv:await file.text()})});setStatus({ok:true,text:`Imported ${result.imported} rows successfully.`});setCounts(await api("/data/status"));onImported();}catch(error){setStatus({ok:false,text:error.message});}finally{setBusy(false);}};
  return <div className="modal-backdrop"><section className="data-panel"><header><div><small>REAL RESTAURANT DATA</small><h2>Connect your operations</h2></div><button onClick={onClose} aria-label="Close"><X/></button></header><p>Upload CSV exports from your POS, inventory, menu, or scheduling system. Every row stays isolated to this restaurant.</p><div className="connection-grid">{counts&&Object.entries(importOptions).map(([key,label])=><article key={key}><Database/><div><b>{label}</b><small>{counts[key]} records connected</small></div></article>)}</div><form onSubmit={upload}><label>Data type<select value={type} onChange={e=>setType(e.target.value)}>{Object.entries(importOptions).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>CSV file<input type="file" accept=".csv,text/csv" onChange={e=>setFile(e.target.files[0])}/></label><small className="csv-help">Required columns are documented in the repository README.</small>{status&&<div className={status.ok?"import-success":"import-error"}>{status.text}</div>}<button className="import-button" disabled={!file||busy}><Upload/>{busy?"Importing…":"Import data"}</button></form></section></div>;
}

function FeedbackCollector() {
  const [answer, setAnswer] = useState(); const [correcting, setCorrecting] = useState(false); const [correction, setCorrection] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(()=>{const receive=(event)=>{setAnswer(event.detail);setCorrecting(false);setCorrection(event.detail.content);setSaved(false);};window.addEventListener("answer-ready",receive);return()=>window.removeEventListener("answer-ready",receive);},[]);
  if(!answer||saved)return null;
  const submit=async(rating)=>{await api("/feedback",{method:"POST",body:JSON.stringify({sessionId:answer.sessionId,messageId:answer.id,question:answer.question,originalAnswer:answer.content,rating,correctedAnswer:rating==="needs_correction"?correction:undefined,correctTools:answer.toolsUsed||[]})});setSaved(true);};
  return <aside className="feedback-card"><button className="feedback-close" onClick={()=>setSaved(true)}><X/></button><b>Was this manager answer correct?</b><small>Your feedback creates expert training examples.</small>{!correcting?<div><button onClick={()=>submit("approved")}><ThumbsUp/> Approve</button><button onClick={()=>setCorrecting(true)}><ThumbsDown/> Correct</button></div>:<form onSubmit={e=>{e.preventDefault();submit("needs_correction")}}><label>Manager-approved answer<textarea value={correction} onChange={e=>setCorrection(e.target.value)} rows="5"/></label><button><Check/> Save correction</button></form>}</aside>;
}

function App() {
  const [ready, setReady] = useState(!!localStorage.getItem("token")); const [messages, setMessages] = useState([{ role:"assistant", content:"Good afternoon. I can summarize today, find menu profit leaks, or flag inventory risks. Where should we start?" }]); const [text,setText]=useState(""); const [loading,setLoading]=useState(false); const [sessionId,setSessionId]=useState(); const [stats,setStats]=useState(); const bottom=useRef();
  useEffect(()=>{ if(ready) api("/dashboard").then(setStats).catch(()=>setReady(false)); },[ready]);
  useEffect(()=>bottom.current?.scrollIntoView({behavior:"smooth"}),[messages,loading]);
  const send=async(e, preset)=>{ e?.preventDefault(); const value=(preset||text).trim(); if(!value||loading)return; setText(""); setMessages(x=>[...x,{role:"user",content:value}]); setLoading(true); try{const d=await api("/chat",{method:"POST",body:JSON.stringify({message:value,sessionId})});setSessionId(d.sessionId);setMessages(x=>[...x,d.message]);window.dispatchEvent(new CustomEvent("answer-ready",{detail:{...d.message,sessionId:d.sessionId,question:value}}));api("/dashboard").then(setStats);}catch(x){setMessages(m=>[...m,{role:"assistant",content:`I couldn't complete that: ${x.message}`}]);}finally{setLoading(false);}};
  if(!ready)return <Login onLogin={()=>setReady(true)}/>;
  return <div className="shell"><aside className="sidebar"><div className="brand"><span><Bot /></span><b>Decision AI</b></div><div className="restaurant"><small>YOUR RESTAURANT</small><h2>{localStorage.getItem("restaurant")}</h2><i>● Data connected</i></div><nav><b>Today’s decision brief</b><article><TrendingUp/><div><small>NET SALES</small><strong>${stats?.sales.revenue?.toLocaleString()||"—"}</strong><p>{stats?.sales.orders||0} orders</p></div></article><article><CircleDollarSign/><div><small>EST. PROFIT</small><strong>${stats?.sales.profit?.toLocaleString()||"—"}</strong><p>{stats?.sales.margin_percent||0}% margin</p></div></article><article><Package/><div><small>STOCK RISKS</small><strong>{stats?.inventory.low_stock_count??"—"}</strong><p>need attention</p></div></article><article><Utensils/><div><small>TOP DISH</small><strong className="dish">{stats?.topDishes[0]?.name||"—"}</strong><p>${stats?.topDishes[0]?.revenue||0} revenue</p></div></article></nav><div className="approval-note"><ShieldCheck/><div><b>Owner approval required</b><small>AI cannot change operations without you.</small></div></div><button className="logout" onClick={()=>{localStorage.clear();setReady(false)}}><LogOut size={16}/> Sign out</button></aside><main className="chat"><header><div><small>AI DECISION COPILOT</small><h1>Decision center</h1></div><span><i/> Live data ready</span></header><section className="messages">{messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="avatar">{m.role==="assistant"?<Bot/>:"YO"}</div><div><small>{m.role==="assistant"?"DECISION AI":"YOU"}</small><p>{m.content}</p></div></div>)}{loading&&<div className="message assistant"><div className="avatar"><Bot/></div><div className="typing"><i/><i/><i/></div></div>}<div ref={bottom}/></section><footer><div className="prompts">{["Give me today’s business summary","Which dishes hurt my profit?","What inventory needs attention?"].map(x=><button onClick={()=>send(null,x)} key={x}>{x}</button>)}</div><form onSubmit={send}><textarea rows="1" value={text} onChange={e=>setText(e.target.value)} placeholder="Ask for a decision about sales, menu profit, or stock…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(e)}}}/><button disabled={loading||!text.trim()}><Send/></button></form><small>AI recommends. You approve. Every number comes from restaurant data.</small></footer></main></div>;
}
function Root() {
  const [showData, setShowData] = useState(false);
  const [authenticated, setAuthenticated] = useState(!!localStorage.getItem("token"));
  useEffect(()=>{const sync=()=>setAuthenticated(!!localStorage.getItem("token"));window.addEventListener("auth-change",sync);return()=>window.removeEventListener("auth-change",sync);},[]);
  return <>{authenticated&&<><button className="data-fab" onClick={()=>setShowData(true)}><Database/> Connect real data</button><FeedbackCollector/></>}{showData&&<DataPanel onClose={()=>setShowData(false)} onImported={()=>{}}/>}<App/></>;
}
createRoot(document.getElementById("root")).render(<Root/>);
