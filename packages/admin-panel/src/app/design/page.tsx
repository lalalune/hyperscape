'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function DesignPage() {
  const [switchOn, setSwitchOn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoadingClick = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Kitchen Sink</h1>
        <p className="text-[var(--text-secondary)]">
          Component verification page - Tactical Command Design System
        </p>
      </div>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Button variants and states</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="outline">Outline</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button disabled>Disabled</Button>
            <Button loading={loading} onClick={handleLoadingClick}>
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Status indicators and labels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <Badge size="sm">Small</Badge>
            <Badge size="md">Medium</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
          <CardDescription>Inputs, labels, and toggles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="input-normal">Normal Input</Label>
              <Input id="input-normal" placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-error">Error Input</Label>
              <Input id="input-error" error placeholder="Error state..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-disabled">Disabled Input</Label>
              <Input id="input-disabled" disabled placeholder="Disabled..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-password">Password</Label>
              <Input id="input-password" type="password" placeholder="••••••••" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
            <Label>Toggle Switch: {switchOn ? 'ON' : 'OFF'}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>Card component variations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bracket-corners">
              <CardHeader>
                <CardTitle className="text-base">Bracket Corners</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-secondary)]">
                  This card has tactical bracket corners
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Standard Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-secondary)]">
                  A basic card component
                </p>
              </CardContent>
            </Card>
            
            <Card className="gradient-tactical">
              <CardHeader>
                <CardTitle className="text-base">Gradient Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-secondary)]">
                  Card with tactical gradient
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
          <CardDescription>Theme colors reference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-[var(--bg-primary)] border border-[var(--border-primary)]" />
              <p className="text-xs text-[var(--text-secondary)]">bg-primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-[var(--bg-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">bg-secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-[var(--accent-primary)]" />
              <p className="text-xs text-[var(--text-secondary)]">accent-primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-[var(--accent-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">accent-secondary</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Text styles and hierarchy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h1 className="text-4xl font-bold text-[var(--text-primary)]">Heading 1</h1>
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">Heading 2</h2>
          <h3 className="text-2xl font-semibold text-[var(--text-primary)]">Heading 3</h3>
          <h4 className="text-xl font-semibold text-[var(--text-primary)]">Heading 4</h4>
          <p className="text-base text-[var(--text-primary)]">Body text - primary</p>
          <p className="text-base text-[var(--text-secondary)]">Body text - secondary</p>
          <p className="text-sm text-[var(--text-tertiary)]">Small text - tertiary</p>
          <p className="text-xs text-[var(--text-muted)]">Caption text - muted</p>
        </CardContent>
      </Card>
    </div>
  );
}
