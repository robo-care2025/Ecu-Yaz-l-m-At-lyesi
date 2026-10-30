import "./globals.css";

export const metadata = {
  title: "ECU Yazılım Atölyesi",
  description: "ECU programlama ve tamiri, elektrikli scooter ve bisiklet batarya / BMS onarımı.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
