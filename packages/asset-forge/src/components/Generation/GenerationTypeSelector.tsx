import { Package, User } from "lucide-react";
import React from "react";

interface GenerationTypeSelectorProps {
  onSelectType: (type: "item" | "avatar") => void;
}

export const GenerationTypeSelector: React.FC<GenerationTypeSelectorProps> = ({
  onSelectType,
}) => {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary overflow-hidden">
      <div className="bg-bg-primary bg-opacity-50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-border-primary max-w-2xl w-full animate-scale-in">
        <h1 className="text-3xl font-bold text-text-primary text-center mb-2">
          What would you like to create?
        </h1>
        <p className="text-text-secondary text-center mb-8">
          Choose your generation type to get started
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Items Card */}
          <button
            onClick={() => onSelectType("item")}
            className="group relative bg-bg-secondary hover:bg-bg-tertiary border border-border-primary hover:border-primary rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-primary bg-opacity-10 rounded-full flex items-center justify-center group-hover:bg-opacity-20 transition-all">
                <Package size={40} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Items</h2>
              <p className="text-sm text-text-secondary text-center">
                Weapons, armor, tools, consumables, and other game objects
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Weapons
                </span>
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Armor
                </span>
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Tools
                </span>
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  More
                </span>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-secondary opacity-0 group-hover:opacity-5 transition-opacity" />
          </button>

          {/* Avatars Card */}
          <button
            onClick={() => onSelectType("avatar")}
            className="group relative bg-bg-secondary hover:bg-bg-tertiary border border-border-primary hover:border-secondary rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-secondary bg-opacity-10 rounded-full flex items-center justify-center group-hover:bg-opacity-20 transition-all">
                <User size={40} className="text-secondary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">
                Avatars
              </h2>
              <p className="text-sm text-text-secondary text-center">
                Characters, NPCs, and humanoid creatures with rigging support
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Auto-Rigging
                </span>
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Animations
                </span>
                <span className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-tertiary">
                  Humanoid
                </span>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-secondary to-primary opacity-0 group-hover:opacity-5 transition-opacity" />
          </button>
        </div>

        <p className="text-xs text-text-tertiary text-center mt-8">
          Note: Avatar rigging currently supports humanoid/bipedal characters
          only
        </p>
      </div>
    </div>
  );
};
