import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, Send, Sparkles, TrendingUp, Package, Utensils, LogOut } from "lucide-react";
import "./styles.css";

const api = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

function Login({ onLogin }) {
  const [email, setEmail] = useState("owner@harbor.test"); const [password, setPassword] = useState("demo1234"); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); try { const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem("token", data.token); localStorage.setItem("restaurant", data.restaurant.name); onLogin(); } catch (x) { setError(x.message); } };
  return <main className="login"><section><div className="brand"><span><Bot /></span><b>Restaurant AI</b></div><h1>Your restaurant.<br/><em>Understood.</em></h1><p>Decisions, numbers, and next moves — in one conversation.</p><form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error && <small>{error}</small>}<button>Enter command center</button></form></section><aside><div className="quote">“What deserves my attention tonight?”</div><div className="answer"><Sparkles size={18}/> Two inventory items are below threshold. Your 7 PM service is pacing above average.</div></aside></main>;
}

function App() {
  const [ready, setReady] = useState(!!localStorage.getItem("token")); const [messages, setMessages] = useState([{ role:"assistant", content:"Good afternoon. I’m ready to review today’s operation. What would you like to know?" }]); const [text,setText]=useState(""); const [loading,setLoading]=useState(false); const [sessionId,setSessionId]=useState(); const [stats,setStats]=useState(); const bottom=useRef();
  useEffect(()=>{ if(ready) api("/dashboard").then(setStats).catch(()=>setReady(false)); },[ready]);
  useEffect(()=>bottom.current?.scrollIntoView({behavior:"smooth"}),[messages,loading]);
  const send=async(e, preset)=>{ e?.preventDefault(); const value=(preset||text).trim(); if(!value||loading)return; setText(""); setMessages(x=>[...x,{role:"user",content:value}]); setLoading(true); try{const d=await api("/chat",{method:"POST",body:JSON.stringify({message:value,sessionId})});setSessionId(d.sessionId);setMessages(x=>[...x,d.message]);api("/dashboard").then(setStats);}catch(x){setMessages(m=>[...m,{role:"assistant",content:`I couldn't complete that: ${x.message}`}]);}finally{setLoading(false);}};
  if(!ready)return <Login onLogin={()=>setReady(true)}/>;
  return <div className="shell"><aside className="sidebar"><div className="brand"><span><Bot /></span><b>Restaurant AI</b></div><div className="restaurant"><small>OPERATING</small><h2>{localStorage.getItem("restaurant")}</h2><i>● Live</i></div><nav><b>Today’s pulse</b><article><TrendingUp/><div><small>NET SALES</small><strong>${stats?.sales.revenue?.toLocaleString()||"—"}</strong><p>{stats?.sales.orders||0} orders</p></div></article><article><Package/><div><small>STOCK ALERTS</small><strong>{stats?.inventory.low_stock_count??"—"}</strong><p>need attention</p></div></article><article><Utensils/><div><small>TOP DISH</small><strong className="dish">{stats?.topDishes[0]?.name||"—"}</strong><p>${stats?.topDishes[0]?.revenue||0} revenue</p></div></article></nav><button className="logout" onClick={()=>{localStorage.clear();setReady(false)}}><LogOut size={16}/> Sign out</button></aside><main className="chat"><header><div><small>AI GENERAL MANAGER</small><h1>Command center</h1></div><span><i/> Systems online</span></header><section className="messages">{messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="avatar">{m.role==="assistant"?<Bot/>:"YO"}</div><div><small>{m.role==="assistant"?"RESTAURANT AI":"YOU"}</small><p>{m.content}</p></div></div>)}{loading&&<div className="message assistant"><div className="avatar"><Bot/></div><div className="typing"><i/><i/><i/></div></div>}<div ref={bottom}/></section><footer><div className="prompts">{["How are we doing today?","What is my profit this week?","What needs attention?"].map(x=><button onClick={()=>send(null,x)} key={x}>{x}</button>)}</div><form onSubmit={send}><textarea rows="1" value={text} onChange={e=>setText(e.target.value)} placeholder="Ask about sales, staffing, menu, inventory…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(e)}}}/><button disabled={loading||!text.trim()}><Send/></button></form><small>AI uses live restaurant data. Verify before making high-impact decisions.</small></footer></main></div>;
}
createRoot(document.getElementById("root")).render(<App/>);

