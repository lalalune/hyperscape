/**
 * LoadingScreen.tsx - Game Loading Screen Component
 *
 * Displays loading progress while world initializes and assets load.
 */

import React, { useEffect, useState } from "react";

import { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";

export function LoadingScreen({
  world,
  message,
}: {
  world: World;
  message?: string;
}) {
  const [progress, setProgress] = useState(3); // Start at 3% to show immediate feedback
  const [loadingStage, setLoadingStage] = useState(
    message || "Initializing...",
  );
  const { title, desc, image } = world.settings;

  useEffect(() => {
    let systemsComplete = false;
    let lastProgress = 3; // Match initial state

    const handleProgress = (data: unknown) => {
      const progressData = data as {
        progress: number;
        stage?: string;
        total?: number;
      };

      // Detect if this is system initialization (has stage) or asset loading (no stage, has total)
      if (progressData.stage) {
        // System initialization: takes 0-30% of total progress
        const systemProgress = Math.min(30, (progressData.progress / 100) * 30);
        lastProgress = systemProgress;
        setProgress(systemProgress);
        setLoadingStage(progressData.stage);

        // Mark systems as complete when we hit 100%
        if (progressData.progress === 100) {
          systemsComplete = true;
        }
      } else if (progressData.total !== undefined) {
        // Asset loading: takes 30-100% of total progress
        const assetProgress = 30 + (progressData.progress / 100) * 70;

        // Only update if systems are complete or if this is higher than current progress
        if (systemsComplete || assetProgress > lastProgress) {
          lastProgress = assetProgress;
          setProgress(assetProgress);

          if (progressData.progress < 100) {
            setLoadingStage(
              `Loading assets... (${Math.floor(progressData.progress)}%)`,
            );
          } else {
            setLoadingStage("Finalizing...");
            console.log('[LoadingScreen] Assets at 100%, now waiting for READY event...');
          }
        }
      } else {
        // Simple progress update
        const newProgress = progressData.progress;
        if (newProgress > lastProgress) {
          lastProgress = newProgress;
          setProgress(newProgress);
        }
      }
    };

    world.on(EventType.ASSETS_LOADING_PROGRESS, handleProgress);
    return () => {
      world.off(EventType.ASSETS_LOADING_PROGRESS, handleProgress);
    };
  }, []);

  return (
    <div className="loading-screen absolute inset-0 bg-black flex pointer-events-auto">
      <style>{`
        @keyframes slowZoom {
          0% {
            transform: scale(1);
            filter: blur(0px);
          }
          85% {
            transform: scale(1.18);
            filter: blur(3px);
          }
          100% {
            transform: scale(1.25);
            filter: blur(4px);
          }
        }
        @keyframes swordCross {
          0% {
            transform: rotate(45deg) translateY(20px);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          50% {
            transform: rotate(45deg) translateY(0);
          }
          100% {
            transform: rotate(45deg) translateY(0);
          }
        }
        @keyframes swordCrossReverse {
          0% {
            transform: rotate(-45deg) translateY(20px);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          50% {
            transform: rotate(-45deg) translateY(0);
          }
          100% {
            transform: rotate(-45deg) translateY(0);
          }
        }
        @keyframes swordSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes swordGlow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(100, 150, 255, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(100, 150, 255, 0.8)) drop-shadow(0 0 30px rgba(100, 150, 255, 0.6));
          }
        }
        @keyframes swordFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .loading-image {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          background-image: ${image ? `url(${world.resolveURL((image as { url: string }).url)})` : `url(${world.resolveURL("/preview.jpg")})`};
          animation: slowZoom 40s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
        .loading-shade {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
        }
        .loading-swords {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          margin-top: -80px;
        }
        .loading-swords svg {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .sword-left {
          animation: swordCross 1.5s ease-out forwards, swordGlow 2s ease-in-out infinite 1.5s;
        }
        .sword-right {
          animation: swordCrossReverse 1.5s ease-out forwards, swordGlow 2s ease-in-out infinite 1.5s;
        }
        .sword-center {
          animation: swordFloat 3s ease-in-out infinite, swordSpin 20s linear infinite;
          opacity: 0.3;
        }
        .loading-info {
          position: absolute;
          bottom: 50px;
          left: 50px;
          right: 50px;
          max-width: 28rem;
        }
        .loading-title {
          font-size: 2.4rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 0 0 0.5rem;
        }
        .loading-desc {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          margin: 0 0 20px;
        }
        .loading-stage {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.875rem;
          margin: 0 0 8px;
          font-weight: 500;
          min-height: 1.25rem;
        }
        .loading-progress-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .loading-percentage {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.875rem;
          font-weight: 600;
          min-width: 45px;
          text-align: right;
        }
        .loading-track {
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.15);
          position: relative;
          overflow: hidden;
          flex: 1;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .loading-bar {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: ${Math.max(progress, 0)}%;
          min-width: ${progress > 0 ? "8px" : "0"};
          background: linear-gradient(90deg, #4a90e2, #6496ff, #4a90e2);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 3px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 15px rgba(100, 150, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
        .loading-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.3), transparent);
          border-radius: 3px 3px 0 0;
        }
        @media (max-width: 768px) {
          .loading-info {
            bottom: 30px;
            left: 30px;
            right: 30px;
            max-width: 100%;
          }
          .loading-title {
            font-size: 2rem;
          }
          .loading-desc {
            font-size: 0.9rem;
          }
          .loading-stage {
            font-size: 0.8rem;
          }
          .loading-percentage {
            font-size: 0.8rem;
            min-width: 40px;
          }
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div className="loading-image" />
      <div className="loading-shade" />

      {/* Animated Training Swords */}
      <div className="loading-swords">
        {/* Left Sword */}
        <svg
          className="sword-left"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="swordGradient1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#8b9dc3" />
              <stop offset="50%" stopColor="#c0c0c0" />
              <stop offset="100%" stopColor="#8b9dc3" />
            </linearGradient>
            <linearGradient
              id="handleGradient1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#6b4423" />
              <stop offset="50%" stopColor="#8b5a2b" />
              <stop offset="100%" stopColor="#6b4423" />
            </linearGradient>
          </defs>
          <g transform="translate(100, 100)">
            {/* Blade */}
            <rect
              x="-4"
              y="-80"
              width="8"
              height="100"
              fill="url(#swordGradient1)"
              rx="2"
            />
            <rect
              x="-2"
              y="-80"
              width="4"
              height="100"
              fill="rgba(255,255,255,0.3)"
              rx="1"
            />
            {/* Guard */}
            <rect
              x="-25"
              y="20"
              width="50"
              height="6"
              fill="url(#swordGradient1)"
              rx="3"
            />
            {/* Handle */}
            <rect
              x="-5"
              y="26"
              width="10"
              height="30"
              fill="url(#handleGradient1)"
              rx="2"
            />
            {/* Pommel */}
            <circle cx="0" cy="60" r="8" fill="url(#swordGradient1)" />
          </g>
        </svg>

        {/* Right Sword */}
        <svg
          className="sword-right"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="swordGradient2"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#8b9dc3" />
              <stop offset="50%" stopColor="#c0c0c0" />
              <stop offset="100%" stopColor="#8b9dc3" />
            </linearGradient>
            <linearGradient
              id="handleGradient2"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#6b4423" />
              <stop offset="50%" stopColor="#8b5a2b" />
              <stop offset="100%" stopColor="#6b4423" />
            </linearGradient>
          </defs>
          <g transform="translate(100, 100)">
            {/* Blade */}
            <rect
              x="-4"
              y="-80"
              width="8"
              height="100"
              fill="url(#swordGradient2)"
              rx="2"
            />
            <rect
              x="-2"
              y="-80"
              width="4"
              height="100"
              fill="rgba(255,255,255,0.3)"
              rx="1"
            />
            {/* Guard */}
            <rect
              x="-25"
              y="20"
              width="50"
              height="6"
              fill="url(#swordGradient2)"
              rx="3"
            />
            {/* Handle */}
            <rect
              x="-5"
              y="26"
              width="10"
              height="30"
              fill="url(#handleGradient2)"
              rx="2"
            />
            {/* Pommel */}
            <circle cx="0" cy="60" r="8" fill="url(#swordGradient2)" />
          </g>
        </svg>

        {/* Center Background Sword */}
        <svg
          className="sword-center"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="swordGradient3"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#4a5568" />
              <stop offset="50%" stopColor="#718096" />
              <stop offset="100%" stopColor="#4a5568" />
            </linearGradient>
          </defs>
          <g transform="translate(100, 100)">
            {/* Blade */}
            <rect
              x="-3"
              y="-70"
              width="6"
              height="85"
              fill="url(#swordGradient3)"
              rx="2"
            />
            {/* Guard */}
            <rect
              x="-20"
              y="15"
              width="40"
              height="5"
              fill="url(#swordGradient3)"
              rx="2"
            />
            {/* Handle */}
            <rect x="-4" y="20" width="8" height="25" fill="#2d3748" rx="2" />
            {/* Pommel */}
            <circle cx="0" cy="48" r="6" fill="url(#swordGradient3)" />
          </g>
        </svg>
      </div>

      <div className="loading-info">
        {title && <div className="loading-title">{title}</div>}
        {desc && <div className="loading-desc">{desc}</div>}
        <div className="loading-stage">{loadingStage}</div>
        <div className="loading-progress-container">
          <div className="loading-track">
            <div className="loading-bar" />
          </div>
          <div className="loading-percentage">{Math.floor(progress)}%</div>
        </div>
      </div>
    </div>
  );
}
