"use client";
import "./studio.css";
import Link from "next/link";
import {useEffect,useState,useRef,type PointerEvent as ReactPointerEvent} from "react";
import {useParams,useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import type {LiveKitVideoHandle} from "@/components/livekit-video";
import LiveKitVideo from "@/components/livekit-video";
type Msg={id:string;body:string;user_id:string;created_at:string;username?:string|null};
export default function StudioLive(){const videoRef=useRef<LiveKitVideoHandle>(null);
 const {id}=useParams<{id:string}>(),router=useRouter(),supabase=createClient();const[live,setLive]=useState<any>(null),[messages,setMessages]=useState<Msg[]>([]),[text,setText]=useState(""),[uid,setUid]=useState(""),[error,setError]=useState(""),[elapsed,setElapsed]=useState("00:00"),[mic,setMic]=useState(true),[cam,setCam]=useState(true),[share,setShare]=useState(false),[panel,setPanel]=useState<"sources"|"gifts"|"match"|"guests"|"moderation"|null>(null),[sceneSources,setSceneSources]=useState<any[]>(()=>[{id:"default-game",type:"game",x:0,y:0,w:100,h:100,z:1,label:"🎮 Jeu"}]),[selectedSource,setSelectedSource]=useState<string|null>(null),[orientation,setOrientation]=useState<"portrait"|"landscape">("portrait"),[overlay,setOverlay]=useState(""),[matchUser,setMatchUser]=useState(""),[guestUser,setGuestUser]=useState(""),[giftBusy,setGiftBusy]=useState(false),[panelMsg,setPanelMsg]=useState(""),[showSettings,setShowSettings]=useState(false),[settingsTab,setSettingsTab]=useState<"general"|"video"|"audio"|"stream">("general"),[liveCategory,setLiveCategory]=useState("Gaming"),[latency,setLatency]=useState("Standard"),[quality,setQuality]=useState("1080p"),[fps,setFps]=useState("30 FPS"),[micGain,setMicGain]=useState(80),[cameraBeauty,setCameraBeauty]=useState(true),[autoMod,setAutoMod]=useState(true),[sceneName,setSceneName]=useState("Scène principale");
useEffect(()=>{let ch:any;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login");return}setUid(user.id);const {data:l}=await supabase.from("lives").select("*").eq("id",id).single();if(!l||l.user_id!==user.id||l.status!=="live"){router.replace("/studio");return}setLive(l);const {data:rows}=await supabase.from("live_messages").select("id,body,user_id,created_at").eq("live_id",id).order("created_at",{ascending:true}).limit(100);const ids=[...new Set((rows||[]).map((x:any)=>x.user_id))];const names:Record<string,string|null>={};if(ids.length){const {data:ps}=await supabase.from("profiles").select("id,username,display_name").in("id",ids);for(const p of ps||[])names[p.id]=p.username||p.display_name}setMessages((rows||[]).map((x:any)=>({...x,username:names[x.user_id]||null})));ch=supabase.channel("studio-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"live_messages",filter:"live_id=eq."+id},async p=>{const m=p.new as Msg;const {data:pr}=await supabase.from("profiles").select("username,display_name").eq("id",m.user_id).maybeSingle();setMessages(v=>[...v,{...m,username:pr?.username||pr?.display_name||null}].slice(-100))}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"lives",filter:"id=eq."+id},p=>{if((p.new as any).status!=="live")router.replace("/studio")}).subscribe()})();return()=>{if(ch)supabase.removeChannel(ch)}},[id]);
useEffect(()=>{if(!live?.started_at)return;const t=setInterval(()=>{const s=Math.max(0,Math.floor((Date.now()-new Date(live.started_at).getTime())/1000));setElapsed([Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,"0")).join(":"))},1000);return()=>clearInterval(t)},[live?.started_at]);
function addSceneSource(type:string,mediaUrl?:string,labelOverride?:string){const source={id:crypto.randomUUID(),type,mediaUrl:mediaUrl||"",x:type==="game"?0:50,y:type==="game"?0:50,w:type==="game"?100:type==="camera"?30:type==="banner"?70:60,h:type==="game"?100:type==="camera"?30:type==="banner"?12:24,z:sceneSources.length+1,label:labelOverride||(type==="game"?"🎮 Jeu":type==="camera"?"📷 Caméra":type==="image"?"🖼️ Image":type==="video"?"🎥 Vidéo":type==="banner"?"📢 LIVE EN DIRECT":"🔤 Texte")};setSceneSources(v=>[...v,source]);setSelectedSource(source.id)}
function moveSource(id:string,x:number,y:number){setSceneSources(v=>v.map(s=>s.id===id?{...s,x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y))}:s))}
function resizeSource(id:string,d:number){setSceneSources(v=>v.map(s=>s.id===id?{...s,w:Math.max(5,Math.min(95,s.w+d)),h:Math.max(5,Math.min(90,s.h+d*.6))}:s))}
function removeSource(id:string){setSceneSources(v=>v.filter(s=>s.id!==id));setSelectedSource(null)}
function dragSource(e:ReactPointerEvent,id:string){const el=e.currentTarget as HTMLElement;el.setPointerCapture(e.pointerId);const startX=e.clientX,startY=e.clientY,source=sceneSources.find(s=>s.id===id);if(!source)return;const parent=el.parentElement;if(!parent)return;const rect=parent.getBoundingClientRect();const move=(ev:PointerEvent)=>moveSource(id,source.x+(ev.clientX-startX)/rect.width*100,source.y+(ev.clientY-startY)/rect.height*100);const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up)}
function resizeSourceFromPointer(e:ReactPointerEvent,id:string){e.stopPropagation();const source=sceneSources.find(s=>s.id===id);const parent=(e.currentTarget as HTMLElement).closest(".studio-canvas");if(!source||!parent)return;const rect=parent.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,startW=source.w,startH=source.h;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);const move=(ev:PointerEvent)=>{const dw=(ev.clientX-startX)/rect.width*100;const dh=(ev.clientY-startY)/rect.height*100;setSceneSources(v=>v.map(s=>s.id===id?{...s,w:Math.max(5,Math.min(95,startW+dw)),h:Math.max(5,Math.min(90,startH+dh))}:s))};const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up)}
function addMedia(type:"image"|"video"){const input=document.createElement("input");input.type="file";input.accept=type==="image"?"image/*":"video/*";input.onchange=()=>{const f=input.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>addSceneSource(type,String(reader.result));reader.readAsDataURL(f)};input.click()} async function send(){const body=text.trim();if(!body)return;setText("");const {error:e}=await supabase.from("live_messages").insert({live_id:id,user_id:uid,body});if(e){setError(e.message);setText(body)}}async function sendGift(gift:string,coins:number){if(giftBusy)return;setGiftBusy(true);setPanelMsg("");const {error:e}=await supabase.rpc("send_live_gift",{target_live:id,gift_name:gift,coin_cost:coins});setGiftBusy(false);setPanelMsg(e?e.message:"🎁 Cadeau envoyé !")} async function startMatch(){const target=matchUser.trim().replace(/^@/,"").toLowerCase();if(!target)return;const {data:p}=await supabase.from("profiles").select("id,username").eq("username",target).maybeSingle();if(!p){setPanelMsg("Utilisateur introuvable.");return}if(p.id===uid){setPanelMsg("Tu ne peux pas te défier toi-même.");return}const {data:op}=await supabase.from("lives").select("id").eq("user_id",p.id).eq("status","live").neq("id",id).maybeSingle();if(!op){setPanelMsg("Cette personne n'est pas en live.");return}const {data:m,error:e}=await supabase.from("live_matches").insert({live_id:id,opponent_live_id:op.id,battle_room_id:crypto.randomUUID(),challenger_id:uid,opponent_id:p.id,status:"pending",duration_seconds:300}).select("*").single();setPanelMsg(e?e.message:"⚔️ Défi envoyé !");if(m)setPanel("match")} async function inviteGuest(){const target=guestUser.trim().replace(/^@/,"").toLowerCase();const {data:p}=await supabase.from("profiles").select("id").eq("username",target).maybeSingle();if(!p){setPanelMsg("Utilisateur introuvable.");return}const {error:e}=await supabase.from("live_guests").upsert({live_id:id,user_id:p.id,invited_by:uid,status:"invited"});setPanelMsg(e?e.message:"👥 Invitation envoyée !")} async function saveOverlay(file:File){const reader=new FileReader();reader.onload=async()=>{const {error:e}=await supabase.from("live_overlays").upsert({live_id:id,image_data:String(reader.result)},{onConflict:"live_id"});if(!e)setOverlay(String(reader.result));setPanelMsg(e?.message||"🖼️ Overlay ajouté.");};reader.readAsDataURL(file)} async function end(){const {error:e}=await supabase.from("lives").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",id).eq("user_id",uid);if(e)setError(e.message);else router.replace("/studio")}
if(!live)return <main className="studio-app"><div className="studio-loading">Chargement du LIVE…</div></main>;
return <main className="studio-app">
  <header className="studio-header">
    <div className="studio-header-brand"><Link href="/" className="studio-brand">Live<span>Wave</span></Link><span className="studio-header-divider"/><span className="studio-product">LIVE STUDIO</span></div>
    <div className="studio-header-live">
      <span className="studio-live-dot"/> EN DIRECT <strong>{elapsed}</strong>
    </div>
    <div className="studio-header-actions">
      <button className="studio-header-btn" onClick={()=>setShowSettings(true)}>⚙️ Réglages</button>
      <button className="studio-header-btn" onClick={()=>window.open("/live/"+id,"_blank")}>👁️ Voir le LIVE</button>
      <button className="studio-end-btn" onClick={end}>⏹ Terminer le LIVE</button>
    </div>
  </header>

  <aside className="studio-leftbar">
    <div className="studio-left-title">SCÈNES</div>
    <div className="studio-scene-list">
      <button className="studio-scene-card active" onClick={()=>setSceneName("Scène principale")}>
        <span className="scene-thumb portrait"><span>🎮</span><i>● LIVE</i></span>
        <span><b>Scène principale</b><small>{orientation==="portrait"?"9:16":"16:9"}</small></span>
      </button>
      <button className="studio-scene-card" onClick={()=>setPanel("sources")}>
        <span className="scene-thumb"><span>＋</span></span>
        <span><b>Nouvelle scène</b><small>Ajouter une scène</small></span>
      </button>
    </div>
    <div className="studio-left-title">SOURCES</div>
    <div className="studio-source-list">
      {sceneSources.slice().sort((a,b)=>(b.z||0)-(a.z||0)).map(s=>
        <button key={s.id} className={"studio-source-item "+(selectedSource===s.id?"active":"")} onClick={()=>setSelectedSource(s.id)}>
          <span className="source-icon">{s.type==="camera"?"📷":s.type==="game"?"🎮":s.type==="image"?"🖼️":s.type==="video"?"🎥":s.type==="banner"?"📢":"🔤"}</span>
          <span><b>{String(s.label||s.type).replace(/^[^ ]+ /,"")}</b><small>{s.type==="game"?"Jeu / écran":s.type==="camera"?"Caméra":s.type==="banner"?"Bannière":"Source média"}</small></span>
          <span className="source-eye">◉</span>
        </button>
      )}
    </div>
    <button className="studio-add-source" onClick={()=>setPanel("sources")}>＋ Ajouter une source</button>
    <div className="studio-left-bottom">
      <button onClick={()=>setPanel("guests")}>👥 Invités</button>
      <button onClick={()=>setPanel("moderation")}>🛡 Modération</button>
    </div>
  </aside>

  <section className="studio-workspace">
    <div className="studio-titlebar">
      <div className="studio-live-info">
        <span className="studio-kicker">LIVE</span>
        <input value={live.title} onChange={e=>setLive((v:any)=>({...v,title:e.target.value}))} onBlur={async()=>{await supabase.from("lives").update({title:live.title}).eq("id",id).eq("user_id",uid)}} aria-label="Titre du live"/>
        <span className="studio-category">🎮 {liveCategory}</span>
      </div>
      <div className="studio-format-tabs">
        <button className={orientation==="portrait"?"active":""} onClick={()=>setOrientation("portrait")}>▯ Vertical 9:16</button>
        <button className={orientation==="landscape"?"active":""} onClick={()=>setOrientation("landscape")}>▭ Horizontal 16:9</button>
      </div>
    </div>

    <div className="studio-preview-shell">
      <div className="studio-preview-toolbar">
        <div><b>Aperçu</b><span>• {sceneName}</span></div>
        <div className="preview-toolbar-actions"><button onClick={()=>setPanel("sources")}>＋ Source</button><button onClick={()=>setShowSettings(true)}>⚙</button></div>
      </div>
      <div className={"studio-canvas "+(orientation==="portrait"?"canvas-portrait":"canvas-landscape")}>
        <LiveKitVideo ref={videoRef} liveId={id} isOwner composite sceneSources={sceneSources} orientation={orientation}/>
        {sceneSources.map(s=><div key={s.id} className={"scene-source "+(selectedSource===s.id?"selected":"")} style={{left:s.x+"%",top:s.y+"%",width:s.w+"%",height:s.h+"%",zIndex:30+s.z}} onPointerDown={e=>{if((e.target as HTMLElement).closest(".scene-tools,.scene-resize"))return;setSelectedSource(s.id);dragSource(e,s.id)}} onClick={()=>setSelectedSource(s.id)}>
          {s.type==="image"&&s.mediaUrl?<img src={s.mediaUrl} alt="" draggable={false}/>:s.type==="video"&&s.mediaUrl?<video src={s.mediaUrl} muted autoPlay loop playsInline/>:<span>{s.label}</span>}
          {selectedSource===s.id&&<div className="scene-tools"><button onClick={e=>{e.stopPropagation();moveSource(s.id,Math.max(5,s.x-2),s.y)}}>←</button><button onClick={e=>{e.stopPropagation();moveSource(s.id,Math.min(95,s.x+2),s.y)}}>→</button><button onClick={e=>{e.stopPropagation();resizeSource(s.id,4)}}>＋</button><button onClick={e=>{e.stopPropagation();resizeSource(s.id,-4)}}>−</button><button onClick={e=>{e.stopPropagation();removeSource(s.id)}}>✕</button></div>}
          {selectedSource===s.id&&<div className="scene-resize" onPointerDown={e=>resizeSourceFromPointer(e,s.id)} />}
        </div>)}
        <div className="studio-live-badge">● LIVE</div>
      </div>
    </div>

    <div className="studio-bottom-dock">
      <div className="dock-device">
        <span className="dock-icon">🎙️</span><div><b>Microphone</b><small>{mic?"Activé":"Désactivé"}</small></div>
        <button onClick={async()=>{const on=await videoRef.current?.toggleMicrophone();if(on!==undefined)setMic(on)}}>{mic?"🔊":"🔇"}</button>
      </div>
      <div className="dock-device">
        <span className="dock-icon">📷</span><div><b>Caméra</b><small>{cam?"Activée":"Désactivée"}</small></div>
        <button onClick={async()=>{const on=await videoRef.current?.toggleCamera();if(on!==undefined)setCam(on)}}>{cam?"●":"○"}</button>
      </div>
      <div className="dock-device wide">
        <span className="dock-icon">🎮</span><div><b>Partage d'écran</b><small>{share?"En cours":"Jeu / fenêtre"}</small></div>
        <button onClick={async()=>{const on=await videoRef.current?.toggleScreenShare();if(on!==undefined){setShare(on);if(on&&!sceneSources.some(s=>s.type==="game"))addSceneSource("game")}}}>{share?"Arrêter":"Partager"}</button>
      </div>
      <div className="dock-meter"><span>Micro</span><i><b style={{width:micGain+"%"}}/></i></div>
      <button className="dock-action" onClick={()=>setPanel("gifts")}>🎁 <span>Cadeaux</span></button>
      <button className="dock-action" onClick={()=>setPanel("match")}>⚔️ <span>Match</span></button>
      <button className="dock-action" onClick={()=>window.open("/live/"+id+"/chat","livewave-chat","width=380,height=700,resizable=yes")}>💬 <span>Chat</span></button>
    </div>
  </section>

  <aside className="studio-rightbar">
    <div className="rightbar-tabs"><button className="active">Chat</button><button onClick={()=>setPanel("gifts")}>Cadeaux</button><button onClick={()=>setPanel("match")}>Match</button></div>
    <section className="studio-chat-panel">
      <div className="chat-panel-head"><div><b>Chat du LIVE</b><small>Interactions en temps réel</small></div><span>{messages.length}</span></div>
      <div className="studio-chat-list">{messages.map(m=><div className="studio-chat-line" key={m.id}><strong>@{m.username||"spectateur"}</strong><span>{m.body}</span></div>)}{!messages.length&&<div className="chat-empty">Aucun commentaire pour le moment.</div>}</div>
      <form onSubmit={e=>{e.preventDefault();send()}}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Écrire un message…" maxLength={500}/><button>➤</button></form>
    </section>
    <section className="studio-live-summary">
      <div className="summary-title"><b>LIVE</b><span>{elapsed}</span></div>
      <div className="summary-stat"><span>🔴 Statut</span><strong>En direct</strong></div>
      <div className="summary-stat"><span>🎮 Catégorie</span><strong>{liveCategory}</strong></div>
      <div className="summary-stat"><span>📐 Format</span><strong>{orientation==="portrait"?"9:16":"16:9"}</strong></div>
    </section>
    <div className="rightbar-actions">
      <button onClick={()=>setPanel("guests")}>👥 Inviter un invité</button>
      <button onClick={()=>setPanel("moderation")}>🛡 Modération</button>
      <button onClick={()=>setShowSettings(true)}>⚙️ Paramètres du LIVE</button>
    </div>
  </aside>

  {panel&&<div className="studio-panel-backdrop" onClick={()=>setPanel(null)}><aside className="studio-panel" onClick={e=>e.stopPropagation()}>
    <div className="studio-panel-head"><b>{panel==="sources"?"🖼️ Sources":panel==="gifts"?"🎁 Cadeaux":panel==="match"?"⚔️ Match":panel==="guests"?"👥 Invités":"🛡 Modération"}</b><button onClick={()=>setPanel(null)}>✕</button></div>
    {panel==="sources"&&<div className="panel-content">
      <div className="panel-section-title">Ajouter une source</div>
      <div className="scene-add-grid"><button onClick={()=>addSceneSource("game",undefined,"🎮 Jeu / fenêtre")}>🎮 Jeu / fenêtre</button><button onClick={()=>addSceneSource("game",undefined,"🖥️ Écran entier")}>🖥️ Écran entier</button><button onClick={()=>addSceneSource("game",undefined,"🪟 Fenêtre")}>🪟 Fenêtre</button><button onClick={()=>addSceneSource("camera")}>📷 Caméra</button><button onClick={()=>addMedia("image")}>🖼️ Image</button><button onClick={()=>addMedia("video")}>🎥 Vidéo</button><button onClick={()=>addSceneSource("text")}>🔤 Texte</button><button onClick={()=>addSceneSource("banner")}>📢 Bannière</button></div>
      <div className="panel-section-title">Format du LIVE</div><div className="orientation-panel"><button className={orientation==="portrait"?"selected":""} onClick={()=>setOrientation("portrait")}>▯ Portrait 9:16</button><button className={orientation==="landscape"?"selected":""} onClick={()=>setOrientation("landscape")}>▭ Paysage 16:9</button></div>
      <button className="panel-action" onClick={async()=>{const on=await videoRef.current?.toggleCamera();if(on!==undefined)setCam(on)}}>📷 {cam?"Couper la caméra":"Activer la caméra"}</button>
      <button className="panel-action" onClick={async()=>{const on=await videoRef.current?.toggleMicrophone();if(on!==undefined)setMic(on)}}>🎙️ {mic?"Couper le micro":"Activer le micro"}</button>
      <div className="capture-actions"><button className="panel-action" onClick={async()=>{const on=await videoRef.current?.toggleScreenShare();if(on!==undefined){setShare(on);if(on&&!sceneSources.some(s=>s.type==="game"))addSceneSource("game",undefined,"🎮 Jeu / fenêtre")}}}>🎮 Jeu / fenêtre</button><button className="panel-action" onClick={async()=>{const on=await videoRef.current?.toggleScreenShare();if(on!==undefined){setShare(on);if(on&&!sceneSources.some(s=>s.type==="game"))addSceneSource("game",undefined,"🖥️ Écran entier")}}}>🖥️ Écran entier</button><button className="panel-action" onClick={async()=>{const on=await videoRef.current?.toggleScreenShare();if(on!==undefined){setShare(on);if(on&&!sceneSources.some(s=>s.type==="game"))addSceneSource("game",undefined,"🪟 Fenêtre")}}}>🪟 Fenêtre</button></div>
      <label className="panel-upload">🖼️ Ajouter un overlay<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)saveOverlay(f)}}/></label>{overlay&&<img className="panel-overlay-preview" src={overlay} alt=""/>}
    </div>}
    {panel==="gifts"&&<div className="panel-content"><p>Gère les cadeaux et les interactions pendant le LIVE.</p><div className="gift-grid">{[["🌹 Rose",1],["💗 Cœur",5],["🔥 Feu",10],["💎 Diamant",50],["👑 Couronne",100],["🚀 Fusée",200],["🦁 Lion",10000]].map(([g,n])=><button disabled={giftBusy} onClick={()=>sendGift(String(g),Number(n))} className="gift-choice" key={String(g)}>{g}<small>{n} coins</small></button>)}</div></div>}
    {panel==="match"&&<div className="panel-content"><p>Invite un créateur actuellement en direct pour lancer un match.</p><input className="panel-input" value={matchUser} onChange={e=>setMatchUser(e.target.value)} placeholder="@pseudo"/><button className="panel-primary" onClick={startMatch}>⚔️ Envoyer le défi</button></div>}
    {panel==="guests"&&<div className="panel-content"><p>Invite un créateur à rejoindre ton LIVE.</p><input className="panel-input" value={guestUser} onChange={e=>setGuestUser(e.target.value)} placeholder="@pseudo"/><button className="panel-primary" onClick={inviteGuest}>👥 Inviter</button></div>}
    {panel==="moderation"&&<div className="panel-content"><p>Contrôle du chat et des interactions.</p><label className="setting-toggle"><span><b>Filtre automatique</b><small>Masquer les messages suspects</small></span><input type="checkbox" checked={autoMod} onChange={e=>setAutoMod(e.target.checked)}/></label><button className="panel-action">🛡️ Gérer les modérateurs</button><button className="panel-action">🚫 Liste des utilisateurs bloqués</button></div>}
    {panelMsg&&<div className="panel-message">{panelMsg}</div>}
  </aside></div>}

  {showSettings&&<div className="studio-settings-backdrop" onClick={()=>setShowSettings(false)}><section className="studio-settings" onClick={e=>e.stopPropagation()}>
    <header className="settings-header"><div><b>Réglages du LIVE Studio</b><small>Configure ton direct, ta vidéo et ton audio</small></div><button onClick={()=>setShowSettings(false)}>✕</button></header>
    <div className="settings-body">
      <nav className="settings-nav">
        <button className={settingsTab==="general"?"active":""} onClick={()=>setSettingsTab("general")}>⚙️ Général</button>
        <button className={settingsTab==="video"?"active":""} onClick={()=>setSettingsTab("video")}>📹 Vidéo</button>
        <button className={settingsTab==="audio"?"active":""} onClick={()=>setSettingsTab("audio")}>🎙️ Audio</button>
        <button className={settingsTab==="stream"?"active":""} onClick={()=>setSettingsTab("stream")}>🔴 LIVE</button>
      </nav>
      <div className="settings-content">
        {settingsTab==="general"&&<><h2>Informations du LIVE</h2><p className="settings-help">Les réglages visibles par les spectateurs.</p><label>Nom du LIVE<input value={live.title} onChange={e=>setLive((v:any)=>({...v,title:e.target.value}))} onBlur={async()=>{await supabase.from("lives").update({title:live.title}).eq("id",id).eq("user_id",uid)}}/></label><label>Catégorie<select value={liveCategory} onChange={e=>setLiveCategory(e.target.value)}><option>Gaming</option><option>Just Chatting</option><option>Musique</option><option>Création</option><option>Sport</option></select></label><label>Visibilité<select><option>Public</option><option>Abonnés</option><option>Privé</option></select></label><label className="setting-toggle"><span><b>Mode faible latence</b><small>Réduit le délai entre le Studio et les spectateurs</small></span><input type="checkbox" checked={latency==="Faible"} onChange={e=>setLatency(e.target.checked?"Faible":"Standard")}/></label></>}
        {settingsTab==="video"&&<><h2>Réglages vidéo</h2><p className="settings-help">Qualité de l'aperçu et format de sortie.</p><label>Qualité<select value={quality} onChange={e=>setQuality(e.target.value)}><option>720p</option><option>1080p</option><option>1440p</option></select></label><label>Images par seconde<select value={fps} onChange={e=>setFps(e.target.value)}><option>30 FPS</option><option>60 FPS</option></select></label><label>Orientation<select value={orientation} onChange={e=>setOrientation(e.target.value as "portrait"|"landscape")}><option value="portrait">Portrait 9:16</option><option value="landscape">Paysage 16:9</option></select></label><label className="setting-toggle"><span><b>Amélioration caméra</b><small>Prépare l'espace pour les filtres et effets</small></span><input type="checkbox" checked={cameraBeauty} onChange={e=>setCameraBeauty(e.target.checked)}/></label></>}
        {settingsTab==="audio"&&<><h2>Réglages audio</h2><p className="settings-help">Contrôle du microphone et du monitoring.</p><label>Volume micro <b>{micGain}%</b><input type="range" min="0" max="100" value={micGain} onChange={e=>setMicGain(Number(e.target.value))}/></label><label>Microphone<select><option>Microphone du navigateur</option><option>Microphone système</option></select></label><label className="setting-toggle"><span><b>Monitoring audio</b><small>Préparation du retour audio local</small></span><input type="checkbox"/></label></>}
        {settingsTab==="stream"&&<><h2>Paramètres du LIVE</h2><p className="settings-help">Options de diffusion et interactions.</p><label>Latence<select value={latency} onChange={e=>setLatency(e.target.value)}><option>Faible</option><option>Standard</option><option>Élevée</option></select></label><label>Chat<select><option>Tout le monde</option><option>Abonnés uniquement</option></select></label><label className="setting-toggle"><span><b>Autoriser les cadeaux</b><small>Les spectateurs peuvent envoyer des cadeaux</small></span><input type="checkbox" defaultChecked/></label><label className="setting-toggle"><span><b>Autoriser les invités</b><small>Permettre les invitations en LIVE</small></span><input type="checkbox" defaultChecked/></label><label className="setting-toggle"><span><b>Filtre automatique du chat</b><small>Protection contre les messages indésirables</small></span><input type="checkbox" checked={autoMod} onChange={e=>setAutoMod(e.target.checked)}/></label></>}
      </div>
    </div>
    <footer className="settings-footer"><span>Les réglages vidéo/audio avancés sont appliqués par le Studio.</span><button className="panel-primary" onClick={()=>setShowSettings(false)}>Enregistrer</button></footer>
  </section></div>}
  {error&&<div className="studio-error">{error}</div>}
</main>
}