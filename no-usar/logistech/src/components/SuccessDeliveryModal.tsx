import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { CheckCircle, DollarSign, Award, ArrowRight, ShieldCheck, Star } from 'lucide-react';
import { DeliveryOrder } from '../types';
import { soundFx } from '../utils/soundFx';

interface SuccessDeliveryModalProps {
  order: DeliveryOrder | null;
  onDismiss: () => void;
}

export const SuccessDeliveryModal: React.FC<SuccessDeliveryModalProps> = ({
  order,
  onDismiss
}) => {
  useEffect(() => {
    if (!order) return;

    soundFx.playSuccessFanfare();

    // Trigger high-tech confetti explosion
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: order.modality === 'bodega' 
          ? ['#a855f7', '#6366f1', '#ec4899'] 
          : ['#06b6d4', '#10b981', '#3b82f6']
      });
    } catch {
      // Confetti fallback
    }
  }, [order]);

  if (!order) return null;

  const isBodega = order.modality === 'bodega';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`relative w-full max-w-md bg-slate-900 border rounded-3xl p-6 text-center shadow-2xl overflow-hidden ${
            isBodega ? 'border-purple-500/50 glow-purple' : 'border-emerald-500/50 glow-cyan'
          }`}
        >
          {/* Top animated badge */}
          <div className="relative mb-4">
            <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl ${
              isBodega ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-emerald-500 to-teal-600'
            }`}>
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-mono-tech uppercase font-bold text-slate-300">
              ENTREGA VERIFICADA
            </div>
          </div>

          <h3 className="text-2xl font-bold text-slate-100 font-display">¡Servicio Completado!</h3>
          <p className="text-xs text-slate-400 mt-1">
            Pedido <span className="font-mono-tech text-cyan-400 font-bold">{order.code}</span> entregado con éxito
          </p>

          {/* Reward Tag */}
          <div className="my-5 p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <p className="text-xs font-mono-tech text-slate-400 uppercase">
              {isBodega ? 'Puntos Acreditados a tu Cuenta' : 'Ingreso Añadido a tu Billetera'}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {isBodega ? (
                <>
                  <Award className="w-7 h-7 text-purple-400" />
                  <span className="text-3xl font-black text-purple-300 font-mono-tech">
                    +{order.pricePoints}
                  </span>
                  <span className="text-sm font-bold text-purple-400">PUNTOS</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-black text-emerald-400 font-mono-tech">
                    +${order.priceCash?.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs font-mono-tech text-slate-400">COP</span>
                </>
              )}
            </div>

            {order.tip && order.tip > 0 && !isBodega && (
              <div className="flex items-center justify-center gap-1 text-xs text-amber-300 font-mono-tech mt-2 pt-2 border-t border-slate-800/80">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Incluye +${order.tip.toLocaleString('es-CO')} de propina</span>
              </div>
            )}
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech text-slate-300 bg-slate-800/40 p-3 rounded-xl mb-5">
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block">DISTANCIA TOTAL</span>
              <span className="font-bold text-slate-200">{order.distanceKm} km</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">ESTADO LOGÍSTICO</span>
              <span className="font-bold text-emerald-400">LIQUIDADO</span>
            </div>
          </div>

          {/* Continue Button */}
          <button
            id="btn-dismiss-success"
            onClick={onDismiss}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white shadow-xl flex items-center justify-center gap-2 transition active:scale-95 ${
              isBodega
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
            }`}
          >
            <span>Continuar al Radar de Pedidos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
