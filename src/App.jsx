import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC || "https://api.mainnet-beta.solana.com";

// ═══════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PHANTOM WALLET
// ═══════════════════════════════════════════════════════════════
function getPhantomProvider() {
  if (typeof window !== "undefined") {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
  }
  return null;
}

async function connectPhantom() {
  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not found. Install the Phantom browser extension.");
  const resp = await provider.connect();
  return { provider, publicKey: resp.publicKey.toString() };
}

/**
 * Build and sign a SOL transfer to the house wallet.
 * Returns the tx signature string — does NOT verify or manage game state.
 */
async function signPayment(provider, housePublicKey, amountSol) {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const fromPubkey = provider.publicKey;
  const toPubkey = new PublicKey(housePublicKey);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const { signature } = await provider.signAndSendTransaction(transaction);
  return signature;
}

async function getBalance(pubkeyStr) {
  try {
    const connection = new Connection(HELIUS_RPC, "confirmed");
    const balance = await connection.getBalance(new PublicKey(pubkeyStr));
    return balance / LAMPORTS_PER_SOL;
  } catch { return 0; }
}


// ═══════════════════════════════════════════════════════════════
// GAME CONSTANTS (client-side for rendering/move preview only)
// ═══════════════════════════════════════════════════════════════
const CHECKERS_PER_PLAYER = 15, BAR = "bar", OFF = "off", WHITE = 1, BLACK = -1;
const INITIAL_BOARD = () => { const b = new Array(24).fill(0); b[0]=2;b[5]=-5;b[7]=-3;b[11]=5;b[12]=-5;b[16]=3;b[18]=5;b[23]=-2; return b; };
const rollDie = () => Math.floor(Math.random()*6)+1;

// Client-side move validation (for preview only — server re-validates everything)
function getValidMoves(board,barW,barB,player,dice){const m=[];findMoves(board,barW,barB,player,[...dice],[],m,new Set());return m}
function findMoves(board,barW,barB,player,rd,cm,am,seen){if(rd.length===0){const k=JSON.stringify(cm);if(!seen.has(k)){seen.add(k);am.push([...cm])}return}let f=false;for(let di=0;di<rd.length;di++){const die=rd[di];const sources=getSources(board,barW,barB,player);for(const src of sources){const dest=getDestination(src,die,player);if(dest===null)continue;if(!isValidMove(board,barW,barB,player,src,dest,die))continue;f=true;const[nb,nW,nB,hit]=applyMove(board,barW,barB,player,src,dest);const nd=[...rd];nd.splice(di,1);findMoves(nb,nW,nB,player,nd,[...cm,{from:src,to:dest,die,hit}],am,seen)}}if(!f&&cm.length>0){const k=JSON.stringify(cm);if(!seen.has(k)){seen.add(k);am.push([...cm])}}}
function getSources(board,barW,barB,player){const bar=player===WHITE?barW:barB;if(bar>0)return[BAR];const s=[];for(let i=0;i<24;i++){if((player===WHITE&&board[i]>0)||(player===BLACK&&board[i]<0))s.push(i)}return s}
function getDestination(src,die,player){if(src===BAR)return player===WHITE?24-die:die-1;const d=player===WHITE?src-die:src+die;if(d<0||d>23)return OFF;return d}
function canBearOff(board,player){for(let i=0;i<24;i++){if(player===WHITE&&board[i]>0&&i>5)return false;if(player===BLACK&&board[i]<0&&i<18)return false}return true}
function isValidMove(board,barW,barB,player,src,dest,die){const bar=player===WHITE?barW:barB;if(src===BAR&&bar===0)return false;if(src!==BAR&&bar>0)return false;if(src!==BAR){if(player===WHITE&&board[src]<=0)return false;if(player===BLACK&&board[src]>=0)return false}if(dest===OFF){if(!canBearOff(board,player))return false;if(src!==BAR){const ed=player===WHITE?src-die:src+die;if(ed<0||ed>23){if(player===WHITE){for(let i=src+1;i<=5;i++)if(board[i]>0)return false}else{for(let i=src-1;i>=18;i--)if(board[i]<0)return false}}}return true}if(player===WHITE&&board[dest]<-1)return false;if(player===BLACK&&board[dest]>1)return false;return true}
function applyMove(board,barW,barB,player,src,dest){const nb=[...board];let nW=barW,nB=barB,hit=false;if(src===BAR){if(player===WHITE)nW--;else nB--}else{nb[src]+=player===WHITE?-1:1}if(dest!==OFF){if(player===WHITE&&nb[dest]===-1){nb[dest]=0;nB++;hit=true}else if(player===BLACK&&nb[dest]===1){nb[dest]=0;nW++;hit=true}nb[dest]+=player===WHITE?1:-1}return[nb,nW,nB,hit]}
function getBorneOff(board,barW,barB,player){let on=player===WHITE?barW:barB;for(let i=0;i<24;i++){if(player===WHITE&&board[i]>0)on+=board[i];if(player===BLACK&&board[i]<0)on+=Math.abs(board[i])}return CHECKERS_PER_PLAYER-on}
function getMaxMoves(vm){if(vm.length===0)return 0;return Math.max(...vm.map(m=>m.length))}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════
const ANIM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
@keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideDown{from{opacity:0;transform:translateY(-30px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes softPulse{0%,100%{opacity:0.6}50%{opacity:1}}
@keyframes diceBounce{0%{transform:translateY(-20px) rotate(-10deg);opacity:0}40%{transform:translateY(4px) rotate(3deg);opacity:1}60%{transform:translateY(-6px) rotate(-1deg)}80%{transform:translateY(2px) rotate(0.5deg)}100%{transform:translateY(0) rotate(0deg);opacity:1}}
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes glowPulse{0%,100%{filter:drop-shadow(0 0 4px rgba(240,192,64,0.3))}50%{filter:drop-shadow(0 0 12px rgba(240,192,64,0.7))}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes spinIn{from{transform:rotate(-180deg) scale(0);opacity:0}to{transform:rotate(0deg) scale(1);opacity:1}}
@keyframes firework{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--fx),var(--fy)) scale(0);opacity:0}}
@keyframes winBanner{0%{transform:scale(0.5) rotateX(40deg);opacity:0}60%{transform:scale(1.08) rotateX(-5deg);opacity:1}100%{transform:scale(1) rotateX(0deg);opacity:1}}
@keyframes turnGlow{0%,100%{box-shadow:0 0 8px rgba(240,192,64,0.15),0 4px 20px rgba(0,0,0,0.3)}50%{box-shadow:0 0 24px rgba(240,192,64,0.35),0 4px 20px rgba(0,0,0,0.3)}}
@keyframes bgShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes solPulse{0%,100%{text-shadow:0 0 4px rgba(153,69,255,0.3)}50%{text-shadow:0 0 12px rgba(153,69,255,0.7)}}
@keyframes txSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.bg-animate{background-size:400% 400%;animation:bgShift 20s ease infinite}
.fade-in-up{animation:fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both}
.fade-in{animation:fadeIn 0.4s ease both}
.slide-down{animation:slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1) both}
.dice-bounce{animation:diceBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both}
.glow-pulse{animation:glowPulse 2s ease-in-out infinite}
.spin-in{animation:spinIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both}
.win-banner{animation:winBanner 0.6s cubic-bezier(0.34,1.56,0.64,1) both}
.turn-glow{animation:turnGlow 2s ease-in-out infinite}
.float-anim{animation:float 3s ease-in-out infinite}
.sol-pulse{animation:solPulse 2s ease-in-out infinite}
.tx-spin{animation:txSpin 1s linear infinite}
.shimmer-text{background:linear-gradient(90deg,#e8d4a0,#f0c040,#e8d4a0);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite}
.btn-hover{transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)}
.btn-hover:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.3);filter:brightness(1.15)}
.btn-hover:active{transform:translateY(0) scale(0.97)}
.input-focus:focus{border-color:#f0c040 !important;box-shadow:0 0 0 3px rgba(240,192,64,0.15)}
.card-hover{transition:transform 0.3s ease,box-shadow 0.3s ease}
.card-hover:hover{transform:translateY(-2px);box-shadow:0 24px 64px rgba(0,0,0,0.5)}
`;

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS (Fireworks, Dice, TxOverlay, WalletButton, BoardSVG, DoublingDialog)
// Same as previous version — rendering only, no payment logic
// ═══════════════════════════════════════════════════════════════
function Fireworks(){const p=useMemo(()=>{const a=[];for(let i=0;i<48;i++){const ang=(Math.PI*2*i)/48+(Math.random()-0.5)*0.5;const d=60+Math.random()*160;a.push({fx:Math.cos(ang)*d,fy:Math.sin(ang)*d,color:['#f0c040','#e85050','#40c0f0','#60e060','#f080d0','#9945FF'][Math.floor(Math.random()*6)],size:4+Math.random()*7,delay:Math.random()*0.4,dur:0.8+Math.random()*0.6})}return a},[]);return<div style={{position:"absolute",top:"50%",left:"50%",pointerEvents:"none",zIndex:10}}>{p.map((p,i)=><div key={i} style={{position:"absolute",width:p.size,height:p.size,borderRadius:"50%",background:p.color,boxShadow:`0 0 8px ${p.color}`,'--fx':`${p.fx}px`,'--fy':`${p.fy}px`,animation:`firework ${p.dur}s ${p.delay}s cubic-bezier(0.16,1,0.3,1) both`}}/>)}</div>}
function DiceDisplay({dice,usedMoves,diceKey}){if(!dice||dice.length===0)return null;return<div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:10}}>{dice.map((d,i)=>{const used=i<usedMoves;return<div key={`${diceKey}-${i}`} className={used?"":"dice-bounce"} style={{width:48,height:48,background:used?"#14202e":"linear-gradient(145deg,#faf3e0,#e8d4a0)",border:used?"1px solid #2a3f52":"2px solid #c4a060",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,fontFamily:"'Playfair Display',Georgia,serif",color:used?"#3a4a5a":"#1a1a1a",opacity:used?0.35:1,animationDelay:`${i*0.12}s`,boxShadow:used?"none":"0 4px 16px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.3)",transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>{d}</div>})}</div>}
function TxOverlay({message}){return<div className="fade-in" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}><div className="slide-down" style={{background:"linear-gradient(160deg,#1e2d3d,#162030)",border:"1px solid #3a5060",borderRadius:16,padding:"40px 48px",textAlign:"center",maxWidth:420,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}><div className="tx-spin" style={{width:48,height:48,border:"3px solid #2a3f52",borderTopColor:"#9945FF",borderRadius:"50%",margin:"0 auto 20px"}}/><p style={{color:"#e8d4a0",fontSize:16,fontWeight:600,margin:"0 0 8px",fontFamily:"'Playfair Display',serif"}}>{message}</p><p style={{color:"#556677",fontSize:13,margin:0}}>Please confirm in your Phantom wallet...</p></div></div>}
function WalletButton({wallet,onConnect,balance}){if(wallet){const short=wallet.slice(0,4)+"..."+wallet.slice(-4);return<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"#0d1520",borderRadius:10,border:"1px solid #2a3f52"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#14F195"}}/><span style={{color:"#9945FF",fontSize:13,fontWeight:600,fontFamily:"monospace"}}>{short}</span>{balance!==null&&<span style={{color:"#556677",fontSize:12}}>{balance.toFixed(4)} SOL</span>}</div>}return<button className="btn-hover" onClick={onConnect} style={{...S.btn,background:"linear-gradient(135deg,#9945FF,#7B3FE4)",color:"#fff",fontSize:13,padding:"10px 20px",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>👻</span> Connect Phantom</button>}

function BoardSVG({board,barW,barB,selectedPoint,validDestinations,onPointClick,onBarClick,playerColor,flipped,cubeValue,cubeOwner,offW,offB}){const W=860,H=600,M=36,BW=42,PW=(W-M*2-BW)/12,PH=240,CR=Math.min(PW*0.44,24),wC="#f0e6d2",bC="#2a2a2a";const vo=flipped?[12,13,14,15,16,17,null,18,19,20,21,22,23]:[11,10,9,8,7,6,null,5,4,3,2,1,0],vob=flipped?[11,10,9,8,7,6,null,5,4,3,2,1,0]:[12,13,14,15,16,17,null,18,19,20,21,22,23];function gpx(vi){return vi<6?M+vi*PW+PW/2:M+6*PW+BW+(vi-6)*PW+PW/2}
function dp(idx,vi,top){const x=gpx(vi),y=top?M:H-M,dir=top?1:-1,isSel=selectedPoint===idx,isVal=validDestinations.includes(idx),fb=idx%2===0?"#b8895a":"#6e5438",pts=`${x-PW/2+3},${y} ${x},${y+dir*PH} ${x+PW/2-3},${y}`,ry=top?M:H-M-PH;return<g key={`p-${idx}`} onClick={()=>onPointClick(idx)} style={{cursor:"pointer"}}><rect x={x-PW/2} y={ry} width={PW} height={PH} fill="transparent"/><polygon points={pts} fill={isVal?"rgba(100,220,120,0.3)":fb} opacity={0.85}>{isSel&&<animate attributeName="opacity" values="0.7;1;0.7" dur="1.2s" repeatCount="indefinite"/>}</polygon>{isSel&&<polygon points={pts} fill="none" stroke="#f0c040" strokeWidth={2.5}><animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/></polygon>}{isVal&&<circle cx={x} cy={y+dir*(CR+Math.abs(board[idx])*CR*1.85)} r={CR*0.5} fill="rgba(100,220,120,0.4)" stroke="#6c6" strokeWidth={1.5}><animate attributeName="r" values={`${CR*0.4};${CR*0.7};${CR*0.4}`} dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.5s" repeatCount="indefinite"/></circle>}{dck(board[idx],x,y,dir,idx)}<text x={x} y={top?M-8:H-M+16} textAnchor="middle" fill="#4a5a6a" fontSize="9" fontFamily="'DM Sans',sans-serif" fontWeight="500">{flipped?(top?idx+1:25-idx):(top?25-idx:idx+1)}</text></g>}
function dck(count,cx,by,dir,pi){if(count===0)return null;const isW=count>0,col=isW?wC:bC,st=isW?"#c4a882":"#555",n=Math.abs(count),items=[],ms=5,isSel=selectedPoint===pi;for(let i=0;i<Math.min(n,ms);i++){const cy=by+dir*(CR+i*CR*1.85),isTop=i===Math.min(n,ms)-1;items.push(<g key={i} style={isSel&&isTop?{filter:"drop-shadow(0 0 10px rgba(240,192,64,0.6))"}:{}}><ellipse cx={cx+1} cy={cy+2} rx={CR} ry={CR*0.25} fill="rgba(0,0,0,0.12)"/><circle cx={cx} cy={cy} r={CR} fill={col} stroke={st} strokeWidth={1.5}>{isSel&&isTop&&<animate attributeName="r" values={`${CR};${CR+1.5};${CR}`} dur="0.8s" repeatCount="indefinite"/>}</circle><circle cx={cx} cy={cy} r={CR-2} fill="none" stroke={isW?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.06)"} strokeWidth={1}/>{isW&&<circle cx={cx} cy={cy} r={CR*0.55} fill="none" stroke={st} strokeWidth={0.8} opacity={0.35}/>}<circle cx={cx-CR*0.25} cy={cy-CR*0.25} r={CR*0.13} fill={isW?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.08)"}/>{isSel&&isTop&&<circle cx={cx} cy={cy} r={CR+4} fill="none" stroke="#f0c040" strokeWidth={2}><animate attributeName="r" values={`${CR+3};${CR+7};${CR+3}`} dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite"/></circle>}</g>)}if(n>ms){const cy=by+dir*(CR+(ms-1)*CR*1.85);items.push(<text key="c" x={cx} y={cy+5} textAnchor="middle" fill={isW?"#333":"#ddd"} fontSize="13" fontWeight="bold">{n}</text>)}return items}
function drawBar(){const bx=M+6*PW,items=[];for(let i=0;i<barW;i++)items.push(<circle key={`bw-${i}`} cx={bx+BW/2} cy={H/2+40+i*28} r={CR*0.9} fill={wC} stroke="#c4a882" strokeWidth={1.5} onClick={()=>onBarClick(WHITE)} style={{cursor:"pointer"}}/>);for(let i=0;i<barB;i++)items.push(<circle key={`bb-${i}`} cx={bx+BW/2} cy={H/2-40-i*28} r={CR*0.9} fill={bC} stroke="#555" strokeWidth={1.5} onClick={()=>onBarClick(BLACK)} style={{cursor:"pointer"}}/>);return items}
function drawOff(){const items=[],ox=W-22;for(let i=0;i<offW;i++)items.push(<rect key={`ow-${i}`} x={ox-12} y={H-M-8-i*9} width={24} height={7} rx={2} fill={wC} stroke="#c4a882" strokeWidth={0.5} opacity={0} style={{animation:`fadeIn 0.3s ${i*0.04}s both`}}/>);for(let i=0;i<offB;i++)items.push(<rect key={`ob-${i}`} x={ox-12} y={M+i*9} width={24} height={7} rx={2} fill={bC} stroke="#555" strokeWidth={0.5} opacity={0} style={{animation:`fadeIn 0.3s ${i*0.04}s both`}}/>);if(validDestinations.includes(OFF)){const oy=playerColor===WHITE?H-M-140:M;items.push(<g key="off" onClick={()=>onPointClick(OFF)} style={{cursor:"pointer"}}><rect x={ox-18} y={oy} width={36} height={140} rx={6} fill="rgba(100,220,120,0.2)" stroke="#6c6" strokeWidth={2} strokeDasharray="6 4"><animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/></rect><text x={ox} y={oy+75} textAnchor="middle" fill="#6c6" fontSize="11" fontWeight="600">OFF</text></g>)}return items}
function drawCube(){let cx,cy;if(cubeOwner===0){cx=M+6*PW+BW/2;cy=H/2}else if(cubeOwner===WHITE){cx=16;cy=H-M-60}else{cx=16;cy=M+60}return<g className="glow-pulse"><rect x={cx-16} y={cy-16} width={32} height={32} rx={5} fill="#2c1810" stroke="#aa8844" strokeWidth={1.5}/><text x={cx} y={cy+6} textAnchor="middle" fill="#e8d4a0" fontSize="15" fontWeight="bold" fontFamily="'Playfair Display',Georgia,serif">{cubeValue}</text></g>}
return<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:920,display:"block",margin:"0 auto",filter:"drop-shadow(0 8px 32px rgba(0,0,0,0.4))"}}><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1e2d3d"/><stop offset="100%" stopColor="#162030"/></linearGradient><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a3f52"/><stop offset="100%" stopColor="#1e3040"/></linearGradient><linearGradient id="br" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14202e"/><stop offset="100%" stopColor="#0f1820"/></linearGradient></defs><rect x={0} y={0} width={W} height={H} rx={14} fill="url(#bg)"/><rect x={M-6} y={M-6} width={W-M*2+12} height={H-M*2+12} rx={6} fill="none" stroke="#3a5060" strokeWidth={1} opacity={0.4}/><rect x={M-2} y={M-2} width={W-M*2+4} height={H-M*2+4} rx={4} fill="url(#fg)" stroke="#2a4050" strokeWidth={1}/><rect x={M+6*PW} y={M-2} width={BW} height={H-M*2+4} fill="url(#br)"/><line x1={M} y1={H/2} x2={M+6*PW} y2={H/2} stroke="#2a3a4a" strokeWidth={0.5} opacity={0.3}/><line x1={M+6*PW+BW} y1={H/2} x2={W-M} y2={H/2} stroke="#2a3a4a" strokeWidth={0.5} opacity={0.3}/>{vo.filter(x=>x!==null).map((idx,vi)=>dp(idx,vi,true))}{vob.filter(x=>x!==null).map((idx,vi)=>dp(idx,vi,false))}{drawBar()}{drawOff()}{drawCube()}</svg>}

function DoublingDialog({type,cubeValue,onAccept,onReject,playerName,wagerPerPoint}){const newCube=type==="beaver"?cubeValue*4:cubeValue*2;const cost=(newCube-cubeValue)*wagerPerPoint;return<div className="fade-in" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}><div className="slide-down" style={{background:"linear-gradient(160deg,#1e2d3d,#162030)",border:"1px solid #3a5060",borderRadius:16,padding:"36px 44px",textAlign:"center",maxWidth:420,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}><div className="spin-in" style={{fontSize:48,marginBottom:16}}>🎲</div>{type==="double"?<><h3 className="shimmer-text" style={{margin:"0 0 8px",fontFamily:"'Playfair Display',Georgia,serif",fontSize:22}}>{playerName} doubles!</h3><p style={{color:"#8899aa",fontSize:14,margin:"0 0 8px"}}>Stakes raised to <strong style={{color:"#f0c040"}}>{cubeValue*2}</strong> points</p>{wagerPerPoint>0&&<p className="sol-pulse" style={{color:"#9945FF",fontSize:13,margin:"0 0 20px"}}>Accepting costs <strong>{cost.toFixed(4)} SOL</strong></p>}<div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}><button onClick={onReject} className="btn-hover" style={bSt("#8b3030")}>Drop ({cubeValue}pt)</button><button onClick={()=>onAccept(false)} className="btn-hover" style={bSt("#2e6b3e")}>Take{wagerPerPoint>0?` (${cost.toFixed(4)} SOL)`:""}</button><button onClick={()=>onAccept(true)} className="btn-hover" style={bSt("#6b5a2e")}>Beaver!{wagerPerPoint>0?` (${(cost*2).toFixed(4)} SOL)`:""}</button></div></>:<><h3 className="shimmer-text" style={{margin:"0 0 8px",fontFamily:"'Playfair Display',Georgia,serif",fontSize:22}}>{playerName} beavers!</h3><p style={{color:"#8899aa",fontSize:14,margin:"0 0 8px"}}>Stakes now <strong style={{color:"#f0c040"}}>{newCube}</strong> points.</p>{wagerPerPoint>0&&<p className="sol-pulse" style={{color:"#9945FF",fontSize:13,margin:"0 0 20px"}}>Accepting costs <strong>{cost.toFixed(4)} SOL</strong></p>}<div style={{display:"flex",gap:12,justifyContent:"center"}}><button onClick={onReject} className="btn-hover" style={bSt("#8b3030")}>Drop ({newCube/2}pt)</button><button onClick={()=>onAccept(false)} className="btn-hover" style={bSt("#2e6b3e")}>Accept{wagerPerPoint>0?` (${cost.toFixed(4)} SOL)`:""}</button></div></>}</div></div>}
const bSt=(bg)=>({background:bg,color:"#f0e6d2",border:"none",borderRadius:10,padding:"11px 22px",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"});


// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [lobbyId, setLobbyId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [wagerAmount, setWagerAmount] = useState("0.05");
  const [error, setError] = useState("");
  const [lobby, setLobby] = useState(null); // full lobby state from server
  const [myColor, setMyColor] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [validDestinations, setValidDestinations] = useState([]);
  const [pendingMoves, setPendingMoves] = useState([]);
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
  const [housePublicKey, setHousePublicKey] = useState(null);

  useEffect(() => {
    if (!document.getElementById('bg-anims')) {
      const s = document.createElement('style'); s.id = 'bg-anims'; s.textContent = ANIM_CSS; document.head.appendChild(s);
    }
    // Fetch house wallet pubkey from server
    api("/house").then(d => setHousePublicKey(d.publicKey)).catch(() => {});
  }, []);

  useEffect(() => {
    const p = getPhantomProvider();
    if (p && p.isConnected && p.publicKey) {
      setPhantomProvider(p); setWalletAddr(p.publicKey.toString());
      getBalance(p.publicKey.toString()).then(b => setWalletBalance(b)).catch(() => {});
    }
  }, []);

  async function handleConnectWallet() {
    try {
      const { provider, publicKey } = await connectPhantom();
      setPhantomProvider(provider); setWalletAddr(publicKey); setError("");
      setWalletBalance(await getBalance(publicKey));
    } catch (e) { setError(e.message); }
  }

  async function refreshBalance() {
    if (walletAddr) { try { setWalletBalance(await getBalance(walletAddr)); } catch {} }
  }

  // ── Pay + call server ──
  async function payAndCall(amountSol, apiPath, bodyWithoutSig) {
    let txSignature = null;
    if (amountSol > 0) {
      if (!housePublicKey) throw new Error("Server not reachable");
      if (!phantomProvider) throw new Error("Wallet not connected");
      setTxStatus(`Sending ${amountSol} SOL...`);
      try {
        txSignature = await signPayment(phantomProvider, housePublicKey, amountSol);
      } catch (e) {
        setTxStatus(null);
        throw new Error("Wallet transaction failed: " + e.message);
      }
      setTxStatus("Verifying payment on-chain...");
    }
    try {
      const result = await api(apiPath, {
        method: "POST",
        body: { ...bodyWithoutSig, txSignature },
      });
      setTxStatus(null);
      await refreshBalance();
      return result;
    } catch (e) {
      setTxStatus(null);
      throw e;
    }
  }

  // ── Lobby ──
  async function createLobby() {
    if (!nameInput.trim()) { setError("Enter a name"); return; }
    const wager = parseFloat(wagerAmount) || 0;
    if (wager > 0 && !walletAddr) { setError("Connect Phantom wallet to wager SOL"); return; }
    try {
      const result = await payAndCall(wager, "/lobby/create", {
        playerName: nameInput.trim(), wallet: walletAddr || "", wagerPerPoint: wager,
      });
      setPlayerName(nameInput.trim()); setLobbyId(result.lobbyId);
      setPlayerId(result.playerId); setMyColor(result.color);
      setScreen("lobby"); setError("");
    } catch (e) { setError(e.message); }
  }

  async function joinLobby() {
    if (!nameInput.trim()) { setError("Enter a name"); return; }
    const code = joinCode.trim();
    if (!code) { setError("Enter a lobby code"); return; }
    try {
      // First fetch lobby to see wager amount
      const lobbyData = await api(`/lobby/${code}`);
      const wager = lobbyData.wagerPerPoint || 0;
      if (wager > 0 && !walletAddr) { setError(`Connect Phantom — this lobby requires ${wager} SOL`); return; }

      const result = await payAndCall(wager, `/lobby/${code}/join`, {
        playerName: nameInput.trim(), wallet: walletAddr || "",
      });
      setPlayerName(nameInput.trim()); setLobbyId(code);
      setPlayerId(result.playerId); setMyColor(result.color);
      setScreen("lobby"); setError("");
    } catch (e) { setError(e.message); }
  }

  async function startGame() {
    try {
      const result = await api(`/lobby/${lobbyId}/start`, { method: "POST", body: { playerId } });
      setLobby(result); setDiceKey(k => k + 1); setShowFireworks(false);
    } catch (e) { setError(e.message); }
  }

  // ── Polling ──
  const pollGame = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const data = await api(`/lobby/${lobbyId}`);
      if (data.game && prevTurnRef.current !== null && data.game.turn !== prevTurnRef.current) setDiceKey(k => k + 1);
      if (data.game) prevTurnRef.current = data.game.turn;
      setLobby(data);
      if (data.game?.doublingPending) {
        const dp = data.game.doublingPending;
        if (dp.target === myColor) setDoublingDialog({ type: dp.type, from: dp.from }); else setDoublingDialog(null);
      } else setDoublingDialog(null);
      if (data.game?.phase === "gameover" && !showFireworks) setShowFireworks(true);
      if (data.status === "playing" && screen === "lobby") setScreen("game");
    } catch {}
  }, [lobbyId, myColor, screen, showFireworks]);

  useEffect(() => { if (lobbyId) { pollGame(); pollRef.current = setInterval(pollGame, 1500); return () => clearInterval(pollRef.current); } }, [lobbyId, pollGame]);

  const game = lobby?.game;
  const isMyTurn = game?.turn === myColor;
  const wagerPerPoint = lobby?.wagerPerPoint || 0;
  const hostName = lobby?.host?.name || "Host";
  const guestName = lobby?.guest?.name || "Waiting...";
  const matchScore = lobby?.matchScore || { w: 0, b: 0 };

  // ── Moves (submit to server) ──
  async function submitMoves(moves = pendingMoves) {
    try {
      const result = await api(`/lobby/${lobbyId}/move`, { method: "POST", body: { playerId, moves } });
      setLobby(result);
    } catch (e) { setError(e.message); }
    setPendingMoves([]); setSelectedPoint(null); setValidDestinations([]); setDiceKey(k => k + 1);
  }

  // ── Doubling (pay + submit to server) ──
  async function handleDouble() {
    if (!isMyTurn || game.phase !== "move") return;
    if (game.cubeOwner !== 0 && game.cubeOwner !== myColor) return;
    const cost = game.cubeValue * wagerPerPoint;
    try {
      const result = await payAndCall(cost, `/lobby/${lobbyId}/double`, { playerId });
      setLobby(result);
    } catch (e) { setError(e.message); }
  }

  async function handleDoubleResponse(accept, beaver = false) {
    const dp = game.doublingPending; if (!dp) return;
    const action = !accept ? "drop" : beaver ? "beaver" : "accept";
    const newCube = beaver ? dp.value * 2 : dp.value;
    const cost = accept ? (newCube - game.cubeValue) * wagerPerPoint : 0;
    try {
      const result = await payAndCall(cost, `/lobby/${lobbyId}/double-response`, { playerId, action });
      setLobby(result);
    } catch (e) { setError(e.message); }
    setDoublingDialog(null);
  }

  // ── Client-side move preview ──
  const currentValidMoves = useMemo(() => {
    if (!game || game.phase !== "move" || !isMyTurn) return [];
    const rd = game.dice.slice(pendingMoves.length);
    let b = [...game.board], bw = game.barW, bb = game.barB;
    for (const m of pendingMoves) { [b, bw, bb] = applyMove(b, bw, bb, myColor, m.from, m.to).slice(0, 3); }
    return getValidMoves(b, bw, bb, myColor, rd);
  }, [game, isMyTurn, pendingMoves, myColor]);
  const maxPossibleMoves = useMemo(() => getMaxMoves(currentValidMoves), [currentValidMoves]);
  const currentBoard = useMemo(() => {
    if (!game) return { board: INITIAL_BOARD(), barW: 0, barB: 0 };
    let b = [...game.board], bw = game.barW, bb = game.barB;
    for (const m of pendingMoves) { [b, bw, bb] = applyMove(b, bw, bb, myColor, m.from, m.to).slice(0, 3); }
    return { board: b, barW: bw, barB: bb };
  }, [game, pendingMoves, myColor]);

  function handlePointClick(pi) {
    if (!isMyTurn || game.phase !== "move") return;
    if (selectedPoint !== null && validDestinations.includes(pi)) {
      const die = findDie(selectedPoint, pi);
      const [,,, hit] = applyMove(currentBoard.board, currentBoard.barW, currentBoard.barB, myColor, selectedPoint, pi);
      const np = [...pendingMoves, { from: selectedPoint, to: pi, die, hit }];
      setPendingMoves(np); setSelectedPoint(null); setValidDestinations([]);
      if (game.dice.length - np.length === 0) submitMoves(np);
      return;
    }
    if (selectedPoint === pi) { setSelectedPoint(null); setValidDestinations([]); return; }
    setSelectedPoint(null); setValidDestinations([]);
    const bar = myColor === WHITE ? currentBoard.barW : currentBoard.barB;
    if (pi === BAR || bar > 0) return;
    const piece = currentBoard.board[pi];
    if ((myColor === WHITE && piece <= 0) || (myColor === BLACK && piece >= 0)) return;
    const dests = new Set();
    for (const ms of currentValidMoves) { if (ms.length > pendingMoves.length) { const nm = ms[pendingMoves.length]; if (nm.from === pi) dests.add(nm.to); } }
    if (dests.size === 0) return;
    setSelectedPoint(pi); setValidDestinations([...dests]);
  }
  function handleBarClick(c) {
    if (c !== myColor || !isMyTurn || game.phase !== "move") return;
    const bar = myColor === WHITE ? currentBoard.barW : currentBoard.barB; if (bar === 0) return;
    const dests = new Set();
    for (const ms of currentValidMoves) { if (ms.length > pendingMoves.length) { const nm = ms[pendingMoves.length]; if (nm.from === BAR) dests.add(nm.to); } }
    if (dests.size === 0) return;
    setSelectedPoint(BAR); setValidDestinations([...dests]);
  }
  function findDie(from, to) { for (const ms of currentValidMoves) { if (ms.length > pendingMoves.length) { const m = ms[pendingMoves.length]; if (m.from === from && m.to === to) return m.die; } } return game.dice[pendingMoves.length]; }
  function undoLastMove() { setPendingMoves(p => p.slice(0, -1)); setSelectedPoint(null); setValidDestinations([]); }

  useEffect(() => { if (!isMyTurn || !game || game.phase !== "move") return; const bar = myColor === WHITE ? currentBoard.barW : currentBoard.barB; if (bar > 0 && selectedPoint !== BAR) handleBarClick(myColor); }, [isMyTurn, game?.phase, currentBoard, pendingMoves.length]);
  useEffect(() => { if (!isMyTurn || !game || game.phase !== "move") return; if (pendingMoves.length > 0 && maxPossibleMoves === 0) submitMoves(pendingMoves); }, [maxPossibleMoves, pendingMoves.length]);

  function copyLink() { navigator.clipboard.writeText(lobbyId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }

  const flipped = myColor === BLACK;

  // ═══════════════════════════════════════════════════════════════
  // RENDER — identical layout to before, just backed by server API now
  // ═══════════════════════════════════════════════════════════════
  if (screen === "home") {
    return (
      <div className="bg-animate" style={S.container}>
        {txStatus && <TxOverlay message={txStatus} />}
        <div className="fade-in-up card-hover" style={S.homeCard}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="float-anim" style={{ fontSize: 56, marginBottom: 12 }}>⚫⚪</div>
            <h1 className="shimmer-text" style={{ ...S.title, fontSize: 32 }}>Backgammon Club</h1>
            <p style={S.subtitle}>No signup. No download. Wager SOL against friends.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <WalletButton wallet={walletAddr} onConnect={handleConnectWallet} balance={walletBalance} />
          </div>
          <div style={{ marginBottom: 16 }}><label style={S.label}>Your Name</label><input className="input-focus" style={S.input} value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter your name" maxLength={20} onKeyDown={e => e.key === "Enter" && createLobby()} /></div>
          <div style={{ marginBottom: 20 }}><label style={S.label}>Wager per Point (SOL)</label><div style={{ display: "flex", gap: 8 }}>{["0","0.01","0.05","0.1","0.5"].map(v => <button key={v} className="btn-hover" onClick={() => setWagerAmount(v)} style={{ ...S.btn, ...(wagerAmount === v ? { background: "#9945FF", color: "#fff" } : { background: "#1e2d3d", color: "#7a8a9a", border: "1px solid #2a3f52" }), padding: "8px 14px", fontSize: 13, flex: 1 }}>{v === "0" ? "Free" : v + " ◎"}</button>)}</div><input className="input-focus" style={{ ...S.input, marginTop: 8 }} value={wagerAmount} onChange={e => setWagerAmount(e.target.value)} placeholder="Custom" type="number" step="0.001" min="0" /></div>
          <button className="btn-hover" style={{ ...S.btn, ...S.btnP, width: "100%", marginBottom: 16 }} onClick={createLobby}>Create Lobby{parseFloat(wagerAmount) > 0 ? ` (Pay ${wagerAmount} SOL)` : ""}</button>
          <div style={S.divider}><span style={S.dividerText}>or join a game</span></div>
          <div style={{ marginBottom: 16 }}><label style={S.label}>Lobby Code</label><input className="input-focus" style={S.input} value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Paste lobby code" onKeyDown={e => e.key === "Enter" && joinLobby()} /></div>
          <button className="btn-hover" style={{ ...S.btn, ...S.btnS, width: "100%" }} onClick={joinLobby}>Join Game</button>
          {error && <p className="fade-in" style={S.error}>{error}</p>}
          <div style={S.rules}><strong style={{ color: "#9945FF" }}>How it works:</strong> Players pay wager to a secure house wallet. Server verifies every payment on-chain before updating game state. Winner receives the full pot automatically. 0% commission.</div>
        </div>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div className="bg-animate" style={S.container}>
        {txStatus && <TxOverlay message={txStatus} />}
        <div className="fade-in-up" style={S.homeCard}>
          <h2 className="shimmer-text" style={{ ...S.title, fontSize: 24, textAlign: "center", marginBottom: 20 }}>Lobby</h2>
          <div className="fade-in" style={S.lobbyInfo}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}><span style={{ color: "#8899aa", fontSize: 13 }}>Share code:</span><code style={S.code}>{lobbyId}</code><button onClick={copyLink} className="btn-hover" style={{ ...S.btn, ...S.btnSm, fontSize: 12 }}>{copied ? "Copied!" : "Copy"}</button></div>
            {wagerPerPoint > 0 && <div className="sol-pulse" style={{ color: "#9945FF", fontSize: 14, fontWeight: 600, marginTop: 4 }}>◎ {wagerPerPoint} SOL per point · Pot: {lobby?.totalPot?.toFixed(4) || 0} SOL</div>}
            {wagerPerPoint === 0 && <div style={{ color: "#556677", fontSize: 13 }}>Free game</div>}
          </div>
          <div style={S.playerRow}>
            <div className="fade-in-up" style={{ ...S.playerCard, animationDelay: "0.15s" }}><div className="float-anim" style={{ fontSize: 32 }}>⚪</div><div style={{ color: "#e8d4a0", fontWeight: 600, marginTop: 4 }}>{hostName}</div></div>
            <div className="fade-in" style={{ color: "#3a5060", fontSize: 22, fontFamily: "'Playfair Display',serif" }}>vs</div>
            <div className="fade-in-up" style={{ ...S.playerCard, animationDelay: "0.25s" }}><div className={lobby?.guest ? "float-anim" : ""} style={{ fontSize: 32, opacity: lobby?.guest ? 1 : 0.3 }}>⚫</div><div style={{ color: lobby?.guest ? "#e8d4a0" : "#334455", fontWeight: 600, marginTop: 4 }}>{guestName}</div></div>
          </div>
          {myColor === WHITE && <button className="btn-hover" style={{ ...S.btn, ...S.btnP, width: "100%", marginTop: 24, opacity: lobby?.guest ? 1 : 0.5 }} onClick={startGame} disabled={!lobby?.guest}>{lobby?.guest ? "Start Game" : "Waiting for opponent..."}</button>}
          {myColor === BLACK && !game && <p style={{ color: "#8899aa", textAlign: "center", marginTop: 20, fontSize: 14 }}>Waiting for host to start...</p>}
          {error && <p className="fade-in" style={S.error}>{error}</p>}
        </div>
      </div>
    );
  }

  if (!game) return <div style={S.container}><p className="fade-in" style={{ color: "#8899aa" }}>Loading...</p></div>;
  const offW = getBorneOff(currentBoard.board, currentBoard.barW, currentBoard.barB, WHITE);
  const offB = getBorneOff(currentBoard.board, currentBoard.barW, currentBoard.barB, BLACK);
  const canDouble = isMyTurn && game.phase === "move" && pendingMoves.length === 0 && (game.cubeOwner === 0 || game.cubeOwner === myColor);

  return (
    <div className="bg-animate fade-in" style={{ ...S.container, justifyContent: "flex-start", paddingTop: 16 }}>
      {txStatus && <TxOverlay message={txStatus} />}
      {doublingDialog && <DoublingDialog type={doublingDialog.type} cubeValue={game.cubeValue} onAccept={b => handleDoubleResponse(true, b)} onReject={() => handleDoubleResponse(false)} playerName={doublingDialog.from === WHITE ? hostName : guestName} wagerPerPoint={wagerPerPoint} />}
      <div className="fade-in-up" style={S.gameHeader}>
        <div className={isMyTurn ? "turn-glow" : ""} style={S.scoreBoard}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>⚪</span><div><div style={{ color: "#f0e6d2", fontWeight: 600, fontSize: 14 }}>{hostName}</div>{game.turn === WHITE && <div style={{ color: "#f0c040", fontSize: 10, textTransform: "uppercase" }}>Playing</div>}</div></div>
          <div style={{ textAlign: "center" }}><div className="shimmer-text" style={{ fontWeight: 700, fontSize: 24, fontFamily: "'Playfair Display',Georgia,serif" }}>{matchScore.w} – {matchScore.b}</div><div style={{ color: "#4a5a6a", fontSize: 10 }}>Cube: {game.cubeValue}×</div>{wagerPerPoint > 0 && <div className="sol-pulse" style={{ color: "#9945FF", fontSize: 11 }}>Pot: {(lobby?.totalPot || 0).toFixed(4)} SOL</div>}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ textAlign: "right" }}><div style={{ color: "#aaa", fontWeight: 600, fontSize: 14 }}>{guestName}</div>{game.turn === BLACK && <div style={{ color: "#f0c040", fontSize: 10, textTransform: "uppercase" }}>Playing</div>}</div><span style={{ fontSize: 20 }}>⚫</span></div>
        </div>
        <div style={{ color: "#4a5a6a", fontSize: 12, textAlign: "center", marginTop: 4, fontStyle: "italic" }}>{game.lastAction}</div>
        {lobby?.payoutSignature && <div style={{ color: "#14F195", fontSize: 11, textAlign: "center", marginTop: 4 }}>Payout sent ✓</div>}
      </div>
      <DiceDisplay dice={game.dice} usedMoves={pendingMoves.length} diceKey={diceKey} />
      <div style={{ position: "relative", width: "100%", maxWidth: 920 }}>
        {showFireworks && game.phase === "gameover" && <Fireworks />}
        <BoardSVG board={currentBoard.board} barW={currentBoard.barW} barB={currentBoard.barB} selectedPoint={selectedPoint} validDestinations={validDestinations} onPointClick={handlePointClick} onBarClick={handleBarClick} playerColor={myColor} flipped={flipped} cubeValue={game.cubeValue} cubeOwner={game.cubeOwner} offW={offW} offB={offB} />
      </div>
      <div className="fade-in" style={S.controls}>
        {game.phase === "gameover" ? <div style={{ textAlign: "center" }}>
          <p className="win-banner" style={{ color: "#f0c040", fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',Georgia,serif", margin: "0 0 8px" }}>{game.winner === WHITE ? hostName : guestName} wins {game.winPoints} point{game.winPoints > 1 ? "s" : ""}!</p>
          {wagerPerPoint > 0 && <p className="sol-pulse" style={{ color: "#9945FF", fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Payout: {(lobby?.totalPot || 0).toFixed(4)} SOL</p>}
          {myColor === WHITE && <button className="btn-hover" style={{ ...S.btn, ...S.btnP }} onClick={startGame}>New Game</button>}
        </div>
        : game.phase === "double" ? <p style={{ color: "#f0c040", textAlign: "center", animation: "softPulse 2s ease-in-out infinite" }}>Doubling in progress...</p>
        : isMyTurn ? <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {canDouble && <button className="btn-hover glow-pulse" style={{ ...S.btn, ...S.btnD }} onClick={handleDouble}>Double ({game.cubeValue}→{game.cubeValue * 2}){wagerPerPoint > 0 ? ` · ${(game.cubeValue * wagerPerPoint).toFixed(4)} SOL` : ""}</button>}
          {pendingMoves.length > 0 && <button className="btn-hover" style={{ ...S.btn, ...S.btnS }} onClick={undoLastMove}>Undo</button>}
          {maxPossibleMoves === 0 && pendingMoves.length === 0 && <button className="btn-hover" style={{ ...S.btn, ...S.btnP }} onClick={() => submitMoves([])}>No Moves — Pass</button>}
          {pendingMoves.length > 0 && pendingMoves.length < game.dice.length && maxPossibleMoves === 0 && <button className="btn-hover" style={{ ...S.btn, ...S.btnP }} onClick={() => submitMoves()}>Confirm</button>}
        </div>
        : <p style={{ color: "#4a5a6a", textAlign: "center", fontSize: 14, animation: "softPulse 2s ease-in-out infinite" }}>Waiting for {game.turn === WHITE ? hostName : guestName}...</p>}
      </div>
      <div style={{ textAlign: "center", color: "#3a4a5a", fontSize: 11, marginTop: 6 }}>You are {myColor === WHITE ? "⚪ White" : "⚫ Black"}{walletAddr && <span> · <span style={{ color: "#9945FF" }}>{walletAddr.slice(0, 4)}...{walletAddr.slice(-4)}</span></span>}</div>
    </div>
  );
}

const S = {
  container: { minHeight: "100vh", background: "linear-gradient(145deg,#0a0f18 0%,#111c2a 30%,#0d1520 60%,#0a0f18 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 12px", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#c8d6e5" },
  homeCard: { background: "linear-gradient(160deg,#1a2836 0%,#14202e 100%)", border: "1px solid #2a3f52", borderRadius: 18, padding: "40px 36px", maxWidth: 460, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)" },
  title: { fontFamily: "'Playfair Display',Georgia,serif", color: "#e8d4a0", fontSize: 28, fontWeight: 700, margin: 0 },
  subtitle: { color: "#556677", fontSize: 14, margin: "10px 0 0" },
  label: { display: "block", color: "#7a8a9a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 },
  input: { width: "100%", padding: "13px 16px", background: "#0d1520", border: "1px solid #2a3f52", borderRadius: 10, color: "#e8d4a0", fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box", transition: "all 0.3s ease" },
  btn: { padding: "13px 26px", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" },
  btnP: { background: "linear-gradient(135deg,#2e6b3e,#1e5a2e)", color: "#f0e6d2" },
  btnS: { background: "#1e2d3d", color: "#7a8a9a", border: "1px solid #2a3f52" },
  btnD: { background: "linear-gradient(135deg,#6b5a2e,#5a4a1e)", color: "#f0e6d2" },
  btnSm: { padding: "7px 14px", background: "#1e2d3d", color: "#7a8a9a", borderRadius: 8, border: "1px solid #2a3f52" },
  divider: { textAlign: "center", margin: "24px 0", borderTop: "1px solid #2a3f52", position: "relative" },
  dividerText: { background: "#1a2836", color: "#3a4a5a", padding: "0 14px", fontSize: 12, position: "relative", top: -9 },
  error: { color: "#e85050", fontSize: 13, textAlign: "center", marginTop: 12 },
  rules: { marginTop: 28, padding: "16px 18px", background: "#0d1520", borderRadius: 10, color: "#556677", fontSize: 12, lineHeight: 1.6, border: "1px solid #1e2d3d" },
  lobbyInfo: { padding: "16px 18px", background: "#0d1520", borderRadius: 10, marginBottom: 24, border: "1px solid #1e2d3d" },
  code: { background: "#1e2d3d", color: "#f0c040", padding: "5px 12px", borderRadius: 6, fontFamily: "monospace", fontSize: 15, border: "1px solid #2a3f52" },
  playerRow: { display: "flex", justifyContent: "space-around", alignItems: "center", gap: 12 },
  playerCard: { textAlign: "center", padding: "20px 24px", background: "#0d1520", borderRadius: 12, minWidth: 120, border: "1px solid #1e2d3d" },
  gameHeader: { maxWidth: 920, width: "100%", marginBottom: 12 },
  scoreBoard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "linear-gradient(160deg,#1a2836,#14202e)", borderRadius: 14, border: "1px solid #2a3f52", fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" },
  controls: { maxWidth: 920, width: "100%", marginTop: 12, padding: "12px 0" },
};
