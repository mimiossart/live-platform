"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [mode,setMode]=useState<"login"|"signup">("login"), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [displayName,setDisplayName]=useState(""), [error,setError]=useState(""), [notice,setNotice]=useState(""), [loading,setLoading]=useState(false);
  const router=useRouter(); const supabase=createClient();
  async function submit(e:React.FormEvent){e.preventDefault();setError("");setNotice("");setLoading(true);
    if(mode==="signup"){
      const {data,error}=await supabase.auth.signUp({email,password});
      if(error)setError(error.message);
      else if(data.user){
        if(data.session){await supabase.from("profiles").upsert({id:data.user.id,display_name:displayName||email.split("@")[0]},{onConflict:"id"});router.push("/profile");router.refresh();}
        else {setNotice("Compte créé. Vérifie ton email puis connecte-toi.");setMode("login");}
      }
    } else {
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)setError(error.message);else{router.push("/profile");router.refresh();}
    } setLoading(false);
  }
  return <main className="auth"><form className="auth-card" onSubmit={submit}><Link className="brand" href="/">Live<span>Wave</span></Link><h1>{mode==="login"?"Connexion":"Créer ton compte"}</h1><p className="muted">Comptes LiveWave connectés à Supabase.</p>
    {mode==="signup"&&<div className="field"><label>Nom affiché</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Ton pseudo"/></div>}
    <div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="toi@email.com"/></div>
    <div className="field"><label>Mot de passe</label><input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></div>
    {error&&<div className="notice">{error}</div>}{notice&&<div className="notice">{notice}</div>}
    <button className="primary" disabled={loading} style={{width:"100%"}}>{loading?"Chargement…":mode==="login"?"Se connecter":"Créer mon compte"}</button>
    <button type="button" className="secondary" style={{width:"100%",marginTop:10}} onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Pas encore de compte ? S’inscrire":"J’ai déjà un compte"}</button>
    <p style={{marginTop:18}}><Link className="muted" href="/">← Retour à l’accueil</Link></p>
  </form></main>;
}