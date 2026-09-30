"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Profile={username:string|null;display_name:string|null};
type Live={id:string;title:string;viewer_count:number;user_id:string;profiles?:Profile|null};
export default function LiveFeed(){
 const[streams,setStreams]=useState<Live[]>([]),[error,setError]=useState("");
 const supabase=createClient();
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const {data:rows,error:e}=await supabase.from("lives").select("id,title,viewer_count,user_id,created_at").eq("status","live").order("created_at",{ascending:false}).limit(30);
   if(!active)return;
   if(e){setError(e.message);return}
   const ids=[...new Set((rows||[]).map((r:any)=>r.user_id))];
   const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,display_name").in("id",ids):{data:[]};
   const byId:Record<string,Profile>={};
   for(const p of profiles||[])byId[p.id]={username:p.username,display_name:p.display_name};
   setStreams((rows||[]).map((r:any)=>({...r,profiles:byId[r.user_id]||null})));
  };
  load();
  const ch=supabase.channel("feed-lives").on("postgres_changes",{event:"*",schema:"public",table:"lives"},load).subscribe();
  return()=>{active=false;supabase.removeChannel(ch)};
 },[]);
 return <main className="app"><div className="shell"><header className="topbar"><Link className="brand" href="/">Live<span>Wave</span></Link><Link className="ghost" href="/">Accueil</Link></header><div className="feed">{error&&<div className="notice">{error}</div>}{streams.map(s=><article className="slide" key={s.id}><div className="video-placeholder"><div className="play">▶</div></div><div className="overlay"/><div className="slide-info"><span className="live-badge">● LIVE · {s.viewer_count}</span><h2>{s.title}</h2><p><b>@{s.profiles?.username||"créateur"}</b></p><Link className="secondary" href={"/live/"+s.id}>Ouvrir le live</Link></div><div className="side-actions"><button className="round">♡</button><button className="round">💬</button><button className="round">↗</button></div></article>)}{!streams.length&&!error&&<div className="panel"><h2>Aucun live en cours</h2><p className="muted">Crée le premier live LiveWave.</p><Link className="primary" href="/create">Créer un live</Link></div>}</div></div></main>}