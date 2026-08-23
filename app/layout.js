import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata = {
  title: "VoiceLab — Estúdio de Voz IA",
  description: "Estúdio de voz por IA com biblioteca, clonagem autorizada e geração de áudio.",
  applicationName: "VoiceLab",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/api/app-icon/192"
  },
  appleWebApp: {
    capable: true,
    title: "VoiceLab",
    statusBarStyle: "black-translucent"
  }
};

export const viewport = {
  themeColor: "#080b12",
  colorScheme: "dark"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
