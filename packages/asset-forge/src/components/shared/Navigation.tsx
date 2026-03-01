import {
  Database,
  Wand2,
  Wrench,
  Hand,
  Shield,
  Shuffle,
  Building2,
  FileJson,
  TreePine,
  Mountain,
  Flower2,
  ChevronDown,
  Boxes,
  Globe,
  Route,
  Sprout,
  Gamepad2,
  Image,
  Sparkles,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { ROUTES } from "../../constants";

// Procedural generator menu items
// Note: Leaf Clusters consolidated into Trees
const GENERATOR_ITEMS = [
  { route: ROUTES.BUILDING_GEN, label: "Buildings & Towns", icon: Building2 },
  { route: ROUTES.TERRAIN_GEN, label: "Terrain", icon: Mountain },
  { route: ROUTES.ROADS_GEN, label: "Roads", icon: Route },
  { route: ROUTES.TREE_GEN, label: "Trees", icon: TreePine },
  { route: ROUTES.ROCK_GEN, label: "Rocks", icon: Globe },
  { route: ROUTES.PLANT_GEN, label: "Plants", icon: Flower2 },
  {
    route: ROUTES.VEGETATION_GEN,
    label: "Vegetation (Grass+Flowers)",
    icon: Sprout,
  },
] as const;

const Navigation: React.FC = () => {
  const [generatorMenuOpen, setGeneratorMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const currentPath = location.pathname;

  // Check if current path is a generator route
  const isGeneratorRoute = GENERATOR_ITEMS.some(
    (item) => currentPath === item.route,
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setGeneratorMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinkClass = (route: string) =>
    `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
      currentPath === route
        ? "bg-primary bg-opacity-10 text-primary"
        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
    }`;

  return (
    <nav className="bg-bg-secondary border-b border-border-primary px-6 shadow-theme-sm relative z-[100]">
      <div className="flex items-center justify-between h-[60px]">
        <div className="flex items-center">
          <Link
            to={ROUTES.GENERATION}
            className="text-xl font-semibold text-gradient hover:opacity-80 transition-opacity"
          >
            3D Asset Forge
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={ROUTES.GENERATION}
            className={navLinkClass(ROUTES.GENERATION)}
          >
            <Wand2 size={18} />
            <span>Generate</span>
          </Link>

          <Link to={ROUTES.ASSETS} className={navLinkClass(ROUTES.ASSETS)}>
            <Database size={18} />
            <span>Assets</span>
          </Link>

          {/* Procedural Generators Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
                isGeneratorRoute
                  ? "bg-primary bg-opacity-10 text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`}
              onClick={() => setGeneratorMenuOpen(!generatorMenuOpen)}
            >
              <Boxes size={18} />
              <span>Generators</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${generatorMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {generatorMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-md shadow-lg py-1 min-w-[180px] z-50">
                {GENERATOR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.route}
                      to={item.route}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-base ${
                        currentPath === item.route
                          ? "bg-primary bg-opacity-10 text-primary"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                      }`}
                      onClick={() => setGeneratorMenuOpen(false)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            to={ROUTES.HAND_RIGGING}
            className={navLinkClass(ROUTES.HAND_RIGGING)}
          >
            <Hand size={18} />
            <span>Hand Rigging</span>
          </Link>

          <Link
            to={ROUTES.EQUIPMENT}
            className={navLinkClass(ROUTES.EQUIPMENT)}
          >
            <Wrench size={18} />
            <span>Equipment</span>
          </Link>

          <Link
            to={ROUTES.ARMOR_FITTING}
            className={navLinkClass(ROUTES.ARMOR_FITTING)}
          >
            <Shield size={18} />
            <span>Armor</span>
          </Link>

          <Link
            to={ROUTES.RETARGET_ANIMATE}
            className={navLinkClass(ROUTES.RETARGET_ANIMATE)}
          >
            <Shuffle size={18} />
            <span>Retarget</span>
          </Link>

          <Link
            to={ROUTES.BATCH_SPRITES}
            className={navLinkClass(ROUTES.BATCH_SPRITES)}
          >
            <Image size={18} />
            <span>Batch Sprites</span>
          </Link>

          <Link to={ROUTES.VFX} className={navLinkClass(ROUTES.VFX)}>
            <Sparkles size={18} />
            <span>VFX</span>
          </Link>

          <Link
            to={ROUTES.WORLD_BUILDER}
            className={navLinkClass(ROUTES.WORLD_BUILDER)}
          >
            <Globe size={18} />
            <span>World</span>
          </Link>

          <Link
            to={ROUTES.WORLD_EDITOR}
            className={navLinkClass(ROUTES.WORLD_EDITOR)}
            title="World Editor using real game systems"
          >
            <Gamepad2 size={18} />
            <span>Editor</span>
          </Link>

          <Link
            to={ROUTES.MANIFESTS}
            className={navLinkClass(ROUTES.MANIFESTS)}
          >
            <FileJson size={18} />
            <span>Manifests</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
