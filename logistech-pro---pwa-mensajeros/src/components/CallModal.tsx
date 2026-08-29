import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  User, 
  Store, 
  Headphones, 
  Copy, 
  Check, 
  X,
  ExternalLink
} from 'lucide-react';
import { DeliveryOrder } from '../types';
import { soundFx } from '../utils/soundFx';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DeliveryOrder | null;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'recipient' | 'sender' | 'dispatch'>('recipient');
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCallState('idle');
      setCallSeconds(0);
      return;
    }
  }, [isOpen]);

  // Call timer and ringing audio simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === 'calling') {
      soundFx.playKeypadTone(440, 480);
      const connectTimeout = setTimeout(() => {
        setCallState('connected');
        soundFx.playKeypadTone(523, 659);
      }, 3000);
      return () => clearTimeout(connectTimeout);
    } else if (callState === 'connected') {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  if (!isOpen || !order) return null;

  const getTargetInfo = () => {
    if (selectedTarget === 'recipient') {
      return {
        name: order.recipientName,
        phone: order.recipientPhone,
        role: 'Cliente Destinatario',
        icon: <User className="w-5 h-5" />
      };
    } else if (selectedTarget === 'sender') {
      return {
        name: order.senderName,
        phone: order.senderPhone,
        role: 'Comercio / Remitente',
        icon: <Store className="w-5 h-5" />
      };
    } else {
      return {
        name: 'Central de Operaciones & Despacho',
        phone: '+57 300 900 1122',
        role: 'Soporte Logístico 24/7',
        icon: <Headphones className="w-5 h-5" />
      };
    }
  };

  const targetInfo = getTargetInfo();

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const quickMessages = [
    `¡Hola! Soy el mensajero de LogisTech con tu pedido (${order.code}). Ya estoy en la portería/dirección.`,
    `Buen día, estoy afuera con tu entrega. Por favor acércate o autoriza el ingreso con el vigilante.`,
    `Hola, intento llamarte pero no entra la llamada. Por favor comunícate urgente conmigo.`
  ];

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard?.writeText(msg);
    setCopiedMessage(msg);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  const handleStartCall = () => {
    setCallState('calling');
  };

  const handleEndCall = () => {
    setCallState('ended');
    soundFx.playIncidentAlert();
    setTimeout(() => {
      setCallState('idle');
      setCallSeconds(0);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Centro de Llamadas & Contacto</h3>
                <p className="text-[11px] text-slate-400 font-mono-tech">Pedido: {order.code}</p>
              </div>
            </div>
            <button
              id="btn-close-call-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contact Target Tabs */}
          {callState === 'idle' && (
            <div className="p-4 pb-2">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  id="tab-target-recipient"
                  onClick={() => setSelectedTarget('recipient')}
                  className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                    selectedTarget === 'recipient'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">Cliente</span>
                </button>

                <button
                  id="tab-target-sender"
                  onClick={() => setSelectedTarget('sender')}
                  className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                    selectedTarget === 'sender'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span className="truncate">Negocio</span>
                </button>

                <button
                  id="tab-target-dispatch"
                  onClick={() => setSelectedTarget('dispatch')}
                  className={`py-2 px-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                    selectedTarget === 'dispatch'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span className="truncate">Central</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Caller Card / In-call Interface */}
          <div className="p-5 flex-1 flex flex-col items-center justify-center text-center">
            {callState === 'idle' ? (
              <div className="w-full space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-600 flex items-center justify-center mx-auto shadow-inner text-cyan-400">
                  {targetInfo.icon}
                </div>

                <div>
                  <span className="text-[11px] font-mono-tech px-2 py-0.5 rounded bg-slate-800 text-cyan-300 uppercase">
                    {targetInfo.role}
                  </span>
                  <h4 className="text-lg font-bold text-slate-100 mt-1">{targetInfo.name}</h4>
                  <p className="text-sm font-mono-tech text-slate-400">{targetInfo.phone}</p>
                </div>

                {/* Direct Native Call & In-App Simulated Call */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    id="btn-native-tel"
                    href={`tel:${targetInfo.phone}`}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                  >
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                    <span>Llamada SIM / Tel</span>
                  </a>

                  <button
                    id="btn-start-inapp-call"
                    onClick={handleStartCall}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition active:scale-95"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                    <span>Llamar por App</span>
                  </button>
                </div>

                {/* Quick SMS templates */}
                <div className="mt-4 pt-4 border-t border-slate-800 text-left">
                  <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    Mensajes rápidos predeterminados:
                  </p>
                  <div className="space-y-1.5">
                    {quickMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopyMessage(msg)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 text-[11px] text-slate-300 cursor-pointer flex items-center justify-between gap-2 transition"
                      >
                        <span className="truncate">{msg}</span>
                        {copiedMessage === msg ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Active In-Call Screen */
              <div className="w-full py-4 space-y-6">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-2xl transition ${
                    callState === 'calling'
                      ? 'bg-amber-600/30 border-2 border-amber-400 animate-pulse'
                      : callState === 'connected'
                      ? 'bg-emerald-600/30 border-2 border-emerald-400 glow-cyan'
                      : 'bg-rose-600/30 border-2 border-rose-400'
                  }`}>
                    {targetInfo.icon}
                  </div>
                  {callState === 'connected' && (
                    <span className="absolute bottom-0 right-1/3 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-100">{targetInfo.name}</h4>
                  <p className="text-xs font-mono-tech text-slate-400 mt-0.5">{targetInfo.phone}</p>
                  <p className="text-sm font-mono-tech font-bold text-emerald-400 mt-2">
                    {callState === 'calling' && 'Marcando y conectando...'}
                    {callState === 'connected' && `En llamada: ${formatSeconds(callSeconds)}`}
                    {callState === 'ended' && 'Llamada finalizada'}
                  </p>
                </div>

                {/* Call controls */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-3.5 rounded-full border transition ${
                      isMuted
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Hang Up Button */}
                  <button
                    id="btn-hang-up"
                    onClick={handleEndCall}
                    className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/40 transition active:scale-90"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>

                  <button
                    onClick={() => setIsSpeaker(!isSpeaker)}
                    className={`p-3.5 rounded-full border transition ${
                      isSpeaker
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
