import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  DollarSign, 
  Award, 
  TrendingUp, 
  Clock, 
  Navigation, 
  ArrowUpRight, 
  CreditCard, 
  CheckCircle2, 
  ShieldCheck, 
  Boxes, 
  Store, 
  Zap, 
  Star,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { WalletStats, TransactionHistory, ModalityType } from '../types';
import { soundFx } from '../utils/soundFx';

interface WalletViewProps {
  stats: WalletStats;
  transactions: TransactionHistory[];
  onWithdrawCash: (amount: number, method: string) => void;
  onRedeemPoints: (points: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  stats,
  transactions,
  onWithdrawCash,
  onRedeemPoints
}) => {
  const [filterMode, setFilterMode] = useState<'all' | ModalityType>('all');
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('50000');
  const [paymentProvider, setPaymentProvider] = useState<'Nequi' | 'Daviplata' | 'Bancolombia' | 'PSE'>('Nequi');
  const [accountPhone, setAccountPhone] = useState('301 776 2309');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredTransactions = transactions.filter((t) => {
    if (filterMode === 'all') return true;
    return t.modality === filterMode;
  });

  const handleExecuteWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(withdrawAmount.replace(/\D/g, '')) || 0;
    if (amountNum <= 0 || amountNum > stats.cashBalance) {
      alert('El monto ingresado excede el saldo disponible.');
      return;
    }
    soundFx.playSuccessFanfare();
    onWithdrawCash(amountNum, `${paymentProvider} (${accountPhone})`);
    setIsWithdrawModalOpen(false);
    setSuccessMsg(`Transferencia de $${amountNum.toLocaleString('es-CO')} enviada a tu ${paymentProvider}.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleExecuteRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playSuccessFanfare();
    onRedeemPoints(100);
    setIsRedeemModalOpen(false);
    setSuccessMsg(`Has canjeado 100 Puntos de Bodega por un bono de combustible/efectivo.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Toast Notification */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold font-mono-tech flex items-center gap-2 shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Main Dual Cards: Cash vs Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cash Card: Exprés & Negocios */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 border border-cyan-500/40 p-6 shadow-2xl">
          {/* Subtle neon glow backdrops */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono-tech uppercase font-bold text-cyan-400">
                  Modalidades Exprés & Negocios
                </span>
                <h3 className="font-bold text-slate-100 text-sm">Saldo en Efectivo / Digital</h3>
              </div>
            </div>

            <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              DISPONIBLE
            </span>
          </div>

          {/* Cash Amount */}
          <div className="my-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-white font-mono-tech tracking-tight">
                ${stats.cashBalance.toLocaleString('es-CO')}
              </span>
              <span className="text-xs font-mono-tech text-cyan-300 font-bold">COP</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hoy: <strong className="text-emerald-400 font-mono-tech">+${stats.todayCash.toLocaleString('es-CO')}</strong> • Esta semana: <span className="font-mono-tech text-slate-300">${stats.weekCash.toLocaleString('es-CO')}</span>
            </p>
          </div>

          {/* Sub metrics */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-800/80 text-xs font-mono-tech">
            <div>
              <span className="text-[10px] text-slate-400 block">PROPINAS</span>
              <span className="font-bold text-amber-400">+${stats.cashTips.toLocaleString('es-CO')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">RECORRIDO</span>
              <span className="font-bold text-slate-200">{stats.totalKm} km</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">TIEMPO ACTIVO</span>
              <span className="font-bold text-slate-200">{stats.activeHours} hrs</span>
            </div>
          </div>

          {/* Withdraw Action Button */}
          <button
            id="btn-open-withdraw"
            onClick={() => setIsWithdrawModalOpen(true)}
            className="w-full mt-3 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <CreditCard className="w-4 h-4" />
            <span>Retirar Saldo a Nequi / Daviplata / Banco</span>
          </button>
        </div>

        {/* Points Card: Bodega Logística Masiva */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/70 border border-purple-500/40 p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono-tech uppercase font-bold text-purple-400">
                  Modalidad Bodega (Masivo)
                </span>
                <h3 className="font-bold text-slate-100 text-sm">Puntos Geográficos & Créditos</h3>
              </div>
            </div>

            <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              RANGO ELITE ORO
            </span>
          </div>

          {/* Points Amount */}
          <div className="my-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-white font-mono-tech tracking-tight">
                {stats.pointsBalance.toLocaleString('es-CO')}
              </span>
              <span className="text-sm font-bold text-purple-300">PUNTOS</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hoy: <strong className="text-purple-400 font-mono-tech">+{stats.todayPoints} pts</strong> • Semana: <span className="font-mono-tech text-slate-300">{stats.weekPoints} pts</span>
            </p>
          </div>

          {/* Sub metrics */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-800/80 text-xs font-mono-tech">
            <div>
              <span className="text-[10px] text-slate-400 block">PAQUETES</span>
              <span className="font-bold text-purple-300">{stats.massivePackagesCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">PUNTOS GEO</span>
              <span className="font-bold text-slate-200">{stats.geoPointsVisited}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">EFECTIVIDAD</span>
              <span className="font-bold text-emerald-400">{stats.bodegaAccuracyRate}%</span>
            </div>
          </div>

          {/* Redeem Points Action Button */}
          <button
            id="btn-open-redeem"
            onClick={() => setIsRedeemModalOpen(true)}
            className="w-full mt-3 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Award className="w-4 h-4" />
            <span>Canjear Puntos por Bonos / Premios</span>
          </button>
        </div>
      </div>

      {/* Transactions & Activity Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              Historial de Liquidaciones y Servicios
            </h4>
            <p className="text-xs text-slate-400">Detalle de ingresos por cada carrera completada</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                filterMode === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterMode('express')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                filterMode === 'express' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exprés
            </button>
            <button
              onClick={() => setFilterMode('negocios')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                filterMode === 'negocios' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Negocios
            </button>
            <button
              onClick={() => setFilterMode('bodega')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                filterMode === 'bodega' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bodega
            </button>
          </div>
        </div>

        {/* Ledger List */}
        <div className="space-y-2">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.modality === 'bodega'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : tx.modality === 'negocios'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}>
                  {tx.modality === 'bodega' ? <Boxes className="w-4 h-4" /> : tx.modality === 'negocios' ? <Store className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200 truncate">{tx.description}</span>
                    <span className="text-[10px] font-mono-tech text-slate-500 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                      {tx.orderCode}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono-tech text-slate-400 mt-0.5">{tx.timestamp}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {tx.amountCash ? (
                  <span className="text-sm font-bold font-mono-tech text-emerald-400">
                    +${tx.amountCash.toLocaleString('es-CO')}
                  </span>
                ) : (
                  <span className="text-sm font-bold font-mono-tech text-purple-400">
                    +{tx.amountPoints} pts
                  </span>
                )}
                <span className="text-[10px] text-slate-500 block font-mono-tech uppercase">Liquidado</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Withdraw Cash */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Retiro de Ganancias Exprés / Negocios
              </h3>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-tech text-slate-400 mb-1">
                  Monto a Transferir (Saldo disponible: ${stats.cashBalance.toLocaleString('es-CO')}):
                </label>
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-lg font-bold font-mono-tech text-cyan-300 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono-tech text-slate-400 mb-1">
                  Método de Destino:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Nequi', 'Daviplata', 'Bancolombia', 'PSE'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setPaymentProvider(prov)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                        paymentProvider === prov
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-tech text-slate-400 mb-1">
                  Número de Celular / Cuenta Vinculada:
                </label>
                <input
                  type="text"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono-tech text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-xs text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-xs text-white shadow-lg shadow-cyan-600/30"
                >
                  Confirmar Retiro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal: Redeem Points */}
      {isRedeemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Canje de Puntos Bodega Masiva
              </h3>
              <button
                onClick={() => setIsRedeemModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteRedeem} className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200">
                <p className="font-bold text-sm text-white mb-1">Bono Gasolina / Efectivo (100 pts)</p>
                <p>Equivalente a $50.000 COP en bono digital o transferencia directa a tu cuenta.</p>
                <p className="mt-2 font-mono-tech text-[11px] text-purple-300">
                  Tus puntos actuales: <strong>{stats.pointsBalance} pts</strong>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRedeemModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-xs text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-xs text-white shadow-lg shadow-purple-600/30"
                >
                  Canjear Ahora
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
