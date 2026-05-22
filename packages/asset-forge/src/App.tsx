import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Loader2 } from "lucide-react";

import { ForgeAuthProvider, useForgeAuth } from "./auth/ForgeAuthProvider";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import Navigation from "./components/shared/Navigation";
import NotificationBar from "./components/shared/NotificationBar";
import { WorldStudioLanding } from "./components/WorldStudio/WorldStudioLanding";
import { APP_BACKGROUND_STYLES, ROUTES } from "./constants";
import { ActiveTeamProvider } from "./contexts/ActiveTeamContext";
import { AppProvider } from "./contexts/AppContext";
import { NavigationProvider } from "./contexts/NavigationContext";
import { ArmorFittingPage } from "./pages/ArmorFittingPage";
import { AssetPacksPage } from "./pages/AssetPacksPage";
import { AssetsPage } from "./pages/AssetsPage";
import { BatchSpritesPage } from "./pages/BatchSpritesPage";
import { BuildingGenPage } from "./pages/BuildingGenPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { FlowerGenPage } from "./pages/FlowerGenPage";
import { GenerationPage } from "./pages/GenerationPage";
import { GrassGenPage } from "./pages/GrassGenPage";
import { HandRiggingPage } from "./pages/HandRiggingPage";
// LeafClusterPage consolidated into TreeGenPage - clusters are now auto-generated
import { ManifestsPage } from "./pages/ManifestsPage";
import { PlantGenPage } from "./pages/PlantGenPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TeamsPage } from "./pages/TeamsPage";
import { TeamDetailPage } from "./pages/TeamDetailPage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { RetargetAnimatePage } from "./pages/RetargetAnimatePage";
import { RoadsGenPage } from "./pages/RoadsGenPage";
import { RockGenPage } from "./pages/RockGenPage";
import { TerrainGenPage } from "./pages/TerrainGenPage";
import { TreeGenPage } from "./pages/TreeGenPage";
import { VegetationGenPage } from "./pages/VegetationGenPage";
import { VFXPage } from "./pages/VFXPage";
import { WorldBuilderPage } from "./pages/WorldBuilderPage";
import { WorldEditorPage } from "./pages/WorldEditorPage";
import { DockGenPage } from "./pages/DockGenPage";
import { BridgeGenPage } from "./pages/BridgeGenPage";
import { LandmarkGenPage } from "./pages/LandmarkGenPage";
import { WorldStudioPage } from "./pages/WorldStudioPage";
import { ArmorPipelinePage } from "./pages/ArmorPipelinePage";
import {
  UILayoutEditorPage,
  UILayoutLibraryPanel,
} from "./components/UILayoutEditor";

/** Redirects to /sign-in if the user is not authenticated */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useForgeAuth();
  const location = useLocation();

  if (!auth.ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return <Navigate to={ROUTES.SIGN_IN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** Redirects to /dashboard if the user is already signed in */
function SignInRoute() {
  const auth = useForgeAuth();
  const location = useLocation();

  if (!auth.ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (auth.authenticated) {
    // Redirect to where they were trying to go, or dashboard
    const from =
      (location.state as { from?: { pathname: string } })?.from?.pathname ||
      ROUTES.DASHBOARD;
    return <Navigate to={from} replace />;
  }

  return <WorldStudioLanding />;
}

function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: APP_BACKGROUND_STYLES.gridImage,
            backgroundSize: APP_BACKGROUND_STYLES.gridSize,
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation />
        <NotificationBar />

        <main className="flex-1">
          <Routes>
            {/* Default redirect to dashboard */}
            <Route
              path="/"
              element={<Navigate to={ROUTES.DASHBOARD} replace />}
            />

            {/* Dashboard */}
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />

            {/* Main pages */}
            <Route path={ROUTES.GENERATION} element={<GenerationPage />} />
            <Route
              path={ROUTES.ASSETS}
              element={
                <div className="h-full overflow-hidden">
                  <AssetsPage />
                </div>
              }
            />
            <Route path={ROUTES.EQUIPMENT} element={<EquipmentPage />} />
            <Route path={ROUTES.HAND_RIGGING} element={<HandRiggingPage />} />
            <Route path={ROUTES.ARMOR_FITTING} element={<ArmorFittingPage />} />
            <Route
              path={ROUTES.RETARGET_ANIMATE}
              element={<RetargetAnimatePage />}
            />
            <Route path={ROUTES.BATCH_SPRITES} element={<BatchSpritesPage />} />
            <Route path={ROUTES.VFX} element={<VFXPage />} />
            <Route path={ROUTES.WORLD_BUILDER} element={<WorldBuilderPage />} />
            <Route path={ROUTES.WORLD_EDITOR} element={<WorldEditorPage />} />
            <Route path={ROUTES.MANIFESTS} element={<ManifestsPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
            <Route path={ROUTES.TEAMS} element={<TeamsPage />} />
            <Route path={ROUTES.TEAM_DETAIL} element={<TeamDetailPage />} />
            <Route path={ROUTES.GAME_DETAIL} element={<GameDetailPage />} />
            <Route
              path={ROUTES.ARMOR_PIPELINE}
              element={<ArmorPipelinePage />}
            />
            <Route
              path={ROUTES.UI_LAYOUT_EDITOR}
              element={<UILayoutLibraryPanel />}
            />
            <Route
              path={ROUTES.UI_LAYOUT_ASSET}
              element={<UILayoutEditorPage />}
            />
            <Route path={ROUTES.ASSET_PACKS} element={<AssetPacksPage />} />

            {/* Procedural Generators */}
            <Route path={ROUTES.BUILDING_GEN} element={<BuildingGenPage />} />
            <Route path={ROUTES.TREE_GEN} element={<TreeGenPage />} />
            <Route path={ROUTES.ROCK_GEN} element={<RockGenPage />} />
            <Route path={ROUTES.PLANT_GEN} element={<PlantGenPage />} />
            <Route path={ROUTES.TERRAIN_GEN} element={<TerrainGenPage />} />
            <Route path={ROUTES.ROADS_GEN} element={<RoadsGenPage />} />
            <Route path={ROUTES.GRASS_GEN} element={<GrassGenPage />} />
            <Route path={ROUTES.FLOWER_GEN} element={<FlowerGenPage />} />
            <Route
              path={ROUTES.VEGETATION_GEN}
              element={<VegetationGenPage />}
            />
            <Route path={ROUTES.DOCK_GEN} element={<DockGenPage />} />
            <Route path={ROUTES.BRIDGE_GEN} element={<BridgeGenPage />} />
            <Route path={ROUTES.LANDMARK_GEN} element={<LandmarkGenPage />} />

            {/* World Studio */}
            <Route path={ROUTES.WORLD_STUDIO} element={<WorldStudioPage />} />
            <Route
              path={`${ROUTES.WORLD_STUDIO}/:projectId`}
              element={<WorldStudioPage />}
            />

            {/* Catch-all — branded 404 surface */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ForgeAuthProvider>
      <AppProvider>
        <ActiveTeamProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <NavigationProvider>
                <Routes>
                  {/* Sign-in page — public, redirects to dashboard if already auth'd */}
                  <Route path={ROUTES.SIGN_IN} element={<SignInRoute />} />

                  {/* Everything else requires auth */}
                  <Route
                    path="*"
                    element={
                      <RequireAuth>
                        <AppLayout />
                      </RequireAuth>
                    }
                  />
                </Routes>
              </NavigationProvider>
            </BrowserRouter>
          </ErrorBoundary>
        </ActiveTeamProvider>
      </AppProvider>
    </ForgeAuthProvider>
  );
}

export default App;
