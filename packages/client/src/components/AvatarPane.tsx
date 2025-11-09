import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AvatarPreview } from "../AvatarPreview";
import { EventType } from "@hyperscape/shared";
import type { ClientWorld } from "../types";

interface AvatarPaneProps {
  world: ClientWorld;
  info: {
    hash: string;
    file: File;
    url: string;
    onEquip: () => void;
    onPlace: () => void;
  };
}

export function AvatarPane({ world, info }: AvatarPaneProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<AvatarPreview | null>(null);
  const [_stats, setStats] = useState<unknown>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const preview = new AvatarPreview(world, viewport);
    previewRef.current = preview;
    preview.load(info.file, info.url).then((stats) => {
      setStats(stats);
    });
    return () => preview.destroy();
  }, [world, info.file, info.url]);
  return (
    <div className="vpane absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-96 bg-dark-bg border border-dark-border backdrop-blur-md rounded-2xl pointer-events-auto flex flex-col text-base overflow-hidden">
      <style>{`
        .vpane-head {
          height: 3.125rem;
          display: flex;
          align-items: center;
          padding: 0 0.3rem 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .vpane-head-title {
          font-size: 1rem;
          font-weight: 500;
          flex: 1;
        }
        .vpane-head-close {
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5d6077;
        }
        .vpane-head-close:hover {
          cursor: pointer;
          color: white;
        }
        .vpane-content {
          flex: 1;
          position: relative;
        }
        .vpane-viewport {
          position: absolute;
          inset: 0;
        }
        .vpane-actions {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 1rem;
        }
        .vpane-action {
          flex-basis: 50%;
          height: 2.5rem;
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          border-radius: 0.5rem;
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
        }
        .vpane-action:hover {
          cursor: pointer;
        }
      `}</style>
      <div className="vpane-head">
        <div className="vpane-head-title">Avatar</div>
        <div
          className="vpane-head-close"
          onClick={() =>
            (world.emit as (e: string, d?: unknown) => void)(
              EventType.UI_AVATAR,
              null,
            )
          }
        >
          <XIcon size={20} />
        </div>
      </div>
      <div className="vpane-content">
        <div className="vpane-viewport" ref={viewportRef}>
          <div className="vpane-actions">
            <div className="vpane-action" onClick={info.onEquip}>
              <span>Equip</span>
            </div>
            <div className="vpane-action" onClick={info.onPlace}>
              <span>Place</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
