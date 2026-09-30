"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
type N={id:string;body:string;created_at:string;read:boolean};
export default function AppShell({children}:{children:React.ReactNode}){
 const [userId,setUserId]=useState(""),[notes,setNotes]=useState<N[]>([]),[open,setOpen]=useState(false),[install,setInstall]=useState<any>(null);
 const supabase=createClient();
 useEffect(()=>{let ch:any;
  (async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return;setUserId(user.id);
   const {data}=await supabase.from("notifications").select("id,body,created_at,read").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);setNotes(data||[]);
   ch=supabase.channel("notifications-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},p=>setNotes(v=>[p.new as N,...v].slice(0,30))).on("postgres_changes",{event:"UPDATE",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},p=>setNotes(v=>v.map(n=>n.id===(p.new as N).id?p.new as N:n))).subscribe()
  })();
  const handler=(e:any)=>{e.preventDefault();setInstall(e)};window.addEventListener("beforeinstallprompt",handler);
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
  return()=>{if(ch)supabase.removeChannel(ch);window.removeEventListener("beforeinstallprompt",handler)}
 },[]);
 const unread=notes.filter(n=>!n.read).length;
 async function readAll(){if(!userId||!unread)return;await supabase.from("notifications").update({read:true}).eq("user_id",userId).eq("read",false);setNotes(v=>v.map(n=>({...n,read:true})));}
 async function toggleNotifications(){const next=!open;setOpen(next);if(next)await readAll();}
 async function doInstall(){
 if(install){await install.prompt();setInstall(null);return}
 const ua=navigator.userAgent||"";
 const ios=/iPhone|iPad|iPod/i.test(ua);
 const android=/Android/i.test(ua);
 if(ios){alert("Pour installer LiveWave sur iPhone : Safari → Partager → Ajouter à l’écran d’accueil.")}
 else if(android){alert("Pour installer LiveWave sur Android : Chrome → menu ⋮ → Installer l’application. Si « Installer l’application » n’apparaît pas, choisissez « Ajouter à l’écran d’accueil ».")}
 else{alert("Pour installer LiveWave : utilisez le menu de votre navigateur puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».")}
}
 const bell=<button type="button" aria-label="Notifications" className="notif-button" onClick={toggleNotifications}>🔔{unread>0&&<span className="notif-badge">{unread>99?"99+":unread}</span>}</button>;
 const installButton=<button type="button" aria-label="Installer LiveWave" className="install-button" onClick={doInstall}>📲 Installer</button>;
 return <><header className="topbar"><Link className="brand" href="/">Live<span>Wave</span></Link><nav className="nav"><Link href="/live">Lives</Link><Link href="/profile">Profil</Link>{userId&&bell}{installButton}</nav>{open&&userId&&<div className="notification-panel"><div className="notification-title"><b>Notifications</b>{unread>0&&<button type="button" onClick={readAll}>Tout lire</button>}</div>{notes.length?notes.map(n=><div className={"notification-item"+(n.read?"":" unread")} key={n.id}><span>🔔</span><div>{n.body}<small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></div></div>):<div className="muted">Aucune notification.</div>}</div>}</header><nav className="footer-nav"><Link href="/live">🔴<span>Lives</span></Link>{userId?bell:null}{installButton}<Link href="/profile">👤<span>Profil</span></Link></nav>{children}</>;
}