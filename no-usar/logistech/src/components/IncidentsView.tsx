import React from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle, 
  Calendar, 
  FileText, 
  Camera, 
  ShieldAlert, 
  ArrowLeft 
} from 'lucide-react';
import { IncidentReport } from '../types';

interface IncidentsViewProps {
  incidents: IncidentReport[];
  onBackToOrders: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onBackToOrders
}) => {
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            Registro de Novedades y Devoluciones
          </h3>
          <p className="text-xs text-slate-400">Historial de paquetes con causales de devolución y soporte</p>
        </div>
        <button
          onClick={onBackToOrders}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 transition"
        >
          Volver a Pedidos
        </button>
      </div>

      {/* Incidents List */}
      {incidents.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-200 text-sm">Sin Novedades Registradas</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Todas las entregas se han procesado de forma exitosa. Si surge un problema con una orden activa, puedes reportarlo usando el botón "Novedad".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="bg-slate-900 border border-rose-500/30 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono-tech font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-800/50">
                        {inc.id}
                      </span>
                      <span className="text-xs font-mono-tech text-slate-400">Orden: {inc.orderCode}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-100 mt-1">{inc.causal}</h4>
                  </div>
                </div>

                <span className="text-[10px] font-mono-tech text-slate-400 shrink-0">
                  {inc.timestamp}
                </span>
              </div>

              {/* Notes */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
                <span className="font-bold font-mono-tech text-rose-400 uppercase text-[10px] block mb-1">
                  Observaciones:
                </span>
                <p>{inc.notes}</p>
              </div>

              {/* Photo Evidence if present */}
              {inc.photoEvidence && (
                <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-48 bg-slate-950">
                  <img
                    src={inc.photoEvidence}
                    alt="Evidencia fotográfica"
                    className="w-full h-40 object-cover"
                  />
                </div>
              )}

              {/* Status info */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  {inc.returnedToOrigin ? 'Retornado a Bodega/Origen' : 'En custodia del mensajero'}
                </span>
                <span className="font-mono-tech text-slate-400">Registrado por: {inc.courierName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
