"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";

export default function AdminCoins(){
 const router=useRouter(),supabase=createClient();
 const [ready,setReady]=useState(false),[username,setUsername]=useState(""),[amount,setAmount]=useState("1000"),[note,setNote]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login");return}const {data,error}=await supabase.rpc("is_platform_admin");if(error||!data){router.replace("/profile");return}setReady(true)})()},[]);
 async function grant(){setMessage("");const n=Number(amount);if(!username.trim()||!Number.isInteger(n)||n<=0){setMessage("Indique un @username et un nombre de Coins valide.");return}setBusy(true);const {data:user}=await supabase.from("profiles").select("id,username,display_name").eq("username",username.trim().replace(/^@/,"").toLowerCase()).maybeSingle();if(!user){setMessage("Utilisateur introuvable.");setBusy(false);return}const {data,error}=await supabase.rpc("admin_grant_coins",{target_user:user.id,coin_amount:n,grant_note:note||null});setMessage(error?"Erreur : "+error.message:"Coins crédités. Nouveau solde : "+Number(data||0).toLocaleString("fr-FR")+" Coins.");if(!error){setUsername("");setNote("")}setBusy(false)}
 if(!ready)return <main className="app"><div className="shell"><p className="muted">Vérification des droits...</p></div></main>;
 return <main className="app"><div className="shell"><header className="topbar"><Link className="brand" href="/">Live<span>Wave</span></Link><Link className="ghost" href="/profile">Profil</Link></header><section className="panel admin-panel"><h1>Gestion des Coins</h1><p className="muted">Seul le propriétaire peut créditer des Coins.</p><div className="field"><label>Utilisateur</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username"/></div><div className="field"><label>Nombre de Coins</label><input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="field"><label>Note</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Bonus ou recompense"/></div><button className="primary" disabled={busy} onClick={grant}>{busy?"Credit en cours...":"Donner les Coins"}</button>{message&&<p className="notice">{message}</p>}</section></div></main>;
}