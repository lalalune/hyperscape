import { FadeIn } from "@/lib/motion";
import { platforms } from "@/lib/gold-data";

export function ValueProps() {
  return (
    <section
      className="relative z-[2] py-4 md:py-8"
      style={{ background: "var(--bg-depth)" }}
    >
      <div className="max-w-3xl mx-auto container-padding space-y-5">
        <FadeIn direction="left">
          <div className="card-premium p-5 sm:p-6">
            <div className="flex items-center gap-5 sm:gap-6">
              <div className="flex-shrink-0 w-14 sm:w-20 text-center">
                <span className="font-display text-3xl sm:text-4xl md:text-5xl text-shimmer-gold">
                  1:1
                </span>
              </div>
              <div className="flex-1">
                <h3
                  className="font-display text-lg sm:text-xl md:text-2xl mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  In-Game Value
                </h3>
                <p
                  className="font-body text-sm sm:text-base"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Every $GOLD token equals exactly 1 gold in Hyperia. Your
                  wallet balance becomes your starting wealth.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn direction="left" delay={0.1}>
          <div className="card-premium p-5 sm:p-6">
            <div className="flex items-center gap-5 sm:gap-6">
              <div className="flex-shrink-0 w-14 sm:w-20 flex justify-center">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: "var(--gold-essence)" }}
                  aria-hidden="true"
                >
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3
                    className="font-display text-lg sm:text-xl md:text-2xl"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Exclusive Items
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      background: "var(--gold-bg-light)",
                      color: "var(--gold-essence)",
                      border: "1px solid var(--gold-border-medium)",
                    }}
                  >
                    Holders Only
                  </span>
                </div>
                <p
                  className="font-body text-sm sm:text-base"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Limited-edition gear and cosmetics available only to $GOLD
                  holders. Stand out from day one.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn direction="left" delay={0.2}>
          <div className="card-premium p-5 sm:p-6">
            <div className="flex items-center gap-5 sm:gap-6">
              <div className="flex-shrink-0 w-14 sm:w-20 flex justify-center gap-1">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ color: "var(--gold-essence)" }}
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ color: "var(--gold-essence)" }}
                  aria-hidden="true"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <path d="M12 18h.01" />
                </svg>
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ color: "var(--gold-essence)" }}
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3
                  className="font-display text-lg sm:text-xl md:text-2xl mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Play Anywhere
                </h3>
                <p
                  className="font-body text-sm sm:text-base mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Hyperia runs on Browser, iOS, Android, and Desktop. Your gold
                  follows you everywhere.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {platforms.map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-0.5 rounded text-xs"
                      style={{
                        background: "rgba(26, 29, 36, 0.9)",
                        color: "var(--text-secondary)",
                        border: "1px solid rgba(90, 95, 105, 0.3)",
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
