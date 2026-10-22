import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  Phone, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Award, 
  ShieldCheck, 
  Boxes, 
  Store, 
  Zap, 
  ChevronRight, 
  ExternalLink,
  Check,
  User,
  PackageCheck
} from 'lucide-react';
import { DeliveryOrder, OrderStatus, BodegaStop } from '../types';
import { soundFx } from '../utils/soundFx';

interface ActiveDeliveryHUDProps {
  order: DeliveryOrder;
  onAdvanceStatus: (newStatus: OrderStatus) => void;
  onOpenCallModal: () => void;
  onOpenIncidentModal: () => void;
  onCompleteDelivery: () => void;
  onToggleBodegaStop?: (stopId: string) => void;
}

export const ActiveDeliveryHUD: React.FC<ActiveDeliveryHUDProps> = ({
  order,
  onAdvanceStatus,
  onOpenCallModal,
  onOpenIncidentModal,
  onCompleteDelivery,
  onToggleBodegaStop
}) => {
  const isBodega = order.modality === 'bodega';
  const isNegocios = order.modality === 'negocios';

  const [otpCode, setOtpCode] = useState('');
  const [receivedByPerson, setReceivedByPerson] = useState('');
  const [cashCollectedConfirmed, setCashCollectedConfirmed] = useState(false);

  // Status progression step calculation
  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'assigned':
      case 'heading_to_pickup':
        return 1;
      case 'at_pickup':
        return 2;
      case 'in_transit':
        return 3;
      case 'at_destination':
        return 4;
      case 'delivered':
        return 5;
      default:
        return 1;
    }
  };

  const currentStep = getStepIndex(order.status);

  const steps = [
    { num: 1, label: 'Hacia Recogida', statusKey: 'heading_to_pickup' as OrderStatus },
    { num: 2, label: 'En Punto Origen', statusKey: 'at_pickup' as OrderStatus },
    { num: 3, label: 'En Ruta Entrega', statusKey: 'in_transit' as OrderStatus },
    { num: 4, label: 'En Destino Final', statusKey: 'at_destination' as OrderStatus }
  ];

  const handleNextStep = () => {
    soundFx.playKeypadTone(523, 659);
    if (order.status === 'assigned' || order.status === 'heading_to_pickup') {
      onAdvanceStatus('at_pickup');
    } else if (order.status === 'at_pickup') {
      onAdvanceStatus('in_transit');
    } else if (order.status === 'in_transit') {
      onAdvanceStatus('at_destination');
    } else if (order.status === 'at_destination') {
      onCompleteDelivery();
    }
  };

  const openExternalWaze = () => {
    const lat = order.status === 'heading_to_pickup' || order.status === 'at_pickup'
      ? order.pickupLocation.lat
      : order.deliveryLocation.lat;
    const lng = order.status === 'heading_to_pickup' || order.status === 'at_pickup'
      ? order.pickupLocation.lng
      : order.deliveryLocation.lng;
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  const openExternalGoogleMaps = () => {
    const lat = order.status === 'heading_to_pickup' || order.status === 'at_pickup'
      ? order.pickupLocation.lat
      : order.deliveryLocation.lat;
    const lng = order.status === 'heading_to_pickup' || order.status === 'at_pickup'
      ? order.pickupLocation.lng
      : order.deliveryLocation.lng;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  // Check Bodega stops completion
  const completedStops = order.stops ? order.stops.filter((s) => s.status === 'delivered').length : 0;
  const totalStops = order.stops ? order.stops.length : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Top Status & Code Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl text-white font-bold ${
            isBodega ? 'bg-purple-600' : isNegocios ? 'bg-emerald-600' : 'bg-cyan-600'
          }`}>
            {isBodega ? <Boxes className="w-5 h-5" /> : isNegocios ? <Store className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-tech font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                {order.code}
              </span>
              <span className="text-xs font-semibold text-slate-300 capitalize">
                {order.modality === 'express' ? 'Mensajería Exprés' : order.modality === 'negocios' ? 'Negocios & Restaurante' : 'Bodega Masiva'}
              </span>
            </div>
            <h3 className="font-bold text-sm text-slate-100 mt-0.5">{order.title}</h3>
          </div>
        </div>

        {/* Amount / Points Badge */}
        <div className="text-right">
          {isBodega ? (
            <div className="text-purple-400 font-mono-tech font-bold text-lg">
              +{order.pricePoints} <span className="text-xs font-normal">pts</span>
            </div>
          ) : (
            <div className="text-emerald-400 font-mono-tech font-bold text-lg">
              ${order.priceCash?.toLocaleString('es-CO')}
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono-tech block">
            {order.distanceKm} km • ~{order.estimatedMinutes} min
          </span>
        </div>
      </div>

      {/* Process Stepper */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {steps.map((step) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          return (
            <div key={step.num} className="text-center">
              <div className={`h-2 rounded-full mb-1.5 transition-all ${
                isDone 
                  ? 'bg-emerald-500' 
                  : isCurrent 
                  ? isBodega ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500 animate-pulse' 
                  : 'bg-slate-800'
              }`} />
              <span className={`text-[10px] font-mono-tech block leading-tight ${
                isCurrent 
                  ? 'text-cyan-300 font-bold' 
                  : isDone 
                  ? 'text-emerald-400' 
                  : 'text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Target Address Card (Dynamically switches between Pickup & Delivery depending on step) */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        {currentStep <= 2 ? (
          /* Pickup Point Details */
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono-tech uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Punto de Recogida (A)
              </span>
              <span className="text-[10px] text-slate-400 font-mono-tech">Remitente: {order.senderName}</span>
            </div>
            <h4 className="font-bold text-slate-100 text-sm">{order.pickupLocation.name}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{order.pickupLocation.address}</p>
            {order.pickupLocation.notes && (
              <p className="text-[11px] text-cyan-300/80 bg-cyan-950/40 p-2 rounded-lg mt-2 border border-cyan-900/30">
                <span className="font-bold font-mono-tech">Nota:</span> {order.pickupLocation.notes}
              </p>
            )}
          </div>
        ) : (
          /* Delivery Point Details */
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono-tech uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Destino de Entrega (B)
              </span>
              <span className="text-[10px] text-slate-400 font-mono-tech">Cliente: {order.recipientName}</span>
            </div>
            <h4 className="font-bold text-slate-100 text-sm">{order.deliveryLocation.name}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{order.deliveryLocation.address}</p>
            {order.deliveryLocation.notes && (
              <p className="text-[11px] text-emerald-300/80 bg-emerald-950/40 p-2 rounded-lg mt-2 border border-emerald-900/30">
                <span className="font-bold font-mono-tech">Nota:</span> {order.deliveryLocation.notes}
              </p>
            )}
          </div>
        )}

        {/* COD Amount if Cash On Delivery */}
        {order.paymentMethod === 'Efectivo (Contraentrega)' && order.amountToCollect && order.amountToCollect > 0 && (
          <div className="flex items-center justify-between bg-amber-950/30 border border-amber-500/30 p-2.5 rounded-xl text-xs text-amber-200">
            <span className="font-bold flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Cobro Contraentrega Obligatorio:
            </span>
            <span className="text-sm font-black font-mono-tech text-amber-300">
              ${order.amountToCollect.toLocaleString('es-CO')}
            </span>
          </div>
        )}
      </div>

      {/* Bodega Multi-Stop Manifest Checklist (If Bodega Modality) */}
      {isBodega && order.stops && order.stops.length > 0 && (
        <div className="bg-slate-950/90 border border-purple-500/30 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold font-mono-tech text-purple-300 uppercase flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-purple-400" /> Manifiesto de Puntos ({completedStops}/{totalStops} entregados)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-200 font-mono-tech border border-purple-800">
              {Math.round((completedStops / totalStops) * 100)}%
            </span>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {order.stops.map((stop, idx) => (
              <div
                key={stop.id}
                onClick={() => onToggleBodegaStop && onToggleBodegaStop(stop.id)}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                  stop.status === 'delivered'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono-tech shrink-0 ${
                    stop.status === 'delivered' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {stop.status === 'delivered' ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold truncate text-xs ${stop.status === 'delivered' ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                      {stop.recipientName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{stop.address}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[10px] font-mono-tech text-purple-300 font-bold">+{stop.pointsValue} pts</span>
                  <a
                    href={`tel:${stop.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block text-[10px] text-cyan-400 hover:underline font-mono-tech mt-0.5"
                  >
                    Llamar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {/* Call Button */}
        <button
          id="btn-hud-call"
          onClick={onOpenCallModal}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-bold text-xs transition active:scale-95"
        >
          <Phone className="w-4 h-4" />
          <span>Llamar</span>
        </button>

        {/* Novelty / Incident Button */}
        <button
          id="btn-hud-incident"
          onClick={onOpenIncidentModal}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 font-bold text-xs transition active:scale-95"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Novedad</span>
        </button>

        {/* Waze / External GPS Button */}
        <button
          id="btn-hud-waze"
          onClick={openExternalWaze}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-xs transition active:scale-95"
        >
          <Navigation className="w-4 h-4 text-cyan-400" />
          <span>Waze GPS</span>
        </button>

        {/* Step Advance / Complete Button */}
        <button
          id="btn-hud-advance-step"
          onClick={handleNextStep}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-white font-bold text-xs shadow-lg transition active:scale-95 col-span-2 sm:col-span-1 ${
            currentStep === 4
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40 ring-2 ring-emerald-400'
              : isBodega
              ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
              : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {currentStep === 1 && 'Llegué a Recogida'}
            {currentStep === 2 && 'Confirmar Paquete'}
            {currentStep === 3 && 'Llegué a Destino'}
            {currentStep === 4 && '¡Finalizar Entrega!'}
          </span>
        </button>
      </div>
    </div>
  );
};
