import type { Metadata } from "next";

export const dynamic = "force-static";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GoldToken } from "@/components/GoldToken/GoldToken";
import { Background } from "@/components/Background";

export const metadata: Metadata = {
  title: "$GOLD Token",
  description:
    "The official token of Hyperia. 1 $GOLD = 1 gold in-game. Be the richest player at launch and get exclusive items.",
  openGraph: {
    title: "$GOLD Token",
    description:
      "The official token of Hyperia. 1 $GOLD = 1 gold in-game. Be the richest player at launch and get exclusive items.",
  },
  alternates: {
    canonical: "https://hyperia.club/gold/",
  },
};

export default function GoldPage() {
  return (
    <>
      <Background image="/images/gold_background.png" />
      <Header />
      <main id="main-content" className="relative z-10">
        <GoldToken />
        <Footer />
      </main>
    </>
  );
}
