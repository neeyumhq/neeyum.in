"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/admin/users");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 selection:bg-purple-500/30 overflow-hidden relative font-sans">
      {/* Animated Background Mesh */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 z-1 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />
      <div className="absolute inset-0 z-1 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Header Section */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/[0.03] border border-white/10 mb-6 backdrop-blur-sm relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent group-hover:opacity-100 opacity-0 transition-opacity duration-500" />
            <ShieldCheck className="w-8 h-8 text-purple-500 relative z-10" />
          </motion.div>

          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
            Neeyum <span className="text-purple-600 underline decoration-purple-500/30 decoration-4 underline-offset-4">Lab</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="h-[1px] w-4 bg-white/10" />
            <p className="text-white/40 font-bold tracking-[0.3em] text-[9px] uppercase">Command Center</p>
            <span className="h-[1px] w-4 bg-white/10" />
          </div>
        </div>

        {/* Main Interface */}
        <div className="relative" style={{ margin: '40px auto' }}>
          {/* Box Glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-white/10 to-transparent rounded-[48px] opacity-100 z-0" />

          <div 
            style={{ padding: '60px', backgroundColor: 'rgba(10, 10, 10, 0.8)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '48px', backdropFilter: 'blur(40px)', position: 'relative', zIndex: 10, boxShadow: '0 32px 64px -12px rgba(0,0,0,0.8)' }}
          >
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="text-[10px] font-black text-white/30 tracking-widest uppercase ml-1 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  Operator Identity
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@neeyum.in"
                  required
                  style={{ padding: '20px 24px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', width: '100%', outline: 'none', transition: 'all 0.3s' }}
                  className="focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 font-medium placeholder:text-white/10"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="text-[10px] font-black text-white/30 tracking-widest uppercase ml-1 flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  Access Key
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{ padding: '20px 24px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', width: '100%', outline: 'none', transition: 'all 0.3s' }}
                  className="focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 font-medium placeholder:text-white/10"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171' }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: '12px', padding: '24px', backgroundColor: 'white', border: 'none', borderRadius: '16px', color: 'black', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.5s', position: 'relative', overflow: 'hidden' }}
                className="hover:bg-purple-600 hover:text-white disabled:bg-white/50 group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Initialize Session
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-white/20 tracking-widest uppercase">
              <Zap className="w-3 h-3 text-purple-500/40" />
              Ver. 2.0.4 - RC
            </span>
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <span className="text-[9px] font-bold text-white/20 tracking-widest uppercase">
              SSL SECURED
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
