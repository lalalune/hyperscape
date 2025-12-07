import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Users, Swords, Box, Activity } from 'lucide-react';

const stats = [
  { title: 'Total Users', value: '2,847', change: '+12%', icon: Users },
  { title: 'Characters', value: '4,291', change: '+8%', icon: Swords },
  { title: 'Assets', value: '1,024', change: '+24%', icon: Box },
  { title: 'Active Now', value: '127', change: '+5%', icon: Activity },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-secondary)]">
          Welcome to Hyperscape Admin Panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bracket-corners">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-[var(--accent-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stat.value}
              </div>
              <p className="text-xs text-[var(--color-success)]">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      Player joined the server
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {i} minute{i !== 1 ? 's' : ''} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">CPU Usage</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">32%</span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full">
                <div className="h-2 bg-[var(--color-success)] rounded-full w-[32%]" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">Memory</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">68%</span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full">
                <div className="h-2 bg-[var(--color-warning)] rounded-full w-[68%]" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">Network</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">12%</span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full">
                <div className="h-2 bg-[var(--accent-primary)] rounded-full w-[12%]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
