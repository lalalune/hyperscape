import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Globe,
  User,
  MapPin,
  Activity,
  Upload,
  Link,
  Eye,
  Move,
  Hammer,
} from "lucide-react";

interface WorldStatus {
  connected: boolean;
  worldId: string;
  worldName: string;
  playerCount: number;
  wsUrl: string;
}

interface AgentPosition {
  x: number;
  y: number;
  z: number;
}

interface AgentStatus {
  position: AgentPosition;
  currentAction: string;
  recentPerceptions: string[];
  emoteActive: string | null;
}

interface AvatarInfo {
  url: string;
  name: string;
}

export function HyperscapeDashboard() {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [worldUrl, setWorldUrl] = useState("");

  // Fetch world status
  const { data: worldStatus, isLoading: worldLoading } = useQuery<WorldStatus>({
    queryKey: ["hyperscape-world-status"],
    queryFn: async () => {
      const response = await fetch("/api/hyperscape/world-status");
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch agent status
  const { data: agentStatus, isLoading: agentLoading } = useQuery<AgentStatus>({
    queryKey: ["hyperscape-agent-status"],
    queryFn: async () => {
      const response = await fetch("/api/hyperscape/agent-status");
      return response.json();
    },
    refetchInterval: 1000,
  });

  // Fetch avatar info
  const { data: avatarInfo } = useQuery<AvatarInfo>({
    queryKey: ["hyperscape-avatar-info"],
    queryFn: async () => {
      const response = await fetch("/api/hyperscape/avatar-info");
      return response.json();
    },
  });

  const handleJoinWorld = async () => {
    if (!worldUrl) {
      return;
    }

    await fetch("/api/hyperscape/join-world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: worldUrl }),
    });
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      return;
    }

    const formData = new FormData();
    formData.append("avatar", avatarFile);

    await fetch("/api/hyperscape/upload-avatar", {
      method: "POST",
      body: formData,
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes("PERCEPTION")) {
      return <Eye className="w-4 h-4" />;
    }
    if (action.includes("GOTO") || action.includes("WALK")) {
      return <Move className="w-4 h-4" />;
    }
    if (action.includes("EDIT") || action.includes("BUILD")) {
      return <Hammer className="w-4 h-4" />;
    }
    return <Activity className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hyperscape Plugin Dashboard</h1>
        <Badge variant={worldStatus?.connected ? "success" : "default"}>
          {worldStatus?.connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* World Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              World Status
            </CardTitle>
            <CardDescription>Current world connection</CardDescription>
          </CardHeader>
          <CardContent>
            {worldLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : worldStatus?.connected ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">World:</span>{" "}
                  {worldStatus.worldName}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Players:</span>{" "}
                  {worldStatus.playerCount}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {worldStatus.wsUrl}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not connected to any world
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agent Position Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Agent Position
            </CardTitle>
            <CardDescription>Current location in world</CardDescription>
          </CardHeader>
          <CardContent>
            {agentLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : agentStatus && agentStatus.position ? (
              <div className="space-y-2">
                <div className="font-mono text-sm">
                  X: {agentStatus.position.x.toFixed(2)}
                </div>
                <div className="font-mono text-sm">
                  Y: {agentStatus.position.y.toFixed(2)}
                </div>
                <div className="font-mono text-sm">
                  Z: {agentStatus.position.z.toFixed(2)}
                </div>
                {agentStatus.currentAction && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {getActionIcon(agentStatus.currentAction)}
                    <span className="text-sm">{agentStatus.currentAction}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No position data</p>
            )}
          </CardContent>
        </Card>

        {/* Avatar Manager Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Avatar Manager
            </CardTitle>
            <CardDescription>Manage agent appearance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatarInfo?.url} />
                  <AvatarFallback>
                    {avatarInfo?.name?.[0] || "A"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{avatarInfo?.name || "Agent"}</p>
                  <p className="text-sm text-muted-foreground">
                    Current avatar
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar-upload">Upload new avatar</Label>
                <div className="flex gap-2">
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept=".vrm"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleUploadAvatar}
                    disabled={!avatarFile}
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Perceptions Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Recent Perceptions
            </CardTitle>
            <CardDescription>What the agent has observed</CardDescription>
          </CardHeader>
          <CardContent>
            {agentStatus?.recentPerceptions &&
            agentStatus.recentPerceptions.length > 0 ? (
              <ul className="space-y-2">
                {agentStatus.recentPerceptions.map((perception, index) => (
                  <li key={index} className="text-sm p-2 bg-muted rounded">
                    {perception}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent perceptions
              </p>
            )}
          </CardContent>
        </Card>

        {/* Join World Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="w-5 h-5" />
              Join World
            </CardTitle>
            <CardDescription>Connect to a Hyperscape world</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="world-url">World URL</Label>
                <Input
                  id="world-url"
                  type="url"
                  placeholder="wss://world.hyperscape.xyz/ws"
                  value={worldUrl}
                  onChange={(e) => setWorldUrl(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleJoinWorld}
                disabled={!worldUrl || worldStatus?.connected}
              >
                {worldStatus?.connected ? "Already Connected" : "Join World"}
              </Button>
              {worldStatus?.connected && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `https://hyperscape.xyz/world/${worldStatus.worldId}`,
                      "_blank",
                    )
                  }
                >
                  Open in Browser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
