import type { Metadata, Viewport } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ComplianceNotice from "../components/ComplianceNotice";
import AmbientBackground from "../components/AmbientBackground";
import VitalsProbe from "../components/VitalsProbe";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Lab by Liliya — Global Anomaly Map (Georgia State Intelligence)",
  description: "Post-Doctorate Cognitive Market Intelligence & Microstructure Research: Real-time Georgia State Telemetry Anomaly Detection & Competitor Exploitation Platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#120e18] text-[#f5effa] min-h-screen flex flex-col font-sans antialiased selection:bg-[#d66ea5] selection:text-white relative">
        <AmbientBackground />
        <VitalsProbe />
        <ComplianceNotice />
        <Navbar />
        <main className="flex-1 pb-12 relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
