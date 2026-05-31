/**
 * Login Screen Component
 * Shown before world loads to authenticate users
 */

import React from "react";
import { auth0AuthControls } from "@/auth/Auth0AuthProvider";
import { useThemeStore } from "@/ui";

export function LoginScreen() {
  const theme = useThemeStore((s) => s.theme);
  const loginGold = "#d4b06a";
  const loginGoldBright = "#f0d59a";
  const loginGoldSoft = "#b89354";
  const authenticated = false;
  const isLoggingIn = false;
  const enterWorld = () => {
    void auth0AuthControls.login();
  };

  // Show login UI if not authenticated and not auto-logging in
  if (!authenticated && !isLoggingIn) {
    return (
      <div className="login-screen">
        <style>{`
          .login-screen {
            position: fixed;
            inset: 0;
            background: linear-gradient(${theme.colors.background.overlay}, ${theme.colors.background.overlay}),
                        url('/images/app_background.png') center/cover no-repeat;
            background-color: ${theme.colors.background.primary};
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${theme.colors.text.primary};
            font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
          }
          .login-content {
            text-align: center;
            max-width: 600px;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 80vh;
          }
          .login-logo {
            width: 400px;
            height: auto;
            margin: 2rem auto 1.5rem;
            filter: drop-shadow(0 0 35px ${loginGold}b3)
                    drop-shadow(0 0 70px ${loginGold}80);
          }
          .login-tagline {
            font-size: 1.2rem;
            color: ${loginGoldBright};
            letter-spacing: 0.15em;
            font-weight: 300;
            text-transform: uppercase;
            text-shadow: 0 0 10px ${loginGoldSoft}4d,
                         0 0 20px ${loginGoldSoft}33;
            margin-bottom: 0;
          }
          .login-bottom {
            margin-bottom: 4rem;
          }
          .login-subtitle {
            font-size: 1.2rem;
            color: ${theme.colors.text.secondary};
            margin-bottom: 2rem;
            letter-spacing: 0.05em;
          }
          .login-button-wrapper {
            position: relative;
            display: inline-block;
            overflow: hidden;
          }
          .login-button-wrapper::before,
          .login-button-wrapper::after {
            content: '';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 350px;
            height: 1px;
            background: linear-gradient(90deg,
              transparent 0%,
              ${loginGoldSoft}1a 5%,
              ${loginGoldSoft}99 30%,
              ${loginGoldBright}e6 50%,
              ${loginGoldSoft}99 70%,
              ${loginGoldSoft}1a 95%,
              transparent 100%);
            box-shadow: 0 0 8px ${loginGoldSoft}66,
                        0 0 15px ${loginGoldSoft}33;
            transition: all 0.3s ease;
            pointer-events: none;
          }
          .login-button-wrapper::before {
            top: 0;
          }
          .login-button-wrapper::after {
            bottom: 0;
          }
          .login-button-ornament {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 50px;
            background: radial-gradient(ellipse at center,
              rgba(0, 0, 0, 0.5) 0%,
              rgba(0, 0, 0, 0.3) 40%,
              rgba(0, 0, 0, 0.1) 70%,
              transparent 100%);
            pointer-events: none;
            z-index: 1;
          }
          .login-button-highlight {
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 80%;
            transform: translateY(-50%) translateX(-100%);
            background: linear-gradient(90deg,
              transparent 0%,
              ${loginGoldSoft}00 30%,
              ${loginGoldSoft}26 50%,
              ${loginGoldSoft}00 70%,
              transparent 100%);
            opacity: 0;
            transition: all 0.6s ease;
            pointer-events: none;
            z-index: 2;
          }
          .login-button {
            background: transparent;
            border: none;
            color: ${loginGoldBright};
            padding: 0.75rem 2rem;
            font-size: 1.4rem;
            font-weight: 400;
            letter-spacing: 0.2em;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: capitalize;
            position: relative;
            font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
            text-shadow: 0 0 12px ${loginGoldSoft}80,
                         0 0 25px ${loginGoldSoft}4d;
            z-index: 3;
            filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.8))
                    drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
            min-width: 350px;
          }
          .login-button:hover {
            color: ${loginGoldBright};
            text-shadow: 0 0 18px ${loginGoldBright}b3,
                         0 0 35px ${loginGoldSoft}80;
            transform: scale(1.03);
          }
          .login-button:active {
            transform: scale(0.98);
            color: ${loginGold};
            text-shadow: 0 0 25px ${loginGoldBright}e6,
                         0 0 50px ${loginGoldSoft}99;
          }
          .login-button-wrapper:hover::before,
          .login-button-wrapper:hover::after {
            background: linear-gradient(90deg,
              transparent 0%,
              ${loginGoldSoft}26 5%,
              ${loginGoldBright}b3 30%,
              ${loginGoldBright} 50%,
              ${loginGoldBright}b3 70%,
              ${loginGoldSoft}26 95%,
              transparent 100%);
            box-shadow: 0 0 12px ${loginGoldBright}80,
                        0 0 20px ${loginGoldSoft}4d;
          }
          .login-button-wrapper:hover .login-button-highlight {
            opacity: 1;
            transform: translateY(-50%) translateX(100%);
          }
          .login-button-wrapper:active .login-button-highlight {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
            background: radial-gradient(ellipse at center,
              ${loginGoldSoft}4d 0%,
              ${loginGoldSoft}26 50%,
              transparent 100%);
          }
          .farcaster-badge {
            display: inline-block;
            background: rgba(138, 99, 210, 0.2);
            border: 1px solid rgba(138, 99, 210, 0.4);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.9rem;
          }
        `}</style>
        <div className="login-content">
          <div>
            <img src="/images/logo.png" alt="Gaia" className="login-logo" />
            <div className="login-tagline">A 3D multiplayer RPG adventure</div>
          </div>
          <div className="login-bottom">
            <div className="login-button-wrapper">
              <div className="login-button-ornament"></div>
              <div className="login-button-highlight"></div>
              <button className="login-button" onClick={enterWorld}>
                Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading during authentication
  return (
    <div className="login-screen">
      <style>{`
        .login-screen {
          position: fixed;
          inset: 0;
          background: linear-gradient(${theme.colors.background.overlay}, ${theme.colors.background.overlay}),
                      url('/images/app_background.png') center/cover no-repeat;
          background-color: ${theme.colors.background.primary};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${theme.colors.text.primary};
          font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
        }
        .login-content {
          text-align: center;
          max-width: 600px;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 80vh;
        }
        .login-logo {
          width: 350px;
          height: auto;
          margin: 2rem auto 0;
          filter: drop-shadow(0 0 30px ${theme.colors.accent.primary}99)
                  drop-shadow(0 0 60px ${theme.colors.accent.primary}66);
        }
        .login-bottom {
          margin-bottom: 4rem;
        }
        .login-subtitle {
          font-size: 1.1rem;
          color: ${theme.colors.text.secondary};
          margin-bottom: 2rem;
          letter-spacing: 0.05em;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid ${theme.colors.accent.primary}33;
          border-top-color: ${theme.colors.accent.primary};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="login-content">
        <img src="/images/logo.png" alt="Gaia" className="login-logo" />
        <div className="login-bottom">
          <div className="login-subtitle">Entering the world...</div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    </div>
  );
}
