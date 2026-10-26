import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Football Scores",description:"Fixtures, results, standings and football match data."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
