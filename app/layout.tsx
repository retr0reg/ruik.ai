import type { Metadata } from "next";
import "./globals.css";
import "prismjs/themes/prism-tomorrow.css";

export const metadata: Metadata = {
  title: "Ruikai Peng",
  description: "16-year-old researcher & founder working on deep security and machine learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
