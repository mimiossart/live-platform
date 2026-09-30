"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
export default function Create(){const[title,setTitle]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);const router=useRouter(),supabase=createClient();
 useEffect(()=>{supabase.auth.getUser().then(({data:{user}})=>{if(!user)router.replace("/login")})},[]);
 async function start(){setError("");if(!title.trim()){setError("Ajoute un titre.");return}setLoading(true);const {data:{user}}=await supabase.auth.getUser();if(!user){router.push("/login");return}const {data,error}=await supabase.from("lives").insert({user_id:user.id,title:title.trim(),status:"live",started_at:new Date().toISOString()}).select("id").single();if(error)setError(error.message);else router.push("/studio/"+data.id);setLoading(false)}
 return <main className="app"><div className="shell"><header className="topbar"><Link className="brand" href="/">Live<span>Wave</span></Link><Link className="ghost" href="/">Accueil</Link></header><section className="create panel"><div className="eyebrow">Studio live</div><h1>Créer un live</h1><p className="muted">Le live sera ouvert directement dans le Studio : caméra, micro, partage de jeu, portrait/paysage et composition seront disponibles.</p><div className="field"><label>Titre du live</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. On discute de tout 🔥"/></div>{error&&<div className="notice">{error}</div>}<button className="primary" style={{marginTop:18}} onClick={start} disabled={loading}>{loading?"Ouverture…":"🔴 Démarrer mon live"}</button></section></div></main>}
