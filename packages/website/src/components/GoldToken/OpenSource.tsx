import { GitHubIcon, ExternalIcon } from "../icons";
import { FadeIn } from "@/lib/motion";
import { GITHUB_URL } from "@/lib/constants";

export function OpenSource() {
  return (
    <section
      className="relative z-[2] py-10 md:py-14"
      style={{ background: "var(--bg-depth)" }}
    >
      <div className="max-w-3xl mx-auto container-padding">
        <FadeIn>
          <div className="card-premium p-6 sm:p-8 text-center">
            <GitHubIcon
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-4"
              style={{ color: "var(--text-primary)" }}
            />
            <h2
              className="font-display text-xl sm:text-2xl md:text-3xl mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              100% Open Source
            </h2>
            <p
              className="font-body text-sm sm:text-base md:text-lg max-w-md mx-auto mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Hyperia is fully open source. Contribute to the first AI-native
              MMORPG and help shape the future of gaming.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2 px-6 py-3 text-base font-display"
              aria-label="View on GitHub (opens in new tab)"
            >
              View on GitHub
              <ExternalIcon className="w-4 h-4" />
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
