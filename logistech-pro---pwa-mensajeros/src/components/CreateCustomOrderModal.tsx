import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MapPin, 
  User, 
  Phone, 
  Package, 
  Zap, 
  Store, 
  Boxes, 
  DollarSign, 
  X,
  Sparkles
} from 'lucide-react';
import { DeliveryOrder, ModalityType } from '../types';
import { calculatePriceForOrder } from '../data/mockData';
import { soundFx } from '../utils/soundFx';

interface CreateCustomOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (order: DeliveryOrder) => void;
  defaultModality: ModalityType;
}

export const CreateCustomOrderModal: React.FC<CreateCustomOrderModalProps> = ({
  isOpen,
  onClose,
  onCreateOrder,
  defaultModality
}) => {
  const [modality, setModality] = useState<ModalityType>(defaultModality);
  const [title, setTitle] = useState('');
  const [senderName, setSenderName] = useState('Restaurante / Remitente Local');
  const [senderPhone, setSenderPhone] = useState('+57 312 000 9988');
  const [recipientName, setRecipientName] = useState('Andrés Felipe Gómez');
  const [recipientPhone, setRecipientPhone] = useState('+57 300 123 4567');
  const [pickupAddress, setPickupAddress] = useState('Av. 6N # 24N-10, Barrio Santa Mónica');
  const [deliveryAddress, setDeliveryAddress] = useState('Calle 14 # 85-30, Barrio El Limonar');
  const [distanceKm, setDistanceKm] = useState(4.5);
  const [estimatedMinutes, setEstimatedMinutes] = useState(18);
  const [packageDesc, setPackageDesc] = useState('Bolsa sellada con insumos y factura');
  const [tip, setTip] = useState(2500);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playAcceptChime();

    const priceCalc = calculatePriceForOrder(modality, distanceKm, estimatedMinutes);
    const orderCode = (modality === 'express' ? 'EXP' : modality === 'negocios' ? 'NEG' : 'BOD') + '-' + Math.floor(1000 + Math.random() * 9000);

    const newOrder: DeliveryOrder = {
      id: 'ORD-' + Math.random().toString(36).substring(2, 9),
      code: orderCode,
      modality,
      title: title.trim() || (modality === 'express' ? 'Envío Exprés Directo' : modality === 'negocios' ? 'Pedido Local Comercial' : 'Despacho Bodega Especial'),
      senderName,
      senderPhone,
      recipientName,
      recipientPhone,
      pickupLocation: {
        lat: 3.4516 + (Math.random() - 0.5) * 0.02,
        lng: -76.5320 + (Math.random() - 0.5) * 0.02,
        name: senderName,
        address: pickupAddress
      },
      deliveryLocation: {
        lat: 3.4180 + (Math.random() - 0.5) * 0.02,
        lng: -76.5410 + (Math.random() - 0.5) * 0.02,
        name: recipientName,
        address: deliveryAddress
      },
      distanceKm,
      estimatedMinutes,
      packageDescription: packageDesc,
      packageWeightKg: 1.2,
      priceCash: priceCalc.priceCash,
      pricePoints: priceCalc.pricePoints,
      paymentMethod: modality === 'bodega' ? 'Créditos Bodega' : 'Pagado Digital',
      tip: modality !== 'bodega' ? tip : 0,
      urgency: 'alta',
      createdAt: 'Ahora mismo',
      status: 'unassigned'
    };

    onCreateOrder(newOrder);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Crear Despacho Manual</h3>
                <p className="text-xs text-slate-400">Genera una orden de prueba en el sistema</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Modality Selector in modal */}
            <div>
              <label className="block font-mono-tech text-slate-300 uppercase font-bold mb-1.5">
                Modalidad del Pedido:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setModality('express')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition ${
                    modality === 'express'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Exprés</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModality('negocios')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition ${
                    modality === 'negocios'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Negocios</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModality('bodega')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition ${
                    modality === 'bodega'
                      ? 'bg-purple-600 text-white border-purple-400 shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>Bodega</span>
                </button>
              </div>
            </div>

            {/* Title / Description */}
            <div>
              <label className="block font-mono-tech text-slate-300 uppercase font-bold mb-1">
                Título o Comercio:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Pedido Restaurante La Taquería"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Origin & Destination Addresses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-tech text-cyan-400 uppercase font-bold mb-1">
                  Punto Recogida (A):
                </label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-mono-tech text-emerald-400 uppercase font-bold mb-1">
                  Punto Entrega (B):
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            {/* Distance & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-tech text-slate-300 uppercase font-bold mb-1">
                  Distancia (km):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono-tech focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-mono-tech text-slate-300 uppercase font-bold mb-1">
                  Tiempo Estimado (min):
                </label>
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono-tech focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            {/* Package details */}
            <div>
              <label className="block font-mono-tech text-slate-300 uppercase font-bold mb-1">
                Detalle del Paquete:
              </label>
              <input
                type="text"
                value={packageDesc}
                onChange={(e) => setPackageDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-white shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Despachar Pedido</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
