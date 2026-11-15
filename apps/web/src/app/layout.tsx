export const metadata = { title: "Scootechnology" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0b0c", color: "#f2f2f2", margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
