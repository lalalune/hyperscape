import Image from "next/image";
import { Button } from "../ui/Button";
import { FadeIn } from "@/lib/motion";
import { GoldDivider } from "./GoldDivider";
import { PUMP_FUN_URL, SOLSCAN_URL } from "@/lib/constants";

export function GoldCTA() {
  return (
    <section className="relative z-[2] overflow-hidden">
      {/* Metallic gold line — TOP edge */}
      <div aria-hidden="true" className="gold-border-line top-0" />

      {/* Top vignette — fade from gold line into the image */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 z-[1] h-16 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, transparent 0%, rgba(11,12,14,0.85) 60%, var(--bg-depth) 100%)",
        }}
      />

      {/* Background image — absolute, fills section */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <Image
          src="/images/gold-cta.png"
          alt=""
          fill
          className="object-cover scale-[1.2] md:scale-[1.15] object-center"
          quality={90}
          loading="lazy"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,12,0.85) 0%, rgba(10,10,12,0.5) 50%, rgba(10,10,12,0.85) 100%)",
          }}
        />
      </div>

      {/* Bottom vignette — fade into footer */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 z-[1] h-16 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(11,12,14,0.85) 60%, var(--bg-depth) 100%)",
        }}
      />

      {/* Content — padding-driven height */}
      <div className="relative z-10 pt-16 sm:pt-20 md:pt-24 pb-16 sm:pb-20 md:pb-24">
        <div className="max-w-4xl mx-auto container-padding text-center cta-glow">
          <FadeIn>
            <div className="relative z-10">
              <GoldDivider wide />

              <h2 className="heading-hero text-shimmer-gold mb-3 mt-4">
                Ready to Get $GOLD?
              </h2>

              <p
                className="font-body text-base sm:text-lg md:text-xl max-w-xl mx-auto mb-8"
                style={{ color: "var(--text-secondary)" }}
              >
                Join the adventure and claim your place among the richest
                players in Hyperia.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                <Button
                  href={PUMP_FUN_URL}
                  external
                  variant="primary"
                  className="px-8 py-4 text-lg animate-glow-pulse btn-sweep"
                  aria-label="Buy $GOLD (opens in new tab)"
                >
                  Buy $GOLD
                </Button>
                <Button
                  href={SOLSCAN_URL}
                  external
                  variant="secondary"
                  className="px-8 py-4 text-lg"
                  aria-label="View contract on Solscan (opens in new tab)"
                >
                  View Contract
                </Button>
              </div>

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cryptocurrency investments carry risk. Do your own research
                before investing.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
