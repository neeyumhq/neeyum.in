"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { formatCurrency, cn } from "@/lib/utils";
import { Search, Filter } from "lucide-react";

import { fetchApi } from "@/lib/api";

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.append('search', searchTerm);
      if (statusFilter) query.append('status', statusFilter);
      if (planFilter) query.append('plan', planFilter);

      const data = await fetchApi(`/admin/subscriptions?${query.toString()}`);
      setStats({
        activePros: data.activePros,
        monthlyRevenue: data.monthlyRevenue,
        yearlyRevenue: data.yearlyRevenue,
        allTimeRevenue: data.allTimeRevenue,
      });
      setUsers(data.users.map((u: any) => ({
        ...u,
        avatar: u.name ? u.name.split(' ').map((n: any) => n[0]).join('').toUpperCase() : '??',
        location: u.country || 'Unknown',
        joined: new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        renewal: u.renewal ? new Date(u.renewal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD',
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, planFilter]);

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 text-red-500">
          <p className="font-bold">Error loading subscriptions</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
          >
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (loading && !users.length) {
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
          label="Active Node Count"
          value={stats?.activePros || 0}
          sublabel="Verified Precision Operators"
          accentColor="purple"
        />
        <StatCard
          label="Monthly Yield"
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          sublabel="Current Cycle Accumulation"
          accentColor="green"
        />
        <StatCard
          label="Yearly Projection"
          value={formatCurrency(stats?.yearlyRevenue || 0)}
          sublabel="2026 Protocol Target"
          accentColor="blue"
        />
        <StatCard
          label="Aggregate Volume"
          value={formatCurrency(stats?.allTimeRevenue || 0)}
          sublabel="Total Network Value"
          accentColor="yellow"
        />
      </div>

      {/* Main Container */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden mb-12 backdrop-blur-sm shadow-2xl">
        {/* Search Header */}
        <div className="p-10 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.01]">
          <div className="relative flex-1 max-w-xl group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-500 transition-colors" />
            <input
              type="text"
              placeholder="Query operator by identity, signal, or protocol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-medium placeholder:text-white/10"
            />
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/[0.03] hover:bg-white/[0.06] px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 text-white outline-none cursor-pointer"
            >
              <option value="" className="bg-[#0A0A0B]">All Status</option>
              <option value="Active" className="bg-[#0A0A0B]">Active</option>
              <option value="Expired" className="bg-[#0A0A0B]">Expired</option>
            </select>
            <select 
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-white/[0.03] hover:bg-white/[0.06] px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 text-white outline-none cursor-pointer"
            >
              <option value="" className="bg-[#0A0A0B]">All Plans</option>
              <option value="Monthly" className="bg-[#0A0A0B]">Monthly</option>
              <option value="Yearly" className="bg-[#0A0A0B]">Yearly</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[250px]">Identity</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[200px]">Protocol ID</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[150px]">Region</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[180px]">Synchronization</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[150px]">Next Cycle</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[120px]">Module</th>
                <th className="px-10 py-6 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-none italic min-w-[120px]">Auth Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group cursor-default">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[18px] bg-white/[0.03] border border-white/5 flex items-center justify-center text-[11px] font-black text-white/20 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-400 transition-all duration-300">
                        {user.avatar}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{user.name}</span>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-xs font-black text-white/20 italic tracking-widest">#{user.id.substring(0, 12)}...</td>
                  <td className="px-10 py-8 text-xs font-bold text-white/40">{user.location}</td>
                  <td className="px-10 py-8 text-xs font-bold text-white/40">{user.joined}</td>
                  <td className="px-10 py-8 text-xs font-bold text-white/40 italic">{user.renewal}</td>
                  <td className="px-10 py-8">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-3 py-1.5 rounded-xl tracking-[0.1em] italic",
                      user.plan === "Yearly" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    )}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-10 py-8">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-4 py-2 rounded-2xl tracking-[0.1em] border",
                      user.status === "Active" ? "bg-green-500/5 text-green-400 border-green-500/10" : "bg-red-500/5 text-red-500 border-red-500/10"
                    )}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Real Plan Breakdown derived from stats */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 backdrop-blur-sm shadow-2xl mt-5">
          <h4 className="text-[10px] font-black text-white/30 tracking-[0.3em] mb-10 uppercase italic">Financial Audit • Yield Stats</h4>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-5 border-b border-white/[0.03] last:border-0 group transition-all duration-300 hover:translate-x-1">
              <span className="text-sm font-bold text-white/60 group-hover:text-white transition-colors uppercase tracking-widest">Active Annual Nodes</span>
              <span className="text-base font-black text-purple-400 italic font-mono">{users.filter(u => u.plan === 'Yearly').length}</span>
            </div>
            <div className="flex items-center justify-between py-5 border-b border-white/[0.03] last:border-0 group transition-all duration-300 hover:translate-x-1">
              <span className="text-sm font-bold text-white/60 group-hover:text-white transition-colors uppercase tracking-widest">Active Monthly Nodes</span>
              <span className="text-base font-black text-blue-400 italic font-mono">{users.filter(u => u.plan === 'Monthly').length}</span>
            </div>
          </div>
        </div>

        {/* Aggregate Yield */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 backdrop-blur-sm shadow-2xl mt-5">
          <h4 className="text-[10px] font-black text-white/30 tracking-[0.3em] mb-10 uppercase italic">System Performance • Net Aggregation</h4>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-5">
              <span className="text-sm font-bold text-white/60 uppercase tracking-tighter">Avg Protocol Yield / Identity</span>
              <span className="text-base font-black text-green-400 italic font-mono">
                {stats.allTimeRevenue && users.length ? formatCurrency(stats.allTimeRevenue / users.length) : "SYNCING..."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
                     }
