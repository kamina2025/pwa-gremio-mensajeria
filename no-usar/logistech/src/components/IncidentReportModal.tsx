import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  Camera, 
  UploadCloud, 
  FileText, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  X,
  MapPinOff,
  UserX,
  PackageX,
  Wrench,
  CloudRain
} from 'lucide-react';
import { DeliveryOrder, IncidentReport } from '../types';
import { soundFx } from '../utils/soundFx';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DeliveryOrder | null;
  courierName: string;
  onSubmitReport: (report: IncidentReport) => void;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  order,
  courierName,
  onSubmitReport
}) => {
  const [causal, setCausal] = useState<IncidentReport['causal']>('Cliente ausente / No responde llamadas');
  const [notes, setNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [returnedToOrigin, setReturnedToOrigin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const causalOptions: { id: IncidentReport['causal']; label: string; icon: React.ReactNode }[] = [
    {
      id: 'Cliente ausente / No responde llamadas',
      label: 'Cliente ausente / No responde llamadas (3 intentos)',
      icon: <UserX className="w-4 h-4 text-amber-400" />
    },
    {
      id: 'Dirección incorrecta / No existe',
      label: 'Dirección incorrecta / Incompleta o no existe',
      icon: <MapPinOff className="w-4 h-4 text-rose-400" />
    },
    {
      id: 'Paquete averiado / Mal estado en tránsito',
      label: 'Paquete averiado / Envoltura rota o derrame',
      icon: <PackageX className="w-4 h-4 text-purple-400" />
    },
    {
      id: 'Cliente rechaza el pedido o valor',
      label: 'Cliente rechaza el pedido o cobro contraentrega',
      icon: <ShieldAlert className="w-4 h-4 text-orange-400" />
    },
    {
      id: 'Zona peligrosa o acceso restringido',
      label: 'Zona de orden público o acceso restringido',
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />
    },
    {
      id: 'Falla mecánica del mensajero',
      label: 'Falla mecánica del vehículo / Pinchazo',
      icon: <Wrench className="w-4 h-4 text-blue-400" />
    },
    {
      id: 'Condiciones climáticas extremas',
      label: 'Lluvia torrencial / Vía inundada',
      icon: <CloudRain className="w-4 h-4 text-cyan-400" />
    }
  ];

  const handleSimulatePhoto = (sampleType: string) => {
    // Generate high quality sample evidence image or read uploaded file
    const sampleImgs: Record<string, string> = {
      closed_door: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop&q=80',
      damaged_box: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500&auto=format&fit=crop&q=80',
      empty_street: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=500&auto=format&fit=crop&q=80'
    };
    setPhotoPreview(sampleImgs[sampleType] || sampleImgs.closed_door);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    soundFx.playIncidentAlert();

    const report: IncidentReport = {
      id: 'INC-' + Math.floor(100000 + Math.random() * 900000),
      orderId: order.id,
      orderCode: order.code,
      causal,
      notes: notes.trim() || 'Novedad reportada directamente por el mensajero desde la PWA.',
      photoEvidence: photoPreview || undefined,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      returnedToOrigin,
      courierName
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onSubmitReport(report);
      onClose();
    }, 600);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl overflow-hidden shadow-2xl my-6 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-rose-950 to-slate-900 border-b border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Reporte de Novedad y Devolución</h3>
                <p className="text-xs text-rose-300 font-mono-tech">Orden: {order.code} • {order.title}</p>
              </div>
            </div>
            <button
              id="btn-close-incident-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Causal Selector */}
            <div>
              <label className="block text-xs font-bold font-mono-tech text-slate-300 uppercase mb-2">
                1. Selecciona la Causal Principal de Devolución:
              </label>
              <div className="space-y-2">
                {causalOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      causal === opt.id
                        ? 'bg-rose-950/40 border-rose-500 text-rose-200 shadow-sm'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="causal"
                      value={opt.id}
                      checked={causal === opt.id}
                      onChange={() => setCausal(opt.id)}
                      className="text-rose-500 focus:ring-rose-500"
                    />
                    <div className="shrink-0">{opt.icon}</div>
                    <span className="flex-1">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes / Details */}
            <div>
              <label className="block text-xs font-bold font-mono-tech text-slate-300 uppercase mb-1.5">
                2. Descripción y Observaciones del Incidente:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ejemplo: Se realizaron 3 llamadas telefónicas sin respuesta en portería. El vigilante no autoriza recepción sin el cliente..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            {/* Evidence Photo */}
            <div>
              <label className="block text-xs font-bold font-mono-tech text-slate-300 uppercase mb-1.5">
                3. Evidencia Fotográfica / Soporte:
              </label>
              
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 max-h-48 flex items-center justify-center">
                  <img
                    src={photoPreview}
                    alt="Evidencia"
                    className="w-full h-44 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-rose-400 hover:bg-rose-600 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-bold text-slate-300 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Tomar / Subir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Quick sample simulation buttons */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>O simular foto:</span>
                    <button
                      type="button"
                      onClick={() => handleSimulatePhoto('closed_door')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
                    >
                      Fachada / Puerta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulatePhoto('damaged_box')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
                    >
                      Caja Averiada
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logistics Return Destination */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <div>
                  <p className="text-xs font-bold text-slate-200">Reversar Ruta y Devolver</p>
                  <p className="text-[11px] text-slate-400">El paquete será retornado al punto de origen/bodega</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={returnedToOrigin}
                onChange={(e) => setReturnedToOrigin(e.target.checked)}
                className="w-4 h-4 text-rose-500 rounded focus:ring-rose-400 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-incident"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                id="btn-submit-incident"
                disabled={isSubmitting}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/40 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando...' : 'Confirmar Novedad'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
