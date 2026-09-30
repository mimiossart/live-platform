"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
type Profile={id:string;username:string|null;display_name:string|null;bio:string|null};
export default function Profile(){
 const [p,setP]=useState<Profile|null>(null),[email,setEmail]=useState(""),[lives,setLives]=useState(0),[message,setMessage]=useState(""),[saving,setSaving]=useState(false),[admin,setAdmin]=useState(false);
 const router=useRouter(),supabase=createClient();
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login");return}setEmail(user.email||"");let {data}=await supabase.from("profiles").select("id,username,display_name,bio").eq("id",user.id).maybeSingle();if(!data){const r=await supabase.from("profiles").insert({id:user.id,display_name:user.email?.split("@")[0]||"Créateur"}).select("id,username,display_name,bio").single();data=r.data}setP(data);const a=await supabase.rpc("is_platform_admin");setAdmin(!!a.data);const c=await supabase.from("lives").select("id",{count:"exact",head:true}).eq("user_id",user.id);setLives(c.count||0)})()},[]);
 async function save(){if(!p)return;setSaving(true);const {data,error}=await supabase.from("profiles").update({username:p.username||null,display_name:p.display_name||null,bio:p.bio||null,updated_at:new Date().toISOString()}).eq("id",p.id).select().single();setMessage(error?.message||"Profil enregistré.");if(data)setP(data);setSaving(false)}
 async function logout(){await supabase.auth.signOut();router.push("/");router.refresh()}
 if(!p)return <main className="app"><div className="shell"><p className="muted">Chargement…</p></div></main>;
 return <main className="app"><div className="shell"><header className="topbar"><Link className="brand" href="/">Live<span>Wave</span></Link><div className="actions"><Link className="ghost" href="/">Accueil</Link><button className="ghost" onClick={logout}>Déconnexion</button></div></header>
 <section className="profile"><div className="profile-main"><div className="avatar">{(p.display_name||"L")[0].toUpperCase()}</div><strong>@{p.username||"monprofil"}</strong><span className="muted">{email}</span></div><div><h1>Mon profil</h1>
 <div className="field"><label>Nom affiché</label><input value={p.display_name||""} onChange={e=>setP({...p,display_name:e.target.value})}/></div><div className="field"><label>Nom d’utilisateur</label><input value={p.username||""} onChange={e=>setP({...p,username:e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,"")})}/></div><div className="field"><label>Bio</label><textarea value={p.bio||""} onChange={e=>setP({...p,bio:e.target.value})}/></div><button className="primary" onClick={save} disabled={saving}>{saving?"Enregistrement…":"Enregistrer le profil"}</button>{message&&<p className="muted">{message}</p>}
 <div className="stats"><div><strong>{lives}</strong><span>lives</span></div><div><strong>0</strong><span>abonnés</span></div><div><strong>0</strong><span>vues</span></div></div>{admin&&<div className="panel" style={{marginTop:25}}><h3>Administration</h3><p className="muted">Gérer les Coins des utilisateurs.</p><Link className="primary" href="/admin/coins">Donner des Coins</Link></div>}<div className="panel" style={{marginTop:25}}><h3>Espace créateur</h3><p className="muted">Lance un vrai live avec caméra, jeu, portrait/paysage et composition.</p><Link className="primary" href="/studio">🎥 Ouvrir le Studio</Link></div></div></section></div></main>;
}
