import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Store, 
  Boxes, 
  Navigation, 
  MapPin, 
  Clock, 
  DollarSign, 
  Award, 
  ShieldCheck, 
  X, 
  Check, 
  AlertCircle,
  PackageCheck
} from 'lucide-react';
import { DeliveryOrder } from '../types';
import { soundFx } from '../utils/soundFx';

interface NewOrderIncomingModalProps {
  order: DeliveryOrder | null;
  onAccept: (order: DeliveryOrder) => void;
  onReject: (orderId: string) => void;
}

export const NewOrderIncomingModal: React.FC<NewOrderIncomingModalProps> = ({
  order,
  onAccept,
  onReject
}) => {
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    if (!order) return;
    setTimeLeft(25);
    soundFx.playRadarAlert();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject(order.id);
          return 0;
        }
        if (prev % 3 === 0) {
          soundFx.playRadarAlert();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, onReject]);

  if (!order) return null;

  const isBodega = order.modality === 'bodega';
  const isNegocios = order.modality === 'negocios';

  const accentColor = isBodega 
    ? 'from-purple-500 to-indigo-600 border-purple-400 text-purple-400' 
    : isNegocios 
    ? 'from-emerald-500 to-teal-600 border-emerald-400 text-emerald-400' 
    : 'from-cyan-500 to-blue-600 border-cyan-400 text-cyan-400';

  const progressPercent = (timeLeft / 25) * 100;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`relative w-full max-w-md bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl ${
            isBodega 
              ? 'border-purple-500/50 shadow-purple-500/20 glow-purple' 
              : isNegocios 
              ? 'border-emerald-500/50 shadow-emerald-500/20' 
              : 'border-cyan-500/50 shadow-cyan-500/20 glow-cyan'
          }`}
        >
          {/* Top Urgent Header */}
          <div className={`p-4 bg-gradient-to-r ${accentColor} text-white flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-black/25 backdrop-blur-sm">
                {isBodega ? <Boxes className="w-5 h-5" /> : isNegocios ? <Store className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono-tech uppercase font-bold tracking-widest text-white/90">
                    ¡NUEVA ASIGNACIÓN!
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 text-white font-mono-tech">
                    {order.code}
                  </span>
                </div>
                <h3 className="font-bold text-sm tracking-wide line-clamp-1">{order.title}</h3>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-black/40 border border-white/20">
              <span className="text-xs font-bold font-mono-tech leading-none">{timeLeft}s</span>
              <span className="text-[9px] uppercase tracking-wider text-white/70">Radar</span>
            </div>
          </div>

          {/* Time Countdown Progress Line */}
          <div className="w-full bg-slate-800 h-1.5">
            <motion.div
              className={`h-full ${isBodega ? 'bg-purple-400' : isNegocios ? 'bg-emerald-400' : 'bg-cyan-400'}`}
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear', duration: 1 }}
            />
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4">
            {/* Price / Pts Tag Big */}
            <div className="flex items-center justify-between bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <p className="text-xs text-slate-400 uppercase font-mono-tech">
                  {isBodega ? 'Recompensa en Puntos' : 'Ganancia Estimada'}
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  {isBodega ? (
                    <>
                      <span className="text-3xl font-black text-purple-400 font-mono-tech">
                        +{order.pricePoints}
                      </span>
                      <span className="text-sm font-semibold text-purple-300">pts</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-black text-emerald-400 font-mono-tech">
                        ${order.priceCash?.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-mono-tech text-slate-400">COP</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-slate-300 text-xs font-mono-tech">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{order.distanceKm} km</span>
                </div>
                <div className="flex items-center justify-end gap-1 text-slate-400 text-xs font-mono-tech mt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>~{order.estimatedMinutes} min</span>
                </div>
              </div>
            </div>

            {/* Route Stops / Waypoints Preview */}
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              {/* Pickup */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono-tech">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono-tech text-cyan-400 uppercase">Recoger en:</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">{order.pickupLocation.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{order.pickupLocation.address}</p>
                </div>
              </div>

              <div className="ml-3 border-l-2 border-dashed border-slate-700 h-3" />

              {/* Delivery or Multiple Drops for Bodega */}
              {isBodega && order.stops && order.stops.length > 0 ? (
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono-tech">
                    {order.stops.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono-tech text-purple-400 uppercase">
                      Ruta Masiva: {order.stops.length} Puntos Geográficos
                    </p>
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {order.stops[0].address} (+{order.stops.length - 1} más)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono-tech">
                    B
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono-tech text-emerald-400 uppercase">Entregar en:</p>
                    <p className="text-xs font-semibold text-slate-200 truncate">{order.deliveryLocation.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{order.deliveryLocation.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Package info & Payment details */}
            <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 px-3 py-2 rounded-xl">
              <span className="flex items-center gap-1.5 truncate">
                <PackageCheck className="w-4 h-4 text-slate-400" />
                <span className="truncate">{order.packageDescription}</span>
              </span>
              {order.tip && order.tip > 0 && (
                <span className="shrink-0 text-amber-300 font-semibold font-mono-tech bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  +${order.tip.toLocaleString('es-CO')} Propina
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                id="btn-reject-order"
                onClick={() => onReject(order.id)}
                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition active:scale-95"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Rechazar</span>
              </button>

              <button
                id="btn-accept-order"
                onClick={() => {
                  soundFx.playAcceptChime();
                  onAccept(order);
                }}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-bold text-sm text-white shadow-xl transition active:scale-95 ${
                  isBodega
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/40'
                    : isNegocios
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/40'
                }`}
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>¡ACEPTAR!</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
