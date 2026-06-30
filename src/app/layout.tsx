import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Advoga — OAB 1ª Fase",
  description: "Guia de estudos data-driven para a OAB 1ª fase da Kamile",
};

// Anti-FOUC: aplica a classe `dark` em <html> ANTES do primeiro paint, lendo a
// escolha persistida (localStorage) com fallback para prefers-color-scheme.
// Roda síncrono no <head>, então não há flash de tema errado na hidratação.
const themeScript = `(function(){try{var t=localStorage.getItem('advoga.theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;if(d){e.classList.add('dark')}else{e.classList.remove('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
