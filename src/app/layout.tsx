import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Təchizat ERP", description: "Təchizat idarəetmə sistemi" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="az"><body>{children}</body></html>; }
