import Image from "next/image";
import { ExternalIcon } from "../icons";
import { CopyAddress } from "./CopyAddress";
import { FadeIn } from "@/lib/motion";
import { PUMP_FUN_URL, SOLSCAN_URL } from "@/lib/constants";

const stats = [
  { label: "Supply", value: "1B" },
  { label: "Network", value: "Solana" },
  { label: "Type", value: "SPL" },
  { label: "Launch", value: "Pump.Fun" },
];

export function TokenHero() {
  return (
    <div className="py-6 sm:py-8 md:py-10">
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <div className="flex-1 text-center md:text-left order-2 md:order-1">
          <FadeIn onScroll={false} delay={0.1}>
            <h1 className="heading-hero mb-2">
              <span className="text-shimmer-gold">$GOLD</span>{" "}
              <span style={{ color: "var(--text-primary)" }}>Token</span>
            </h1>
          </FadeIn>

          <FadeIn onScroll={false} delay={0.15}>
            <p
              className="font-body text-base sm:text-lg md:text-xl max-w-lg mx-auto md:mx-0 mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              The official in-game currency of Hyperia, tokenized on Solana.
              Every token equals exactly 1 gold in-game.
            </p>
          </FadeIn>

          <FadeIn onScroll={false} delay={0.2}>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 sm:gap-5 mb-6">
              {stats.map((stat) => (
                <div key={stat.label} className="stat-panel">
                  <p
                    className="label-upper mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="font-display text-lg sm:text-xl md:text-2xl"
                    style={{
                      color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn onScroll={false} delay={0.25}>
            <CopyAddress />
          </FadeIn>

          <FadeIn onScroll={false} delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <a
                href={PUMP_FUN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sweep inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-display"
                aria-label="Buy $GOLD (opens in new tab)"
              >
                Buy $GOLD
                <ExternalIcon className="w-4 h-4" />
              </a>
              <a
                href={SOLSCAN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-display"
                aria-label="View on Solscan (opens in new tab)"
              >
                View on Solscan
                <ExternalIcon className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>

        <FadeIn
          className="flex-shrink-0 order-1 md:order-2"
          onScroll={false}
          delay={0}
          direction="none"
        >
          <div className="relative token-shine rounded-lg">
            <div
              className="rounded-lg overflow-hidden p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-border-accent) 0%, rgba(139, 105, 20, 0.2) 50%, var(--gold-border-accent) 100%)",
              }}
            >
              <div
                className="rounded-lg overflow-hidden"
                style={{ background: "rgba(11, 12, 14, 0.9)" }}
              >
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64">
                  <Image
                    src="/images/token.png"
                    alt="$GOLD Token"
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 640px) 160px, (max-width: 768px) 192px, (max-width: 1024px) 224px, 256px"
                  />
                </div>
              </div>
            </div>
            <div
              className="absolute inset-[-20%] -z-10 rounded-lg blur-3xl"
              style={{ background: "var(--gold-glow-cta-outer)" }}
              aria-hidden="true"
            />
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
