import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"LiveWave — Live streaming", description:"Plateforme de lives verticale, sociale et mobile-first." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}