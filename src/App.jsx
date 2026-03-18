import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
 
// ═══════════════════════════════════════════════════════════════
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC || "https://api.mainnet-beta.solana.com";
 
async function api(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}
 
// ═══════════════════════════════════════════════════════════════
// PHANTOM
// ═══════════════════════════════════════════════════════════════
function getPhantom() {
  if (typeof window !== "undefined") {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
  }
  return null;
}
 
async function connectPhantom() {
  const p = getPhantom();
  if (!p) throw new Error("Phantom wallet not found. Install the Phantom extension.");
  const r = await p.connect();
  return { provider: p, publicKey: r.publicKey.toString() };
}
 
async function signPayment(provider, housePK, amountSol) {
  const conn = new Connection(HELIUS_RPC, "confirmed");
  const from = provider.publicKey;
  const to = new PublicKey(housePK);
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Math.round(amountSol * LAMPORTS_PER_SOL) }));
  const { blockhash } = await conn.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;
  const { signature } = await provider.signAndSendTransaction(tx);
  return signature;
}
 
async function getBalance(pk) {
  try { const c = new Connection(HELIUS_RPC, "confirmed"); return (await c.getBalance(new PublicKey(pk))) / LAMPORTS_PER_SOL; }
  catch { return 0; }
}
 
// ═══════════════════════════════════════════════════════════════
// GAME LOGIC (client preview only)
// ═══════════════════════════════════════════════════════════════
const CK = 15, BAR = "bar", OFF = "off", W = 1, B = -1;
const INIT = () => { const b = Array(24).fill(0); b[0]=-2;b[5]=5;b[7]=3;b[11]=-5;b[12]=5;b[16]=-3;b[18]=-5;b[23]=2; return b; };
 
function gvm(board,bW,bB,pl,dice){const m=[];fm(board,bW,bB,pl,[...dice],[],m,new Set());return m}
function fm(board,bW,bB,pl,rd,cm,am,seen){if(!rd.length){const k=JSON.stringify(cm);if(!seen.has(k)){seen.add(k);am.push([...cm])}return}let f=false;for(let di=0;di<rd.length;di++){const die=rd[di];const srcs=gs(board,bW,bB,pl);for(const src of srcs){const dest=gd(src,die,pl);if(dest===null)continue;if(!iv(board,bW,bB,pl,src,dest,die))continue;f=true;const[nb,nW,nB,hit]=am2(board,bW,bB,pl,src,dest);const nd=[...rd];nd.splice(di,1);fm(nb,nW,nB,pl,nd,[...cm,{from:src,to:dest,die,hit}],am,seen)}}if(!f&&cm.length>0){const k=JSON.stringify(cm);if(!seen.has(k)){seen.add(k);am.push([...cm])}}}
function gs(board,bW,bB,pl){const bar=pl===W?bW:bB;if(bar>0)return[BAR];const s=[];for(let i=0;i<24;i++){if((pl===W&&board[i]>0)||(pl===B&&board[i]<0))s.push(i)}return s}
function gd(src,die,pl){if(src===BAR)return pl===W?24-die:die-1;const d=pl===W?src-die:src+die;if(d<0||d>23)return OFF;return d}
function cbo(board,pl){for(let i=0;i<24;i++){if(pl===W&&board[i]>0&&i>5)return false;if(pl===B&&board[i]<0&&i<18)return false}return true}
function iv(board,bW,bB,pl,src,dest,die){const bar=pl===W?bW:bB;if(src===BAR&&bar===0)return false;if(src!==BAR&&bar>0)return false;if(src!==BAR){if(pl===W&&board[src]<=0)return false;if(pl===B&&board[src]>=0)return false}if(dest===OFF){if(!cbo(board,pl))return false;if(src!==BAR){if(pl===W&&die>src+1){for(let i=src+1;i<=5;i++)if(board[i]>0)return false}else if(pl===B&&die>(24-src)){for(let i=src-1;i>=18;i--)if(board[i]<0)return false}}return true}if(pl===W&&board[dest]<-1)return false;if(pl===B&&board[dest]>1)return false;return true}
function am2(board,bW,bB,pl,src,dest){const nb=[...board];let nW=bW,nB=bB,hit=false;if(src===BAR){if(pl===W)nW--;else nB--}else{nb[src]+=pl===W?-1:1}if(dest!==OFF){if(pl===W&&nb[dest]===-1){nb[dest]=0;nB++;hit=true}else if(pl===B&&nb[dest]===1){nb[dest]=0;nW++;hit=true}nb[dest]+=pl===W?1:-1}return[nb,nW,nB,hit]}
function gbo(board,bW,bB,pl){let on=pl===W?bW:bB;for(let i=0;i<24;i++){if(pl===W&&board[i]>0)on+=board[i];if(pl===B&&board[i]<0)on+=Math.abs(board[i])}return CK-on}
function gmm(vm){if(!vm.length)return 0;return Math.max(...vm.map(m=>m.length))}
 
// ═══════════════════════════════════════════════════════════════
// SESSION PERSISTENCE
// ═══════════════════════════════════════════════════════════════
function saveSession(lobbyId, playerId, myColor, playerName) {
  try { sessionStorage.setItem("bg_session", JSON.stringify({ lobbyId, playerId, myColor, playerName, ts: Date.now() })); } catch {}
}
function loadSession() {
  try { const s = sessionStorage.getItem("bg_session"); if (!s) return null; const d = JSON.parse(s); if (Date.now() - d.ts > 4 * 3600000) return null; return d; } catch { return null; }
}
function clearSession() { try { sessionStorage.removeItem("bg_session"); } catch {} }
 
// ═══════════════════════════════════════════════════════════════
// CSS — PokerNow-inspired dark green felt
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box}
:root{
  --bg:#1a1e24;--felt:#1e3a2a;--felt-light:#245538;--felt-dark:#152e20;
  --card:#252a31;--card-border:#333a42;--card-hover:#2c3239;
  --text:#e8e6e3;--text-dim:#8a9199;--text-muted:#5a6169;
  --accent:#c8aa6e;--red:#e74c3c;--red-hover:#c0392b;
  --green:#27ae60;--green-hover:#219a52;--green-dark:#1e8449;
  --sol:#9945FF;--sol-dim:#7B3FE4;
  --white-checker:#e8e1d4;--black-checker:#1a1a1a;
  --radius:6px;
}
body{margin:0;background:var(--bg);font-family:'Inter',system-ui,sans-serif;color:var(--text)}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes diceDrop{0%{transform:translateY(-14px) rotate(-8deg);opacity:0}50%{transform:translateY(2px) rotate(2deg);opacity:1}100%{transform:translateY(0) rotate(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes firework{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--fx),var(--fy)) scale(0);opacity:0}}
@keyframes popIn{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}
@keyframes toastIn{0%{transform:translateY(-20px) scale(0.9);opacity:0}15%{transform:translateY(0) scale(1);opacity:1}85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-20px) scale(0.9);opacity:0}}.fade-in{animation:fadeIn .3s ease both}
.slide-up{animation:slideUp .4s ease both}
.slide-down{animation:slideDown .35s cubic-bezier(.4,1.4,.6,1) both}
.dice-drop{animation:diceDrop .4s cubic-bezier(.4,1.4,.6,1) both}
.pop-in{animation:popIn .35s cubic-bezier(.4,1.4,.6,1) both}
.spin{animation:spin .8s linear infinite}
`;
 
// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Btn = ({ children, variant = "default", disabled, style, ...p }) => {
  const base = { display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,border:"none",borderRadius:4,padding:"10px 20px",fontSize:14,fontWeight:600,fontFamily:"'Inter',sans-serif",cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,transition:"all .15s ease",...style };
  const variants = {
    default: { background:"var(--card)",color:"var(--text-dim)",border:"1px solid var(--card-border)" },
    primary: { background:"var(--green)",color:"#fff" },
    danger: { background:"var(--red)",color:"#fff" },
    accent: { background:"var(--accent)",color:"#1a1a1a" },
    sol: { background:"var(--sol)",color:"#fff" },
    ghost: { background:"transparent",color:"var(--text-dim)",border:"1px solid var(--card-border)" },
  };
  return <button {...p} disabled={disabled} style={{ ...base, ...variants[variant] }} onMouseEnter={e=>{if(!disabled)e.target.style.filter="brightness(1.1)"}} onMouseLeave={e=>{e.target.style.filter=""}}>{children}</button>;
};
 
function Fireworks() {
  const p = useMemo(() => Array.from({ length: 40 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 40 + (Math.random() - .5) * .5, d = 50 + Math.random() * 130;
    return { fx: Math.cos(a) * d, fy: Math.sin(a) * d, c: ['var(--accent)','var(--red)','#40c0f0','var(--green)','#f080d0','var(--sol)'][i % 6], s: 3 + Math.random() * 5, del: Math.random() * .3, dur: .7 + Math.random() * .5 };
  }), []);
  return <div style={{ position: "absolute", top: "50%", left: "50%", pointerEvents: "none", zIndex: 10 }}>{p.map((p, i) => <div key={i} style={{ position: "absolute", width: p.s, height: p.s, borderRadius: "50%", background: p.c, '--fx': `${p.fx}px`, '--fy': `${p.fy}px`, animation: `firework ${p.dur}s ${p.del}s cubic-bezier(.16,1,.3,1) both` }} />)}</div>;
}
 
function DiceDisplay({ dice, usedDice = [], diceKey }) {
  if (!dice?.length) return null;
  const used = new Set();
  const rem = [...dice];
  for (const d of usedDice) { const i = rem.findIndex((v, j) => v === d && !used.has(j)); if (i >= 0) used.add(i); }
  return <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0" }}>{dice.map((d, i) => {
    const u = used.has(i);
    return <div key={`${diceKey}-${i}`} className={u ? "" : "dice-drop"} style={{
      width: 40, height: 40, background: u ? "var(--felt-dark)" : "#f5f0e1", border: u ? "1px solid var(--felt-light)" : "2px solid var(--accent)",
      borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 20, fontWeight: 700, color: u ? "var(--text-muted)" : "#1a1a1a", opacity: u ? .3 : 1,
      animationDelay: `${i * .08}s`, transition: "all .3s ease",
    }}>{d}</div>;
  })}</div>;
}
 
function TxOverlay({ message }) {
  return <div className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
    <div className="slide-down" style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "32px 40px", textAlign: "center", maxWidth: 380 }}>
      <div className="spin" style={{ width: 36, height: 36, border: "3px solid var(--card-border)", borderTopColor: "var(--sol)", borderRadius: "50%", margin: "0 auto 16px" }} />
      <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{message}</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Confirm in Phantom...</div>
    </div>
  </div>;
}
 
function ConfirmMoveModal({ onConfirm, onUndo }) {
  return <div className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
    <div className="pop-in" style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "28px 36px", textAlign: "center", maxWidth: 340 }}>
      <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 20, fontWeight: 500 }}>Confirm your move?</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Btn variant="ghost" onClick={onUndo}>Undo</Btn>
        <Btn variant="primary" onClick={onConfirm}>Confirm</Btn>
      </div>
    </div>
  </div>;
}
 
function WalletBtn({ wallet, onConnect, balance }) {
  if (wallet) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--felt-dark)", borderRadius: 4, border: "1px solid var(--felt-light)", fontSize: 13 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#14F195" }} />
      <span style={{ color: "var(--sol)", fontFamily: "monospace", fontWeight: 600 }}>{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
      {balance !== null && <span style={{ color: "var(--text-muted)" }}>{balance.toFixed(3)} SOL</span>}
    </div>;
  }
  return <Btn variant="sol" onClick={onConnect} style={{ fontSize: 13, padding: "8px 16px" }}>👻 Connect Phantom</Btn>;
}
 
 
// ═══════════════════════════════════════════════════════════════
// BOARD SVG
// ═══════════════════════════════════════════════════════════════
function BoardSVG({ board, barW, barB, selectedPoint, validDestinations, onPointClick, onBarClick, playerColor, cubeValue, cubeOwner, offW, offB }) {
  const WD = 780, HT = 540, M = 32, BW = 36;
  const PW = (WD - M * 2 - BW) / 12, PH = 215, CR = Math.min(PW * .44, 21);
  const wC = "var(--white-checker)", bC = "var(--black-checker)";
 
  // White's view: 
  //   Top L→R: pt13,14,15,16,17,18 | pt19,20,21,22,23,24  (idx 12..17 | 18..23)
  //   Bot L→R: pt12,11,10,9,8,7    | pt6,5,4,3,2,1        (idx 11..6  | 5..0)
  //   White home = bottom-right (pts 1-6). White moves counterclockwise.
  //
  // Black's view (180° flip):
  //   Top L→R: pt1,2,3,4,5,6       | pt7,8,9,10,11,12     (idx 0..5   | 6..11)
  //   Bot L→R: pt24,23,22,21,20,19 | pt18,17,16,15,14,13  (idx 23..18 | 17..12)
  //   Black home = bottom-left (pts 19-24). Black moves counterclockwise.
  // Both players see the same board. No flipping.
  // Top L→R: pts 13,14,15,16,17,18 | 19,20,21,22,23,24  (idx 12-17 | 18-23)
  // Bot L→R: pts 12,11,10,9,8,7    | 6,5,4,3,2,1        (idx 11-6  | 5-0)
  // White home = bottom-right (pts 1-6). White moves counterclockwise.
  // Black home = top-right (pts 19-24). Black moves clockwise.
  const topRow = [12, 13, 14, 15, 16, 17, null, 18, 19, 20, 21, 22, 23];
  const botRow = [11, 10, 9, 8, 7, 6, null, 5, 4, 3, 2, 1, 0];
 
  function gx(vi) { return vi < 6 ? M + vi * PW + PW / 2 : M + 6 * PW + BW + (vi - 6) * PW + PW / 2; }
 
  function drawPt(idx, vi, top) {
    const x = gx(vi), y = top ? M : HT - M, dir = top ? 1 : -1;
    const sel = selectedPoint === idx, val = validDestinations.includes(idx);
    const fill = idx % 2 === 0 ? "#2a5a3a" : "#1e4430";
    const pts = `${x - PW / 2 + 2},${y} ${x},${y + dir * PH} ${x + PW / 2 - 2},${y}`;
    return (
      <g key={`p${idx}`} onClick={() => onPointClick(idx)} style={{ cursor: "pointer" }}>
        <rect x={x - PW / 2} y={top ? M : HT - M - PH} width={PW} height={PH} fill="transparent" />
        <polygon points={pts} fill={val ? "rgba(39,174,96,.25)" : fill} stroke={sel ? "var(--accent)" : "none"} strokeWidth={sel ? 2 : 0} />
        {val && <circle cx={x} cy={y + dir * (CR + Math.abs(board[idx]) * CR * 1.8)} r={CR * .45} fill="rgba(39,174,96,.35)" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="3 2"><animate attributeName="opacity" values=".3;.8;.3" dur="1.5s" repeatCount="indefinite" /></circle>}
        {drawCk(board[idx], x, y, dir, idx)}
        <text x={x} y={top ? M - 6 : HT - M + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="'Inter',sans-serif">{idx + 1}</text>
      </g>
    );
  }
 
  function drawCk(count, cx, by, dir, pi) {
    if (!count) return null;
    const isW = count > 0, col = isW ? wC : bC, st = isW ? "#c4a882" : "#444";
    const n = Math.abs(count), items = [], mx = 5, sel = selectedPoint === pi;
    for (let i = 0; i < Math.min(n, mx); i++) {
      const cy = by + dir * (CR + i * CR * 1.8), isTop = i === Math.min(n, mx) - 1;
      items.push(
        <g key={i} style={sel && isTop ? { filter: "drop-shadow(0 0 6px var(--accent))" } : {}}>
          <circle cx={cx} cy={cy} r={CR} fill={col} stroke={st} strokeWidth={1.5} />
          {isW && <circle cx={cx} cy={cy} r={CR * .5} fill="none" stroke={st} strokeWidth={.7} opacity={.3} />}
          {sel && isTop && <circle cx={cx} cy={cy} r={CR + 3} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={.6}><animate attributeName="opacity" values=".3;.8;.3" dur="1.2s" repeatCount="indefinite" /></circle>}
        </g>
      );
    }
    if (n > mx) items.push(<text key="c" x={cx} y={by + dir * (CR + (mx - 1) * CR * 1.8) + 4} textAnchor="middle" fill={isW ? "#333" : "#ccc"} fontSize="12" fontWeight="700">{n}</text>);
    return items;
  }
 
  function drawBar() {
    const bx = M + 6 * PW, items = [];
    for (let i = 0; i < barW; i++) items.push(<circle key={`bw${i}`} cx={bx + BW / 2} cy={HT / 2 + 30 + i * 24} r={CR * .85} fill={wC} stroke="#c4a882" strokeWidth={1.5} onClick={() => onBarClick(W)} style={{ cursor: "pointer" }} />);
    for (let i = 0; i < barB; i++) items.push(<circle key={`bb${i}`} cx={bx + BW / 2} cy={HT / 2 - 30 - i * 24} r={CR * .85} fill={bC} stroke="#444" strokeWidth={1.5} onClick={() => onBarClick(B)} style={{ cursor: "pointer" }} />);
    return items;
  }
 
  function drawOff() {
    const items = [], ox = WD - 18;
    for (let i = 0; i < offW; i++) items.push(<rect key={`ow${i}`} x={ox - 10} y={HT - M - 6 - i * 8} width={20} height={6} rx={1} fill={wC} stroke="#c4a882" strokeWidth={.5} />);
    for (let i = 0; i < offB; i++) items.push(<rect key={`ob${i}`} x={ox - 10} y={M + i * 8} width={20} height={6} rx={1} fill={bC} stroke="#444" strokeWidth={.5} />);
    if (validDestinations.includes(OFF)) {
      const oy = playerColor === W ? HT - M - 120 : M;
      items.push(<g key="off" onClick={() => onPointClick(OFF)} style={{ cursor: "pointer" }}><rect x={ox - 14} y={oy} width={28} height={120} rx={4} fill="rgba(39,174,96,.2)" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 3" /><text x={ox} y={oy + 64} textAnchor="middle" fill="var(--green)" fontSize="10" fontWeight="600">OFF</text></g>);
    }
    return items;
  }
 
  function drawCube() {
    let cx, cy;
    if (cubeOwner === 0) { cx = M + 6 * PW + BW / 2; cy = HT / 2; }
    else if (cubeOwner === W) { cx = 14; cy = HT - M - 50; }
    else { cx = 14; cy = M + 50; }
    return <g><rect x={cx - 13} y={cy - 13} width={26} height={26} rx={3} fill="#3a2a18" stroke="var(--accent)" strokeWidth={1} /><text x={cx} y={cy + 5} textAnchor="middle" fill="var(--accent)" fontSize="13" fontWeight="700" fontFamily="'Inter',sans-serif">{cubeValue}</text></g>;
  }
 
  const top = topRow.filter(x => x !== null), bot = botRow.filter(x => x !== null);
  return (
    <svg viewBox={`0 0 ${WD} ${HT}`} style={{ width: "100%", maxWidth: 820, display: "block", margin: "0 auto" }}>
      <rect x={0} y={0} width={WD} height={HT} rx={8} fill="var(--felt-dark)" />
      <rect x={M - 3} y={M - 3} width={WD - M * 2 + 6} height={HT - M * 2 + 6} rx={4} fill="var(--felt)" stroke="var(--felt-light)" strokeWidth={1} />
      <rect x={M + 6 * PW} y={M - 3} width={BW} height={HT - M * 2 + 6} fill="var(--felt-dark)" />
      {top.map((idx, vi) => drawPt(idx, vi, true))}
      {bot.map((idx, vi) => drawPt(idx, vi, false))}
      {drawBar()}{drawOff()}{drawCube()}
    </svg>
  );
}
 
// ── Doubling Dialog ──
function DoublingDialog({ type, cubeValue, onAccept, onReject, playerName, wagerPerPoint }) {
  const newCube = type === "beaver" ? cubeValue * 4 : cubeValue * 2;
  const cost = (newCube - cubeValue) * wagerPerPoint;
  return <div className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
    <div className="slide-down" style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "28px 36px", textAlign: "center", maxWidth: 380 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🎲</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>{playerName} {type === "double" ? "doubles" : "beavers"}!</div>
      <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 6 }}>{type === "double" ? `Cube to ${cubeValue * 2}` : `Stakes now ${newCube}`}</div>
      {wagerPerPoint > 0 && <div style={{ color: "var(--sol)", fontSize: 13, marginBottom: 16 }}>Cost to accept: {cost.toFixed(4)} SOL</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
        <Btn variant="danger" onClick={onReject}>Drop ({cubeValue}pt)</Btn>
        <Btn variant="primary" onClick={() => onAccept(false)}>Take{wagerPerPoint > 0 ? ` (${cost.toFixed(4)})` : ""}</Btn>
        {type === "double" && <Btn variant="accent" onClick={() => onAccept(true)}>Beaver!</Btn>}
      </div>
    </div>
  </div>;
}
 
 
// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // URL params
  const [joinParam] = useState(() => new URLSearchParams(window.location.search).get("join"));
 
  const [screen, setScreen] = useState("home");
  const [lobbyId, setLobbyId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joinCode, setJoinCode] = useState(joinParam || "");
  const [wagerAmount, setWagerAmount] = useState("0");
  const [error, setError] = useState("");
  const [lobby, setLobby] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [validDestinations, setValidDestinations] = useState([]);
  const [pendingMoves, setPendingMoves] = useState([]);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [doublingDialog, setDoublingDialog] = useState(null);
  const [diceKey, setDiceKey] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);
  const pollRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const prevTurnRef = useRef(null);
  const [walletAddr, setWalletAddr] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [phantomProvider, setPhantomProvider] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [housePK, setHousePK] = useState(null);
  const [publicLobbies, setPublicLobbies] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserFilter, setBrowserFilter] = useState("joinable"); // "all" | "joinable"
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [turnToast, setTurnToast] = useState(false);
 
  // Init
  useEffect(() => {
    if (!document.getElementById('bg-css')) { const s = document.createElement('style'); s.id = 'bg-css'; s.textContent = CSS; document.head.appendChild(s); }
    api("/house").then(d => setHousePK(d.publicKey)).catch(() => {});
    // Restore session
    const session = loadSession();
    if (session) {
      setLobbyId(session.lobbyId); setPlayerId(session.playerId); setMyColor(session.myColor); setPlayerName(session.playerName);
      setScreen("game"); // will fall back to lobby via poll if game hasn't started
    }
    // Auto-connect phantom
    const p = getPhantom();
    if (p && p.isConnected && p.publicKey) { setPhantomProvider(p); setWalletAddr(p.publicKey.toString()); getBalance(p.publicKey.toString()).then(b => setWalletBalance(b)).catch(() => {}); }
    // Fetch public lobbies
    api("/lobbies").then(d => setPublicLobbies(d.lobbies || [])).catch(() => {});
  }, []);
 
  async function handleConnect() {
    try { const { provider, publicKey } = await connectPhantom(); setPhantomProvider(provider); setWalletAddr(publicKey); setError(""); setWalletBalance(await getBalance(publicKey)); }
    catch (e) { setError(e.message); }
  }
 
  async function refreshBal() { if (walletAddr) try { setWalletBalance(await getBalance(walletAddr)); } catch {} }
 
  async function payAndCall(amt, path, body) {
    let sig = null;
    if (amt > 0) {
      if (!housePK) throw new Error("Server not reachable");
      if (!phantomProvider) throw new Error("Wallet not connected");
      setTxStatus(`Sending ${amt} SOL...`);
      try { sig = await signPayment(phantomProvider, housePK, amt); } catch (e) { setTxStatus(null); throw new Error("Transaction failed: " + e.message); }
      setTxStatus("Verifying on-chain...");
    }
    try { const r = await api(path, { method: "POST", body: { ...body, txSignature: sig } }); setTxStatus(null); await refreshBal(); return r; }
    catch (e) { setTxStatus(null); throw e; }
  }
 
  async function createLobby() {
    if (!nameInput.trim()) { setError("Enter a name"); return; }
    const wager = parseFloat(wagerAmount) || 0;
    if (wager > 0 && !walletAddr) { setError("Connect Phantom to wager SOL"); return; }
    try {
      const r = await payAndCall(wager, "/lobby/create", { playerName: nameInput.trim(), wallet: walletAddr || "", wagerPerPoint: wager });
      setPlayerName(nameInput.trim()); setLobbyId(r.lobbyId); setPlayerId(r.playerId); setMyColor(r.color);
      saveSession(r.lobbyId, r.playerId, r.color, nameInput.trim());
      setScreen("lobby"); setError("");
    } catch (e) { setError(e.message); }
  }
 
  async function joinLobby() {
    if (!nameInput.trim()) { setError("Enter a name"); return; }
    const code = (joinCode || joinParam || "").trim();
    if (!code) { setError("Enter a lobby code"); return; }
    try {
      const ld = await api(`/lobby/${code}`);
      const wager = ld.wagerPerPoint || 0;
      if (wager > 0 && !walletAddr) { setError(`Connect Phantom — lobby requires ${wager} SOL`); return; }
      const r = await payAndCall(wager, `/lobby/${code}/join`, { playerName: nameInput.trim(), wallet: walletAddr || "" });
      setPlayerName(nameInput.trim()); setLobbyId(code); setPlayerId(r.playerId); setMyColor(r.color);
      saveSession(code, r.playerId, r.color, nameInput.trim());
      setScreen("lobby"); setError(""); window.history.replaceState({}, "", window.location.pathname);
    } catch (e) { setError(e.message); }
  }
 
  async function startGame() {
    try { const r = await api(`/lobby/${lobbyId}/start`, { method: "POST", body: { playerId } }); setLobby(r); setDiceKey(k => k + 1); setShowFireworks(false); setPendingMoves([]); setAwaitingConfirm(false); }
    catch (e) { setError(e.message); }
  }
 
  // Track pending state in refs so polling doesn't re-create on every move
  const pendingRef = useRef(pendingMoves);
  const confirmRef = useRef(awaitingConfirm);
  useEffect(() => { pendingRef.current = pendingMoves; }, [pendingMoves]);
  useEffect(() => { confirmRef.current = awaitingConfirm; }, [awaitingConfirm]);
 
  // Polling — uses refs to check mid-move state without re-creating the callback
  const pollGame = useCallback(async () => {
    if (!lobbyId) return;
    if (pendingRef.current.length > 0 || confirmRef.current) return;
    try {
      const d = await api(`/lobby/${lobbyId}`);
      if (d.game && prevTurnRef.current !== null && d.game.turn !== prevTurnRef.current) {
        setDiceKey(k => k + 1); setPendingMoves([]); setAwaitingConfirm(false);
        if (d.game.turn === myColor && d.game.phase === "move") { setTurnToast(true); setTimeout(() => setTurnToast(false), 2000); }
      }
      if (d.game) prevTurnRef.current = d.game.turn;
      setLobby(d);
      if (d.game?.doublingPending?.target === myColor) setDoublingDialog({ type: d.game.doublingPending.type, from: d.game.doublingPending.from }); else setDoublingDialog(null);
      if (d.game?.phase === "gameover" && !showFireworks) setShowFireworks(true);
      if (d.status === "playing" && screen === "lobby") { setScreen("game"); if (d.game?.turn === myColor) { setTurnToast(true); setTimeout(() => setTurnToast(false), 2000); } }
      if (d.status === "waiting" && screen === "game") setScreen("lobby");
    } catch {}
  }, [lobbyId, myColor, screen, showFireworks]);
 
  useEffect(() => { if (lobbyId) { pollGame(); pollRef.current = setInterval(pollGame, 1500); return () => clearInterval(pollRef.current); } }, [lobbyId, pollGame]);
 
  const game = lobby?.game;
  const isMyTurn = game?.turn === myColor;
  const wagerPP = lobby?.wagerPerPoint || 0;
  const hostName = lobby?.host?.name || "Host";
  const guestName = lobby?.guest?.name || "Waiting...";
  const matchScore = lobby?.matchScore || { w: 0, b: 0 };
 
  async function submitMoves(moves = pendingMoves) {
    try { const r = await api(`/lobby/${lobbyId}/move`, { method: "POST", body: { playerId, moves } }); setLobby(r); }
    catch (e) { setError(e.message); }
    setPendingMoves([]); setSelectedPoint(null); setValidDestinations([]); setDiceKey(k => k + 1); setAwaitingConfirm(false);
  }
 
  async function handleDouble() {
    if (!isMyTurn || game.phase !== "move") return;
    if (game.cubeOwner !== 0 && game.cubeOwner !== myColor) return;
    try { const r = await payAndCall(game.cubeValue * wagerPP, `/lobby/${lobbyId}/double`, { playerId }); setLobby(r); }
    catch (e) { setError(e.message); }
  }
 
  async function handleDoubleResponse(accept, beaver = false) {
    const dp = game.doublingPending; if (!dp) return;
    const action = !accept ? "drop" : beaver ? "beaver" : "accept";
    const nc = beaver ? dp.value * 2 : dp.value;
    const cost = accept ? (nc - game.cubeValue) * wagerPP : 0;
    try { const r = await payAndCall(cost, `/lobby/${lobbyId}/double-response`, { playerId, action }); setLobby(r); }
    catch (e) { setError(e.message); }
    setDoublingDialog(null);
  }
 
  // Pure helper functions — no dependency on React state, always compute from source
  function computeBoard(moves) {
    if (!game) return { board: INIT(), barW: 0, barB: 0 };
    let b = [...game.board], bw = game.barW, bb = game.barB;
    for (const m of moves) { [b, bw, bb] = am2(b, bw, bb, myColor, m.from, m.to).slice(0, 3); }
    return { board: b, barW: bw, barB: bb };
  }
  function computeDice(moves) {
    if (!game) return [];
    const rd = [...game.dice];
    for (const m of moves) { const i = rd.indexOf(m.die); if (i >= 0) rd.splice(i, 1); }
    return rd;
  }
  function computeValid(moves) {
    if (!game || game.phase !== "move" || !isMyTurn) return [];
    const { board: b, barW: bw, barB: bb } = computeBoard(moves);
    return gvm(b, bw, bb, myColor, computeDice(moves));
  }
 
  // Memos for RENDERING only (board display, dice display, destination highlights)
  const currentBoard = useMemo(() => computeBoard(pendingMoves), [game, pendingMoves, myColor]);
  const remainingDice = useMemo(() => computeDice(pendingMoves), [game, pendingMoves]);
  const currentValidMoves = useMemo(() => awaitingConfirm ? [] : computeValid(pendingMoves), [game, isMyTurn, pendingMoves, myColor, awaitingConfirm]);
  const maxMoves = useMemo(() => gmm(currentValidMoves), [currentValidMoves]);
 
  function handlePointClick(pi) {
    if (!isMyTurn || game.phase !== "move" || awaitingConfirm) return;
 
    if (selectedPoint !== null && validDestinations.includes(pi)) {
      // Execute move — compute everything inline, no memo dependency
      const curBoard = computeBoard(pendingMoves);
      const curValid = computeValid(pendingMoves);
 
      // Find the die for this move
      let die = null;
      for (const ms of curValid) { if (ms.length > 0 && ms[0].from === selectedPoint && ms[0].to === pi) { die = ms[0].die; break; } }
      if (die === null) { die = computeDice(pendingMoves)[0]; }
 
      const [,,, hit] = am2(curBoard.board, curBoard.barW, curBoard.barB, myColor, selectedPoint, pi);
      const np = [...pendingMoves, { from: selectedPoint, to: pi, die, hit }];
 
      // Check dice remaining AFTER this move
      const diceAfter = computeDice(np);
 
      if (diceAfter.length === 0) {
        setPendingMoves(np); setSelectedPoint(null); setValidDestinations([]);
        setAwaitingConfirm(true);
        return;
      }
 
      // Check if any legal moves remain with leftover dice
      const boardAfter = computeBoard(np);
      const futureValid = gvm(boardAfter.board, boardAfter.barW, boardAfter.barB, myColor, diceAfter);
      if (gmm(futureValid) === 0) {
        setPendingMoves(np); setSelectedPoint(null); setValidDestinations([]);
        setAwaitingConfirm(true);
        return;
      }
 
      // More moves possible — continue
      setPendingMoves(np); setSelectedPoint(null); setValidDestinations([]);
      return;
    }
 
    if (selectedPoint === pi) { setSelectedPoint(null); setValidDestinations([]); return; }
 
    // Select a new source
    setSelectedPoint(null); setValidDestinations([]);
    const curBoard = computeBoard(pendingMoves);
    const bar = myColor === W ? curBoard.barW : curBoard.barB;
    if (pi === BAR || bar > 0) return;
    if ((myColor === W && curBoard.board[pi] <= 0) || (myColor === B && curBoard.board[pi] >= 0)) return;
 
    const curValid = computeValid(pendingMoves);
    const dests = new Set();
    for (const ms of curValid) { if (ms.length > 0 && ms[0].from === pi) dests.add(ms[0].to); }
    if (!dests.size) return;
    setSelectedPoint(pi); setValidDestinations([...dests]);
  }
 
  function handleBarClick(c) {
    if (c !== myColor || !isMyTurn || game.phase !== "move" || awaitingConfirm) return;
    const curBoard = computeBoard(pendingMoves);
    const bar = myColor === W ? curBoard.barW : curBoard.barB;
    if (!bar) return;
    const curValid = computeValid(pendingMoves);
    const dests = new Set();
    for (const ms of curValid) { if (ms.length > 0 && ms[0].from === BAR) dests.add(ms[0].to); }
    if (!dests.size) return;
    setSelectedPoint(BAR); setValidDestinations([...dests]);
  }
 
  function undoAll() { setPendingMoves([]); setSelectedPoint(null); setValidDestinations([]); setAwaitingConfirm(false); }
  function undoLast() { setPendingMoves(p => p.slice(0, -1)); setSelectedPoint(null); setValidDestinations([]); setAwaitingConfirm(false); }
 
  // Auto-select bar
  useEffect(() => {
    if (!isMyTurn || !game || game.phase !== "move" || awaitingConfirm) return;
    const curBoard = computeBoard(pendingMoves);
    const bar = myColor === W ? curBoard.barW : curBoard.barB;
    if (bar > 0 && selectedPoint !== BAR) handleBarClick(myColor);
  }, [isMyTurn, game?.phase, pendingMoves.length, awaitingConfirm]);
 
  function copyLink() {
    const link = `${window.location.origin}?join=${lobbyId}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }
 
  function goHome() { setScreen("home"); setPendingMoves([]); setAwaitingConfirm(false); setForfeitConfirm(false); }
  function abandonGame() { clearSession(); setLobbyId(null); setPlayerId(null); setMyColor(null); setLobby(null); setScreen("home"); setPendingMoves([]); setAwaitingConfirm(false); setForfeitConfirm(false); }
  function returnToGame() {
    if (lobbyId && playerId) {
      setScreen(lobby?.game ? "game" : "lobby");
    } else {
      const session = loadSession();
      if (session) {
        setLobbyId(session.lobbyId); setPlayerId(session.playerId); setMyColor(session.myColor); setPlayerName(session.playerName);
        setScreen("game");
      }
    }
  }
  const hasActiveSession = !!(lobbyId && playerId && screen === "home");
 
  async function fetchLobbies() {
    try { const d = await api("/lobbies"); setPublicLobbies(d.lobbies || []); }
    catch { setPublicLobbies([]); }
  }
 
  async function forfeitGame() {
    try {
      const r = await api(`/lobby/${lobbyId}/forfeit`, { method: "POST", body: { playerId } });
      setLobby(r); setForfeitConfirm(false); setPendingMoves([]); setAwaitingConfirm(false);
    } catch (e) { setError(e.message); setForfeitConfirm(false); }
  }
 
  function handleBrowserJoin(id) {
    setJoinCode(id); setShowBrowser(false);
  }
 
  // Board is the same for both players — no flipping
 
  // ═══════════════════════════════════════════════════════════════
  // JOIN PAGE (when ?join= is in URL and user hasn't joined yet)
  // ═══════════════════════════════════════════════════════════════
  if (joinParam && screen === "home") {
    return (
      <div style={S.page}>
        {txStatus && <TxOverlay message={txStatus} />}
        <div className="slide-up" style={S.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎲</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>You've been invited to play</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Backgammon Club</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <WalletBtn wallet={walletAddr} onConnect={handleConnect} balance={walletBalance} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Your Name</label>
            <input style={S.input} value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter your name" maxLength={20} onKeyDown={e => e.key === "Enter" && joinLobby()} />
          </div>
          <Btn variant="primary" style={{ width: "100%" }} onClick={joinLobby}>Join Game</Btn>
          {error && <div className="fade-in" style={{ color: "var(--red)", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</div>}
        </div>
      </div>
    );
  }
 
  // ═══════════════════════════════════════════════════════════════
  // HOME
  // ═══════════════════════════════════════════════════════════════
  if (screen === "home") {
    return (
      <div style={S.page}>
        {txStatus && <TxOverlay message={txStatus} />}
        <div className="slide-up" style={S.card}>
          {hasActiveSession && (
            <div style={{ background: "var(--felt-dark)", borderRadius: 4, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--green)", gap: 8 }}>
              <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 500 }}>You have an active game</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn variant="primary" style={{ fontSize: 11, padding: "5px 12px" }} onClick={returnToGame}>Return</Btn>
                <Btn variant="ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={abandonGame}>Abandon</Btn>
              </div>
            </div>
          )}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎲</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Backgammon Club</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>No signup · No download · Play for SOL</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <WalletBtn wallet={walletAddr} onConnect={handleConnect} balance={walletBalance} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Your Name</label>
            <input style={S.input} value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter your name" maxLength={20} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Wager per Point</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["0", "0.01", "0.05", "0.1", "0.5"].map(v => <Btn key={v} variant={wagerAmount === v ? "accent" : "ghost"} onClick={() => setWagerAmount(v)} style={{ flex: 1, padding: "8px 0", fontSize: 12 }}>{v === "0" ? "Free" : v + "◎"}</Btn>)}
            </div>
            <input style={{ ...S.input, marginTop: 8 }} value={wagerAmount} onChange={e => setWagerAmount(e.target.value)} placeholder="Custom amount" type="number" step="0.001" min="0" />
          </div>
          <Btn variant="primary" style={{ width: "100%", marginBottom: 14 }} onClick={createLobby}>
            Create Lobby{parseFloat(wagerAmount) > 0 ? ` · ${wagerAmount} SOL` : ""}
          </Btn>
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: "14px 0 10px", borderTop: "1px solid var(--card-border)", paddingTop: 14 }}>or join an existing game</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...S.input, flex: 1 }} value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Lobby code" onKeyDown={e => e.key === "Enter" && joinLobby()} />
            <Btn variant="default" onClick={joinLobby}>Join</Btn>
          </div>
          {error && <div className="fade-in" style={{ color: "var(--red)", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</div>}
 
          {/* Lobby Browser */}
          <div style={{ marginTop: 18, borderTop: "1px solid var(--card-border)", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Open Games</span>
              <Btn variant="ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={fetchLobbies}>Refresh</Btn>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <Btn variant={browserFilter === "joinable" ? "accent" : "ghost"} style={{ flex: 1, fontSize: 11, padding: "6px 0" }} onClick={() => setBrowserFilter("joinable")}>Joinable</Btn>
              <Btn variant={browserFilter === "all" ? "accent" : "ghost"} style={{ flex: 1, fontSize: 11, padding: "6px 0" }} onClick={() => setBrowserFilter("all")}>All</Btn>
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", background: "var(--bg)", borderRadius: 4, border: "1px solid var(--card-border)" }}>
              {publicLobbies.filter(l => browserFilter === "all" || l.joinable).length === 0 ? (
                <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  {publicLobbies.length === 0 ? "Click Refresh to load games" : "No games found"}
                </div>
              ) : publicLobbies.filter(l => browserFilter === "all" || l.joinable).map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--card-border)", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 500 }}>{l.host}{l.guest ? ` vs ${l.guest}` : ""}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {l.wagerPerPoint > 0 ? <span style={{ color: "var(--sol)" }}>{l.wagerPerPoint}◎/pt</span> : "Free"}
                      {" · "}{l.status === "finished"
                        ? <span style={{ color: "var(--accent)" }}>{l.winner} won{l.winPoints ? ` ${l.winPoints}pt` : ""}{l.payout ? ` · ${l.payout.toFixed(4)}◎` : ""}</span>
                        : l.status === "waiting" ? "Waiting" : l.status === "playing" ? "In progress" : l.status}
                    </div>
                  </div>
                  {l.joinable && <Btn variant="primary" style={{ fontSize: 11, padding: "5px 12px", whiteSpace: "nowrap" }} onClick={() => handleBrowserJoin(l.id)}>Join</Btn>}
                  {!l.joinable && l.status !== "finished" && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Full</span>}
                  {l.status === "finished" && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Done</span>}
                </div>
              ))}
            </div>
          </div>
 
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--felt-dark)", borderRadius: 4, color: "var(--text-muted)", fontSize: 11, lineHeight: 1.5 }}>
            Standard backgammon rules. Doubling cube with beaver. Winner takes the pot (0.5% fee).
          </div>
        </div>
      </div>
    );
  }
 
  // ═══════════════════════════════════════════════════════════════
  // LOBBY
  // ═══════════════════════════════════════════════════════════════
  if (screen === "lobby") {
    return (
      <div style={S.page}>
        {txStatus && <TxOverlay message={txStatus} />}
        <div className="slide-up" style={{ ...S.card, maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 16 }}>Waiting for opponent</div>
          <div style={{ background: "var(--felt-dark)", borderRadius: 4, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 6 }}>Send this link:</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, background: "var(--bg)", padding: "8px 10px", borderRadius: 4, fontSize: 11, color: "var(--accent)", wordBreak: "break-all", border: "1px solid var(--card-border)" }}>{`${window.location.origin}?join=${lobbyId}`}</code>
              <Btn variant="default" onClick={copyLink} style={{ fontSize: 12, padding: "8px 12px", whiteSpace: "nowrap" }}>{copied ? "Copied!" : "Copy"}</Btn>
            </div>
            {wagerPP > 0 && <div style={{ color: "var(--sol)", fontSize: 13, fontWeight: 600, marginTop: 8 }}>◎ {wagerPP} SOL/pt · Pot: {(lobby?.totalPot || 0).toFixed(4)} SOL</div>}
            {!wagerPP && <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Free game</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginBottom: 16 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 24 }}>⚪</div><div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{hostName}</div></div>
            <div style={{ color: "var(--text-muted)", fontSize: 18 }}>vs</div>
            <div style={{ textAlign: "center", opacity: lobby?.guest ? 1 : .3 }}><div style={{ fontSize: 24 }}>⚫</div><div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{guestName}</div></div>
          </div>
          {myColor === W && <Btn variant="primary" style={{ width: "100%" }} onClick={startGame} disabled={!lobby?.guest}>{lobby?.guest ? "Start Game" : "Waiting..."}</Btn>}
          {myColor === B && !game && <div style={{ color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>Waiting for host to start...</div>}
          <Btn variant="ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={goHome}>Leave Lobby</Btn>
          {error && <div className="fade-in" style={{ color: "var(--red)", fontSize: 13, textAlign: "center", marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    );
  }
 
  // ═══════════════════════════════════════════════════════════════
  // GAME
  // ═══════════════════════════════════════════════════════════════
  if (!game) return <div style={S.page}><div className="fade-in" style={{ color: "var(--text-muted)" }}>Loading...</div></div>;
 
  const offW = gbo(currentBoard.board, currentBoard.barW, currentBoard.barB, W);
  const offB = gbo(currentBoard.board, currentBoard.barW, currentBoard.barB, B);
  const canDbl = isMyTurn && game.phase === "move" && pendingMoves.length === 0 && !awaitingConfirm && (game.cubeOwner === 0 || game.cubeOwner === myColor);
 
  return (
    <div style={{ ...S.page, justifyContent: "flex-start", paddingTop: 12 }}>
      {txStatus && <TxOverlay message={txStatus} />}
      {doublingDialog && <DoublingDialog type={doublingDialog.type} cubeValue={game.cubeValue} onAccept={b => handleDoubleResponse(true, b)} onReject={() => handleDoubleResponse(false)} playerName={doublingDialog.from === W ? hostName : guestName} wagerPerPoint={wagerPP} />}
      {awaitingConfirm && <ConfirmMoveModal onConfirm={() => submitMoves(pendingMoves)} onUndo={undoAll} />}
 
      {/* Your Turn toast */}
      {turnToast && <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 150, pointerEvents: "none", animation: "toastIn 2s ease both" }}>
        <div style={{ background: "var(--green)", color: "#fff", padding: "10px 28px", borderRadius: 6, fontSize: 16, fontWeight: 700, letterSpacing: ".02em", boxShadow: "0 4px 20px rgba(39,174,96,.4)" }}>Your Turn</div>
      </div>}
 
      {/* Forfeit Confirm */}
      {forfeitConfirm && <div className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
        <div className="pop-in" style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "28px 36px", textAlign: "center", maxWidth: 340 }}>
          <div style={{ fontSize: 15, color: "var(--text)", marginBottom: 8, fontWeight: 600 }}>Forfeit this game?</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Your opponent wins the current cube value{wagerPP > 0 ? ` and the pot (${(lobby?.totalPot || 0).toFixed(4)} SOL)` : ""}.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Btn variant="ghost" onClick={() => setForfeitConfirm(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={forfeitGame}>Forfeit</Btn>
          </div>
        </div>
      </div>}
 
      {/* Scoreboard */}
      <div className="fade-in" style={{ maxWidth: 820, width: "100%", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card)", borderRadius: 6, padding: "8px 16px", border: "1px solid var(--card-border)", ...(isMyTurn ? { boxShadow: "0 0 12px rgba(200,170,110,.15)" } : {}) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚪</span>
            <div><div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{hostName}</div>{game.turn === W && <div style={{ color: "var(--green)", fontSize: 10, fontWeight: 600 }}>PLAYING</div>}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)" }}>{matchScore.w} – {matchScore.b}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 10 }}>Cube {game.cubeValue}×{wagerPP > 0 ? ` · Pot ${(lobby?.totalPot || 0).toFixed(3)}◎` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right" }}><div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{guestName}</div>{game.turn === B && <div style={{ color: "var(--green)", fontSize: 10, fontWeight: 600 }}>PLAYING</div>}</div>
            <span style={{ fontSize: 16 }}>⚫</span>
          </div>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", marginTop: 3 }}>{game.lastAction}</div>
        {lobby?.payoutSignature && <div style={{ color: "var(--green)", fontSize: 11, textAlign: "center", marginTop: 2 }}>Payout sent ✓</div>}
      </div>
 
      <DiceDisplay dice={game.dice} usedDice={pendingMoves.map(m => m.die)} diceKey={diceKey} />
 
      <div style={{ position: "relative", width: "100%", maxWidth: 820 }}>
        {showFireworks && game.phase === "gameover" && <Fireworks />}
        <BoardSVG board={currentBoard.board} barW={currentBoard.barW} barB={currentBoard.barB} selectedPoint={selectedPoint} validDestinations={validDestinations} onPointClick={handlePointClick} onBarClick={handleBarClick} playerColor={myColor} cubeValue={game.cubeValue} cubeOwner={game.cubeOwner} offW={offW} offB={offB} />
      </div>
 
      {/* Controls */}
      <div className="fade-in" style={{ maxWidth: 820, width: "100%", marginTop: 8, textAlign: "center" }}>
        {game.phase === "gameover" ? (
          <div>
            <div style={{ color: "var(--accent)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{game.winner === W ? hostName : guestName} wins {game.winPoints}pt{game.winPoints > 1 ? "s" : ""}!</div>
            {wagerPP > 0 && <div style={{ color: "var(--sol)", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Payout: {(lobby?.totalPot || 0).toFixed(4)} SOL</div>}
            {myColor === W && <Btn variant="primary" onClick={startGame}>New Game</Btn>}
          </div>
        ) : game.phase === "double" ? (
          <div style={{ color: "var(--accent)", animation: "pulse 2s ease-in-out infinite" }}>Doubling in progress...</div>
        ) : isMyTurn && !awaitingConfirm ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {canDbl && <Btn variant="accent" onClick={handleDouble}>Double ({game.cubeValue}→{game.cubeValue * 2}){wagerPP > 0 ? ` · ${(game.cubeValue * wagerPP).toFixed(3)}◎` : ""}</Btn>}
            {pendingMoves.length > 0 && <Btn variant="ghost" onClick={undoLast}>Undo</Btn>}
            {maxMoves === 0 && pendingMoves.length === 0 && <Btn variant="primary" onClick={() => submitMoves([])}>No Moves — Pass</Btn>}
          </div>
        ) : !awaitingConfirm ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, animation: "pulse 2s ease-in-out infinite" }}>Waiting for {game.turn === W ? hostName : guestName}...</div>
        ) : null}
      </div>
 
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 11, marginTop: 6 }}>
        You are {myColor === W ? "⚪ White" : "⚫ Black"}{walletAddr && <span> · <span style={{ color: "var(--sol)" }}>{walletAddr.slice(0, 4)}...{walletAddr.slice(-4)}</span></span>}
      </div>
      {game.phase !== "gameover" && <div style={{ textAlign: "center", marginTop: 8 }}>
        <Btn variant="ghost" style={{ fontSize: 11, padding: "6px 14px", opacity: .6 }} onClick={() => setForfeitConfirm(true)}>Forfeit</Btn>
      </div>}
      {game.phase === "gameover" && <div style={{ textAlign: "center", marginTop: 8 }}>
        <Btn variant="ghost" style={{ fontSize: 11, padding: "6px 14px" }} onClick={abandonGame}>Leave</Btn>
      </div>}
    </div>
  );
}
 
// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const S = {
  page: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", fontFamily: "'Inter',system-ui,sans-serif" },
  card: { background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8, padding: "28px 28px", maxWidth: 400, width: "100%" },
  label: { display: "block", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 },
  input: { width: "100%", padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: 4, color: "var(--text)", fontSize: 14, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box", transition: "border .2s" },