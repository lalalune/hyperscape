import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { PlayerMigration, WeaponType, EventType } from "@hyperscape/shared";
import type {
  ClientWorld,
  PlayerStats,
  PlayerEquipmentItems,
  PlayerHealth,
} from "../../types";

interface CombatPanelProps {
  world: ClientWorld;
  stats: PlayerStats | null;
  equipment: PlayerEquipmentItems | null;
}

export function CombatPanel({ world, stats, equipment }: CombatPanelProps) {
  const [style, setStyle] = useState<string>("accurate");
  const [cooldown, setCooldown] = useState<number>(0);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [targetHealth, setTargetHealth] = useState<PlayerHealth | null>(null);

  const combatLevel =
    stats?.combatLevel ||
    (stats?.skills ? PlayerMigration.calculateCombatLevel(stats.skills) : 1);
  const inCombat = stats?.inCombat || false;
  const health = stats?.health || { current: 100, max: 100 };
  const attackLevel = stats?.skills?.attack?.level || 1;
  const strengthLevel = stats?.skills?.strength?.level || 1;
  const defenseLevel = stats?.skills?.defense?.level || 1;

  useEffect(() => {
    const playerId = world.entities?.player?.id;
    if (!playerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        getAttackStyleInfo?: (
          id: string,
          cb: (info: { style: string; cooldown?: number }) => void,
        ) => void;
        changeAttackStyle?: (id: string, style: string) => void;
      };
    } | null;

    actions?.actionMethods?.getAttackStyleInfo?.(
      playerId,
      (info: { style: string; cooldown?: number }) => {
        if (info) {
          setStyle(info.style);
          setCooldown(info.cooldown || 0);
        }
      },
    );

    const onUpdate = (data: unknown) => {
      const d = data as { playerId: string; currentStyle: { id: string } };
      if (d.playerId !== playerId) return;
      setStyle(d.currentStyle.id);
    };
    const onChanged = (data: unknown) => {
      const d = data as { playerId: string; currentStyle: { id: string } };
      if (d.playerId !== playerId) return;
      setStyle(d.currentStyle.id);
    };

    // Listen for combat target updates
    const onTargetChanged = (data: unknown) => {
      const d = data as {
        targetId: string | null;
        targetName?: string;
        targetHealth?: PlayerHealth;
      };
      if (d.targetId) {
        setTargetName(d.targetName || d.targetId);
        setTargetHealth(d.targetHealth || null);
      } else {
        setTargetName(null);
        setTargetHealth(null);
      }
    };

    const onTargetHealthUpdate = (data: unknown) => {
      const d = data as { targetId: string; health: PlayerHealth };
      if (d.targetId && targetName) {
        setTargetHealth(d.health);
      }
    };

    world.on(EventType.UI_ATTACK_STYLE_UPDATE, onUpdate, undefined);
    world.on(EventType.UI_ATTACK_STYLE_CHANGED, onChanged, undefined);
    world.on(EventType.UI_COMBAT_TARGET_CHANGED, onTargetChanged, undefined);
    world.on(
      EventType.UI_COMBAT_TARGET_HEALTH,
      onTargetHealthUpdate,
      undefined,
    );

    return () => {
      world.off(
        EventType.UI_ATTACK_STYLE_UPDATE,
        onUpdate,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_ATTACK_STYLE_CHANGED,
        onChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_CHANGED,
        onTargetChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_HEALTH,
        onTargetHealthUpdate,
        undefined,
        undefined,
      );
    };
  }, [world, targetName]);

  const changeStyle = (next: string) => {
    const playerId = world.entities?.player?.id;
    if (!playerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        changeAttackStyle?: (id: string, style: string) => void;
      };
    } | null;

    actions?.actionMethods?.changeAttackStyle?.(playerId, next);
  };

  // Determine if ranged weapon equipped; if so, limit to ranged/defense like RS
  const isRanged = !!(
    equipment?.arrows ||
    (equipment?.weapon &&
      (equipment.weapon.weaponType === WeaponType.BOW ||
        equipment.weapon.weaponType === WeaponType.CROSSBOW))
  );
  const styles: Array<{ id: string; label: string }> = isRanged
    ? [
        { id: "accurate", label: "Ranged" },
        { id: "defensive", label: "Defensive" },
      ]
    : [
        { id: "accurate", label: "Accurate" },
        { id: "aggressive", label: "Aggressive" },
        { id: "defensive", label: "Defensive" },
      ];

  const healthPercent = Math.round((health.current / health.max) * 100);
  const targetHealthPercent = targetHealth
    ? Math.round((targetHealth.current / targetHealth.max) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Player Health Bar */}
      <div className="flex flex-col gap-0.5">
        <div
          className="flex items-center justify-between text-[10px]"
          style={{ color: COLORS.ACCENT }}
        >
          <span className="font-semibold">Hitpoints</span>
          <span>
            {health.current}/{health.max}
          </span>
        </div>
        <div className="w-full bg-black/50 rounded-full h-2.5 border border-white/20 overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${healthPercent}%`,
              background:
                healthPercent > 50
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : healthPercent > 25
                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                    : "linear-gradient(90deg, #ef4444, #dc2626)",
            }}
          />
        </div>
      </div>

      {/* Combat Status */}
      {inCombat && (
        <div
          className="bg-red-900/30 border border-red-500/50 rounded-md p-1 flex items-center gap-1"
          style={{ color: "#fca5a5" }}
        >
          <span className="text-[10px] font-semibold">⚔️ In Combat</span>
        </div>
      )}

      {/* Target Info (when in combat with a target) */}
      {targetName && targetHealth && (
        <div className="flex flex-col gap-0.5 bg-red-900/20 border border-red-500/30 rounded-md p-1">
          <div
            className="flex items-center justify-between text-[9px]"
            style={{ color: "#fca5a5" }}
          >
            <span className="font-semibold">Target: {targetName}</span>
            <span>
              {targetHealth.current}/{targetHealth.max}
            </span>
          </div>
          <div className="w-full bg-black/50 rounded-full h-2 border border-red-500/30 overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${targetHealthPercent}%`,
                background: "linear-gradient(90deg, #ef4444, #dc2626)",
              }}
            />
          </div>
        </div>
      )}

      {/* Combat Stats */}
      <div className="grid grid-cols-3 gap-1">
        <div
          className="bg-black/35 border rounded-md p-1 flex flex-col items-center justify-center"
          style={{ borderColor: "rgba(242, 208, 138, 0.3)" }}
        >
          <div className="text-[9px] text-gray-400">Attack</div>
          <div
            className="font-semibold text-xs"
            style={{ color: COLORS.ACCENT }}
          >
            {attackLevel}
          </div>
        </div>
        <div
          className="bg-black/35 border rounded-md p-1 flex flex-col items-center justify-center"
          style={{ borderColor: "rgba(242, 208, 138, 0.3)" }}
        >
          <div className="text-[9px] text-gray-400">Strength</div>
          <div
            className="font-semibold text-xs"
            style={{ color: COLORS.ACCENT }}
          >
            {strengthLevel}
          </div>
        </div>
        <div
          className="bg-black/35 border rounded-md p-1 flex flex-col items-center justify-center"
          style={{ borderColor: "rgba(242, 208, 138, 0.3)" }}
        >
          <div className="text-[9px] text-gray-400">Defense</div>
          <div
            className="font-semibold text-xs"
            style={{ color: COLORS.ACCENT }}
          >
            {defenseLevel}
          </div>
        </div>
      </div>

      {/* Combat Level */}
      <div
        className="bg-black/35 border rounded-md p-1 flex items-center justify-between text-[10px]"
        style={{
          borderColor: "rgba(242, 208, 138, 0.3)",
          color: COLORS.ACCENT,
        }}
      >
        <div className="font-semibold">Combat level</div>
        <div>{combatLevel}</div>
      </div>

      {/* Attack Style */}
      <div
        className="font-semibold mt-0.5 text-[10px]"
        style={{ color: COLORS.ACCENT }}
      >
        Attack style
      </div>
      <div className="grid grid-cols-2 gap-1">
        {styles.map((s) => (
          <button
            key={s.id}
            onClick={() => changeStyle(s.id)}
            disabled={cooldown > 0}
            className="rounded-md py-1 px-2 cursor-pointer transition-all text-[10px]"
            style={{
              backgroundColor:
                style === s.id
                  ? "rgba(242, 208, 138, 0.15)"
                  : "rgba(0, 0, 0, 0.35)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor:
                style === s.id
                  ? "rgba(242, 208, 138, 0.7)"
                  : "rgba(242, 208, 138, 0.3)",
              color: style === s.id ? COLORS.ACCENT : "#d1d5db",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {cooldown > 0 && (
        <div
          className="text-[9px]"
          style={{ color: "rgba(242, 208, 138, 0.6)" }}
        >
          Style change available in {Math.ceil(cooldown / 1000)}s
        </div>
      )}
    </div>
  );
}
