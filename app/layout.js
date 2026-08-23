import "./globals.css";

export const metadata = {
  title: "VoiceLab — Clonador de Voz",
  description: "Clone vozes autorizadas e transforme texto em áudio."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
