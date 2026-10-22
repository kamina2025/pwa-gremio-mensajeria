import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Radio, 
  Zap, 
  Store, 
  Boxes, 
  Navigation, 
  Clock, 
  MapPin, 
  DollarSign, 
  Award, 
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import { DeliveryOrder, ModalityType } from '../types';
import { soundFx } from '../utils/soundFx';

interface OrdersFeedProps {
  orders: DeliveryOrder[];
  currentMode: ModalityType;
  onAcceptOrder: (order: DeliveryOrder) => void;
  onRejectOrder: (orderId: string) => void;
  onSimulateOrder: () => void;
  onOpenCreateModal: () => void;
}

export const OrdersFeed: React.FC<OrdersFeedProps> = ({
  orders,
  currentMode,
  onAcceptOrder,
  onRejectOrder,
  onSimulateOrder,
  onOpenCreateModal
}) => {
  // Filter orders by active modality
  const filteredOrders = orders.filter((o) => o.modality === currentMode && o.status === 'unassigned');

  return (
    <div className="space-y-4">
      {/* Top Action Bar: Simulation & Custom Order */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          id="btn-simulate-order"
          onClick={() => {
            soundFx.playRadarAlert();
            onSimulateOrder();
          }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-bold transition shadow-lg active:scale-95 ${
            currentMode === 'bodega'
              ? 'bg-purple-950/60 hover:bg-purple-900/60 border-purple-500/50 text-purple-200 shadow-purple-500/20'
              : currentMode === 'negocios'
              ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/50 text-emerald-200 shadow-emerald-500/20'
              : 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/50 text-cyan-200 shadow-cyan-500/20'
          }`}
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Simular Entrada de Pedido ({currentMode === 'express' ? 'Exprés' : currentMode === 'negocios' ? 'Negocios' : 'Bodega'})</span>
        </button>

        <button
          id="btn-open-create-order"
          onClick={onOpenCreateModal}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition active:scale-95"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>+ Crear Despacho Personalizado</span>
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono-tech text-slate-400 uppercase font-bold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" /> Pedidos Disponibles en Radar ({filteredOrders.length})
          </span>
          <span className="text-[11px] font-mono-tech text-slate-500">Auto-refresh activo</span>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            /* Radar Scanner Empty State */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-4"
            >
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Concentric radar circles */}
                <div className="absolute inset-0 rounded-full border border-cyan-500/20"></div>
                <div className="absolute inset-3 rounded-full border border-cyan-500/30"></div>
                <div className="absolute inset-6 rounded-full border border-cyan-500/40"></div>
                {/* Radar sweep beam */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-cyan-500/20 to-transparent animate-radar-sweep pointer-events-none"></div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/40 text-cyan-400 shadow-lg">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-200 text-sm">Escaneando zona por servicios...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  No hay pedidos pendientes en modalidad <strong className="text-slate-300 capitalize">{currentMode}</strong>. Pulsa "Simular Entrada de Pedido" para recibir uno.
                </p>
              </div>

              <button
                onClick={onSimulateOrder}
                className="px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lanzar Pedido de Prueba</span>
              </button>
            </motion.div>
          ) : (
            filteredOrders.map((order) => {
              const isBodega = order.modality === 'bodega';
              const isNegocios = order.modality === 'negocios';

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 15, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className={`bg-slate-900/90 border rounded-3xl p-4 sm:p-5 shadow-xl transition-all relative overflow-hidden ${
                    isBodega
                      ? 'border-purple-500/40 hover:border-purple-400/70 shadow-purple-500/10'
                      : isNegocios
                      ? 'border-emerald-500/40 hover:border-emerald-400/70 shadow-emerald-500/10'
                      : 'border-cyan-500/40 hover:border-cyan-400/70 shadow-cyan-500/10'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono-tech font-bold px-2 py-0.5 rounded-full uppercase border ${
                        isBodega
                          ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                          : isNegocios
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                      }`}>
                        {order.code}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono-tech">{order.createdAt}</span>
                    </div>

                    <div className="text-right">
                      {isBodega ? (
                        <span className="text-xl font-bold font-mono-tech text-purple-400">
                          +{order.pricePoints} <span className="text-xs font-normal">pts</span>
                        </span>
                      ) : (
                        <span className="text-xl font-bold font-mono-tech text-emerald-400">
                          ${order.priceCash?.toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 className="font-bold text-sm text-slate-100 mb-1">{order.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">{order.packageDescription}</p>

                  {/* Waypoints Visual Box */}
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2 mb-3">
                    {/* Origin */}
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 font-mono-tech font-bold flex items-center justify-center shrink-0 text-[10px]">
                        A
                      </div>
                      <span className="text-slate-300 truncate">{order.pickupLocation.name}</span>
                    </div>

                    {/* Destination */}
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-5 h-5 rounded-md font-mono-tech font-bold flex items-center justify-center shrink-0 text-[10px] ${
                        isBodega ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {isBodega && order.stops ? order.stops.length : 'B'}
                      </div>
                      <span className="text-slate-300 truncate">
                        {isBodega && order.stops
                          ? `Ruta Masiva: ${order.stops[0].address} (+${order.stops.length - 1} entregas)`
                          : order.deliveryLocation.name}
                      </span>
                    </div>
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-tech">
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        {order.distanceKm} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        ~{order.estimatedMinutes} min
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRejectOrder(order.id)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                      >
                        Rechazar
                      </button>

                      <button
                        onClick={() => {
                          soundFx.playAcceptChime();
                          onAcceptOrder(order);
                        }}
                        className={`py-2 px-4 rounded-xl text-white text-xs font-bold shadow-lg transition active:scale-95 ${
                          isBodega
                            ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                            : isNegocios
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                            : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
                        }`}
                      >
                        ¡Aceptar!
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
