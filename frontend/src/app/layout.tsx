import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "./globals.css";
import AppProviders from "./provider";

export const metadata: Metadata = {
  title: "Ascend AI",
  description: "Ascend AI App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f5f2ef] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
