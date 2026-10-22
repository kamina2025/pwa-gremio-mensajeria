import React from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Volume2, 
  VolumeX, 
  Download, 
  Navigation, 
  BatteryMedium,
  ShieldCheck
} from 'lucide-react';
import { CourierProfile } from '../types';
import { soundFx } from '../utils/soundFx';

interface HeaderProps {
  courier: CourierProfile;
  onToggleOnline: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  deferredPrompt: any;
  onInstallPwa: () => void;
  activeOrderCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  courier,
  onToggleOnline,
  isMuted,
  onToggleMute,
  deferredPrompt,
  onInstallPwa,
  activeOrderCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Telemetry */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
            {courier.isOnline && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-display font-bold text-base tracking-wider text-slate-100 uppercase">
                LOGIS<span className="text-cyan-400">TECH</span> <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono-tech">PRO</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono-tech">
              <span className="flex items-center gap-1 text-slate-300">
                <Navigation className="w-3 h-3 text-cyan-400" /> GPS 3D FIX
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <BatteryMedium className="w-3 h-3 text-emerald-400" /> {courier.batteryLevel}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* PWA Install Button */}
          {deferredPrompt && (
            <button
              id="btn-install-pwa"
              onClick={onInstallPwa}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
              title="Instalar PWA en tu dispositivo"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar App</span>
            </button>
          )}

          {/* Sound Mute Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={() => {
              onToggleMute();
              soundFx.playRadarAlert();
            }}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title={isMuted ? 'Activar Sonidos' : 'Silenciar'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {/* Online/Offline Toggle Pill */}
          <button
            id="btn-toggle-online"
            onClick={onToggleOnline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-mono-tech border transition-all duration-300 ${
              courier.isOnline
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25'
            }`}
          >
            {courier.isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span>DISPONIBLE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>EN PAUSA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
