import {
  Database,
  Wand2,
  Wrench,
  Hand,
  Shield,
  Gem,
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
  Menu,
  X,
  Anchor,
  BrickWall,
  Landmark,
  LayoutPanelTop,
  Map,
  LogOut,
  User,
  Package,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { useForgeAuth } from "../../auth/ForgeAuthProvider";
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
  { route: ROUTES.DOCK_GEN, label: "Docks", icon: Anchor },
  { route: ROUTES.BRIDGE_GEN, label: "Bridges", icon: BrickWall },
  { route: ROUTES.LANDMARK_GEN, label: "Landmarks", icon: Landmark },
] as const;

const NAV_ITEMS = [
  { route: ROUTES.DASHBOARD, label: "Dashboard", icon: Boxes },
  { route: ROUTES.GENERATION, label: "Generate", icon: Wand2 },
  { route: ROUTES.ASSETS, label: "Assets", icon: Database },
  { route: ROUTES.HAND_RIGGING, label: "Hand Rigging", icon: Hand },
  { route: ROUTES.EQUIPMENT, label: "Equipment", icon: Wrench },
  { route: ROUTES.ARMOR_FITTING, label: "Armor Fitting", icon: Shield },
  { route: ROUTES.RETARGET_ANIMATE, label: "Retarget Animate", icon: Shuffle },
  { route: ROUTES.BATCH_SPRITES, label: "Batch Sprites", icon: Image },
  { route: ROUTES.VFX, label: "VFX", icon: Sparkles },
  { route: ROUTES.WORLD_BUILDER, label: "World Builder", icon: Globe },
  { route: ROUTES.WORLD_EDITOR, label: "World Editor", icon: Gamepad2 },
  { route: ROUTES.WORLD_STUDIO, label: "World Studio", icon: Map },
  { route: ROUTES.UI_LAYOUT_EDITOR, label: "UI Layouts", icon: LayoutPanelTop },
  { route: ROUTES.ASSET_PACKS, label: "Asset Packs", icon: Package },
  { route: ROUTES.MANIFESTS, label: "Manifests", icon: FileJson },
  { route: ROUTES.ARMOR_PIPELINE, label: "Armor v2", icon: Gem },
] as const;

// Active state: subtle Graphite + earned Forge Gold left-edge accent.
// Mirrors UE5 / Apple Pro sidebar treatment — architectural, restrained.
const ACTIVE_CLASSES =
  "relative bg-bg-tertiary text-text-primary before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-primary";
const INACTIVE_CLASSES =
  "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60";

const Navigation: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [generatorsExpanded, setGeneratorsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const currentPath = location.pathname;
  const auth = useForgeAuth();

  // Expand generators section if current route is a generator
  const isGeneratorRoute = GENERATOR_ITEMS.some(
    (item) => currentPath === item.route,
  );

  useEffect(() => {
    if (isGeneratorRoute) setGeneratorsExpanded(true);
  }, [isGeneratorRoute]);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navLinkClass = (route: string) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-300 ease-out ${
      currentPath === route ? ACTIVE_CLASSES : INACTIVE_CLASSES
    }`;

  return (
    <>
      {/* Top bar with hamburger */}
      <div className="h-11 bg-bg-secondary border-b border-border-primary flex items-center px-3 relative z-[100]">
        <button
          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-300 ease-out"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <span className="ml-3 font-display text-sm font-medium text-text-secondary tracking-tight">
          Asset Forge
        </span>

        {/* User info */}
        {auth.authenticated && auth.user?.email?.address && (
          <span className="ml-auto text-xs text-text-tertiary truncate max-w-[200px]">
            {auth.user.email.address}
          </span>
        )}
      </div>

      {/* Backdrop — Obsidian dim, no glass blur */}
      {open && (
        <div
          className="fixed inset-0 bg-bg-primary/70 z-[200] transition-opacity duration-500 ease-out"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar drawer — cinematic slide */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-[280px] bg-bg-secondary border-r border-border-primary z-[201] flex flex-col transition-transform duration-500 ease-out ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border-primary">
          <Link
            to={ROUTES.DASHBOARD}
            className="font-display text-lg font-medium text-text-primary tracking-tight hover:text-primary transition-colors duration-300 ease-out"
          >
            Asset Forge
          </Link>
          <button
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-300 ease-out"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.route}
                to={item.route}
                className={navLinkClass(item.route)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Generators section */}
          <div className="pt-2">
            <button
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-300 ${
                isGeneratorRoute && !generatorsExpanded
                  ? ACTIVE_CLASSES
                  : INACTIVE_CLASSES
              } ease-out`}
              onClick={() => setGeneratorsExpanded(!generatorsExpanded)}
            >
              <Boxes size={18} />
              <span className="flex-1 text-left">Generators</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-300 ${generatorsExpanded ? "rotate-180" : ""} ease-out`}
              />
            </button>

            {generatorsExpanded && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-border-primary pl-2">
                {GENERATOR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.route}
                      to={item.route}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                        currentPath === item.route
                          ? ACTIVE_CLASSES
                          : INACTIVE_CLASSES
                      } ease-out`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Account section */}
        {auth.authenticated && (
          <div className="border-t border-border-primary">
            {/* User profile */}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-bg-tertiary border border-border-primary flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {auth.user?.email?.address?.split("@")[0] ||
                    auth.user?.wallet?.address?.slice(0, 8) ||
                    "User"}
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {auth.user?.email?.address ||
                    auth.user?.wallet?.address ||
                    "Signed in"}
                </p>
              </div>
            </div>

            {/* Sign out button */}
            <div className="px-3 pb-3">
              <button
                className="flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-bg-tertiary transition-all duration-300 w-full ease-out"
                onClick={() => auth.logout()}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Navigation;
