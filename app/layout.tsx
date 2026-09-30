import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";
export const metadata: Metadata = { title:"LiveWave — Live streaming", description:"Plateforme de lives verticale, sociale et mobile-first.", manifest:"/manifest.webmanifest", themeColor:"#ff2d68", appleWebApp:{capable:true,title:"LiveWave",statusBarStyle:"black-translucent"} };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><AppShell>{children}</AppShell></body></html>}