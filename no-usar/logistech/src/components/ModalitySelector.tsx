import React from 'react';
import { Zap, Store, Boxes, Clock, MapPin, Award } from 'lucide-react';
import { ModalityType } from '../types';

interface ModalitySelectorProps {
  currentMode: ModalityType;
  onSelectMode: (mode: ModalityType) => void;
  orderCounts: {
    express: number;
    negocios: number;
    bodega: number;
  };
}

export const ModalitySelector: React.FC<ModalitySelectorProps> = ({
  currentMode,
  onSelectMode,
  orderCounts
}) => {
  return (
    <div className="space-y-2.5">
      {/* 3 Modality Buttons */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
        {/* Exprés */}
        <button
          id="tab-mode-express"
          onClick={() => onSelectMode('express')}
          className={`relative flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            currentMode === 'express'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-200" />
          <span className="truncate">Exprés</span>
          {orderCounts.express > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-tech ${
              currentMode === 'express' ? 'bg-cyan-950 text-cyan-200 border border-cyan-400/40' : 'bg-slate-800 text-cyan-400'
            }`}>
              {orderCounts.express}
            </span>
          )}
        </button>

        {/* Negocios */}
        <button
          id="tab-mode-negocios"
          onClick={() => onSelectMode('negocios')}
          className={`relative flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            currentMode === 'negocios'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Store className="w-4 h-4 text-emerald-200" />
          <span className="truncate">Negocios</span>
          {orderCounts.negocios > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-tech ${
              currentMode === 'negocios' ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/40' : 'bg-slate-800 text-emerald-400'
            }`}>
              {orderCounts.negocios}
            </span>
          )}
        </button>

        {/* Bodega */}
        <button
          id="tab-mode-bodega"
          onClick={() => onSelectMode('bodega')}
          className={`relative flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            currentMode === 'bodega'
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4 text-purple-200" />
          <span className="truncate">Bodega</span>
          {orderCounts.bodega > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-tech ${
              currentMode === 'bodega' ? 'bg-purple-950 text-purple-200 border border-purple-400/40' : 'bg-slate-800 text-purple-400'
            }`}>
              {orderCounts.bodega}
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Formula & Tariff Telemetry Banner */}
      <div className={`p-2.5 rounded-xl border transition-all duration-300 text-xs flex items-center justify-between gap-2 ${
        currentMode === 'express'
          ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
          : currentMode === 'negocios'
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
          : 'bg-purple-950/40 border-purple-500/30 text-purple-200'
      }`}>
        <div className="flex items-center gap-2">
          {currentMode === 'express' && (
            <>
              <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100">Modelo: Distancia / Tiempo</span>
                <p className="text-[11px] text-cyan-300/80 font-mono-tech">Base $3.800 + $1.200/km + $250/min (Pago directo $ COP)</p>
              </div>
            </>
          )}

          {currentMode === 'negocios' && (
            <>
              <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-300">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100">Modelo: Locales y Restaurantes</span>
                <p className="text-[11px] text-emerald-300/80 font-mono-tech">Base $4.200 + $1.400/km + $300/min + Propinas garantizadas</p>
              </div>
            </>
          )}

          {currentMode === 'bodega' && (
            <>
              <div className="p-1 rounded-md bg-purple-500/20 text-purple-300">
                <Award className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100">Modelo: Créditos / Puntos Geográficos</span>
                <p className="text-[11px] text-purple-300/80 font-mono-tech">Base 10 pts + 4 pts/parada consolidada + Bono zona</p>
              </div>
            </>
          )}
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono-tech text-[10px] uppercase px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-300">
            {currentMode === 'bodega' ? 'Créditos Masivos' : 'Liquidación Diario'}
          </span>
        </div>
      </div>
    </div>
  );
};
