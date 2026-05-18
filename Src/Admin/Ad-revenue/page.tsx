"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

// No hardcoded mock arrays allowed.

import { fetchApi } from "@/lib/api";

export default function AdRevenuePage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchApi('/admin/ad-revenue');
        setStats({
          today: data.today,
          thisWeek: data.thisWeek,
          thisMonth: data.thisMonth,
          allTime: data.allTime,
          revenueSources: data.revenueBySource,
          chartData: data.trend.map((d: any) => ({
            name: d.date.split('-').slice(1).join('/'),
            value: d.amount
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
          <p className="font-bold">Error loading revenue data</p>
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
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <StatCard
          label="Direct Revenue"
          value={formatCurrency(stats.today)}
          sublabel="Daily Yield Accumulation"
          accentColor="green"
        />
        <StatCard
          label="Weekly Volume"
          value={formatCurrency(stats.thisWeek)}
          sublabel="7-Day Integrated Total"
          accentColor="blue"
        />
        <StatCard
          label="Monthly Cycle"
          value={formatCurrency(stats.thisMonth)}
          sublabel="Current Operational Period"
          accentColor="purple"
        />
        <StatCard
          label="Project All-Time"
          value={formatCurrency(stats.allTime)}
          sublabel="Aggregate System Earnings"
          accentColor="yellow"
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 mb-12 backdrop-blur-sm relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-[10px] font-black text-white/30 tracking-[0.3em] mb-2 uppercase italic">Revenue Intelligence</h3>
            <p className="text-2xl font-black tracking-tight uppercase">Platform Performance Trend</p>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {['Daily', 'Weekly', 'Monthly'].map((tab) => (
              <button key={tab} className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'Daily' ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-white/30 hover:text-white"
              )}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }}
                dy={16}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A0A0A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
                itemStyle={{ color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                animationDuration={2500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: "20px" }} className="grid grid-cols-1 lg:grid-cols-1 gap-12">
        {/* Revenue by Source */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 backdrop-blur-sm shadow-2xl">
          <h4 className="text-[10px] font-black text-white/30 tracking-[0.3em] mb-10 uppercase italic">Revenue Intelligence • Verified Sources</h4>
          <div className="space-y-6">
            {(stats.revenueSources || []).map((item: any) => (
              <div key={item.source} className="flex items-center justify-between py-5 border-b border-white/[0.03] last:border-0 group transition-all duration-300 hover:translate-x-1">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">{item.source}</span>
                  <span className="text-[9px] font-black text-white/10 uppercase tracking-widest italic">Live API Integration Active</span>
                </div>
                <span className="text-base font-black text-purple-400 italic font-mono">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
