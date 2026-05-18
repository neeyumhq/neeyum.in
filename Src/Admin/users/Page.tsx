"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/api";

export default function UsersOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchApi('/admin/stats');
        setStats({
          total: data.totalUsers.toLocaleString(),
          dailyActive: data.activeUsersToday.toLocaleString(),
          proUsers: data.proUsers.toLocaleString(),
          newToday: data.newUsersToday.toLocaleString(),
          churned: data.churnedThisMonth.toLocaleString(),
          chartData: data.dailyActiveUsers.map((d: any) => ({
            name: d.date.split('-').slice(1).join('/'),
            value: d.count
          }))
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 text-red-500">
          <p className="font-bold">Error loading stats</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
          >
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <StatCard
          label="Total Identity Base"
          value={stats.total}
          sublabel="Verified User Accounts"
          accentColor="purple"
        />
        <StatCard
          label="Active Session Trend"
          value={stats.dailyActive}
          sublabel="Real-time Active Operators"
          accentColor="green"
        />
        <StatCard
          label="Pro Tier Protocol"
          value={stats.proUsers}
          sublabel="Active Discipline Mode"
          accentColor="blue"
        />
        <StatCard
          label="New Activations"
          value={stats.newToday}
          sublabel="Today's Registration Signal"
          accentColor="yellow"
        />
      </div>

      {/* Main Chart Section */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-12 mb-12 backdrop-blur-sm relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h3 className="text-[10px] font-black text-white/30 tracking-[0.3em] mb-2 uppercase italic">Growth Metrics</h3>
            <p className="text-2xl font-black tracking-tight uppercase">Daily Active Users — Last 14 Days</p>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {['DAU', 'New Users'].map((tab) => (
              <button key={tab} className={cn(
                "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'DAU' ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-white/30 hover:text-white"
              )}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }}
                dy={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 16 }}
                contentStyle={{
                  backgroundColor: '#0A0A0A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
                itemStyle={{ color: '#fff', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
              />
              <Bar
                dataKey="value"
                fill="#8b5cf6"
                radius={[12, 12, 0, 0]}
                animationDuration={2500}
                animationEasing="ease-out"
                barSize={40}
              >
                {stats.chartData.map((_entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="#8b5cf6"
                    fillOpacity={1 - (index * 0.015)} // Subtle gradient effect
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
        <StatCard label="Churn Signal" value={stats.churned} sublabel="Operational Deficit" accentColor="red" />
        <StatCard label="Pro Density" value={stats.total !== '0' ? ((parseInt(stats.proUsers.replace(/,/g, '')) / parseInt(stats.total.replace(/,/g, ''))) * 100).toFixed(1) + '%' : '0%'} sublabel="Conversion Index" accentColor="purple" />
      </div>
    </AdminLayout>
  );
}
