"use client";

import Image from "next/image";
import { links } from "@/lib/links";
import { ArrowRightIcon, GitHubIcon } from "../icons";
import { FadeIn } from "@/lib/motion";

type FeatureCardProps = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  delay?: number;
  showGitHub?: boolean;
  imagePosition?: string;
};

function FeatureCard({
  title,
  description,
  imageSrc,
  imageAlt,
  href,
  delay = 0,
  showGitHub = false,
  imagePosition = "center center",
}: FeatureCardProps) {
  const linkHref = href ?? (showGitHub ? links.github : undefined);
  const Wrapper = linkHref ? "a" : "div";
  const wrapperProps = linkHref
    ? {
        href: linkHref,
        target: "_blank" as const,
        rel: "noopener noreferrer" as const,
      }
    : {};

  return (
    <FadeIn delay={delay}>
      <Wrapper
        {...wrapperProps}
        className="feature-card block h-full group"
        aria-label={
          linkHref
            ? `${showGitHub ? "View on GitHub" : `Read more about ${title}`} (opens in new tab)`
            : undefined
        }
      >
        <div className="feature-card-inner relative h-full flex flex-col overflow-hidden rounded-xl transition-all duration-500 ease-out">
          {/* Image container — show full image, no aggressive crop */}
          <div className="feature-card-image relative flex-shrink-0 overflow-hidden aspect-[4/3] bg-[var(--bg-elevated)]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className={`object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]`}
              style={{ objectPosition: imagePosition }}
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>

          {/* Content */}
          <div className="feature-card-content flex flex-1 flex-col p-5 sm:p-6">
            <h3
              className="font-display text-xl sm:text-2xl mb-2 group-hover:text-[var(--gold-essence)] transition-colors duration-300"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h3>
            <p
              className="font-body text-sm sm:text-base leading-relaxed mb-4 flex-grow"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>

            {href && !showGitHub && (
              <span className="inline-flex items-center gap-2 font-body text-sm sm:text-base text-[var(--gold-essence)]">
                Read more
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}

            {showGitHub && (
              <span className="btn-secondary inline-flex items-center gap-2 self-start px-6 py-3">
                <GitHubIcon className="w-5 h-5" />
                View on GitHub
              </span>
            )}
          </div>
        </div>
      </Wrapper>
    </FadeIn>
  );
}

const features: Array<{
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  showGitHub?: boolean;
  imagePosition?: string;
}> = [
  {
    title: "AI That Actually Plays",
    description:
      "ElizaOS-powered agents make real decisions. They grind skills, form strategies, trade items, and interact with players — all autonomously.",
    imageSrc: "/images/ai-image.png",
    imageAlt: "AI agents playing the game autonomously",
    href: "https://hyperia-ai.mintlify.app/guides/ai-agents",
    showGitHub: false,
    imagePosition: "center top",
  },
  {
    title: "Classic Mechanics",
    description:
      "Tick-based combat, skill progression, and equipment systems inspired by the games you love. Built for the web with no downloads required.",
    imageSrc: "/images/classic-image.png",
    imageAlt: "Classic MMORPG combat system",
    href: "https://hyperia-ai.mintlify.app/concepts/combat",
    showGitHub: false,
    imagePosition: "center center",
  },
  {
    title: "Your World, Your Rules",
    description:
      "Open source and extensible. Add NPCs, items, quests, and entire regions through simple manifest files. The community shapes the world.",
    imageSrc: "/images/thumbs-up-guy.png",
    imageAlt: "Open source game character giving thumbs up",
    href: links.github,
    showGitHub: true,
    imagePosition: "center center",
  },
];

export function Features() {
  return (
    <section
      className="relative"
      style={{ padding: "var(--spacing-section) 0" }}
    >
      <div className="max-w-6xl mx-auto container-padding">
        <FadeIn className="text-center mb-12 md:mb-16 lg:mb-20">
          <p
            className="label-upper mb-3"
            style={{ color: "var(--gold-essence)" }}
          >
            Why Hyperia
          </p>
          <h2 className="heading-section text-shimmer-gold mb-4">
            A New Kind of World
          </h2>
          <div className="divider-gold mx-auto max-w-xs" aria-hidden="true">
            <span className="w-1.5 h-1.5 rotate-45 bg-[var(--gold-dim)] shrink-0" />
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              imageSrc={feature.imageSrc}
              imageAlt={feature.imageAlt}
              href={feature.href}
              delay={index * 0.1}
              showGitHub={feature.showGitHub}
              imagePosition={feature.imagePosition}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
