/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ListOrdered, 
  Map as MapIcon, 
  Wallet, 
  AlertTriangle, 
  Radio, 
  Navigation, 
  Phone, 
  CheckCircle,
  ArrowRight,
  Boxes,
  Store,
  Zap
} from 'lucide-react';

import { 
  DeliveryOrder, 
  ModalityType, 
  OrderStatus, 
  IncidentReport, 
  CourierProfile, 
  WalletStats, 
  TransactionHistory 
} from './types';

import { 
  initialOrders, 
  initialWalletStats, 
  initialTransactions, 
  calculatePriceForOrder 
} from './data/mockData';

import { soundFx } from './utils/soundFx';

// Subcomponents
import { Header } from './components/Header';
import { ModalitySelector } from './components/ModalitySelector';
import { OrdersFeed } from './components/OrdersFeed';
import { LeafletMapView } from './components/LeafletMapView';
import { ActiveDeliveryHUD } from './components/ActiveDeliveryHUD';
import { WalletView } from './components/WalletView';
import { IncidentsView } from './components/IncidentsView';
import { NewOrderIncomingModal } from './components/NewOrderIncomingModal';
import { CallModal } from './components/CallModal';
import { IncidentReportModal } from './components/IncidentReportModal';
import { SuccessDeliveryModal } from './components/SuccessDeliveryModal';
import { CreateCustomOrderModal } from './components/CreateCustomOrderModal';

export default function App() {
  // Navigation & Modality State
  const [activeTab, setActiveTab] = useState<'orders' | 'map' | 'wallet' | 'incidents'>('orders');
  const [currentMode, setCurrentMode] = useState<ModalityType>('express');

  // Courier Profile State
  const [courier, setCourier] = useState<CourierProfile>({
    name: 'Jhoan Sebastián Gómez',
    idNumber: 'CC 1.144.209.871',
    vehicleType: 'Motocicleta',
    plate: 'KYZ-44F',
    rating: 4.96,
    level: 'Elite Oro',
    isOnline: true,
    batteryLevel: 88,
    currentLat: 3.4516,
    currentLng: -76.5320
  });

  // Orders and In-flight Delivery State
  const [orders, setOrders] = useState<DeliveryOrder[]>(() => {
    const saved = localStorage.getItem('logistech_orders');
    return saved ? JSON.parse(saved) : initialOrders;
  });

  const [activeOrder, setActiveOrder] = useState<DeliveryOrder | null>(() => {
    const saved = localStorage.getItem('logistech_active_order');
    return saved ? JSON.parse(saved) : null;
  });

  // Wallet & History State
  const [walletStats, setWalletStats] = useState<WalletStats>(() => {
    const saved = localStorage.getItem('logistech_wallet');
    return saved ? JSON.parse(saved) : initialWalletStats;
  });

  const [transactions, setTransactions] = useState<TransactionHistory[]>(() => {
    const saved = localStorage.getItem('logistech_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [incidents, setIncidents] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem('logistech_incidents');
    return saved ? JSON.parse(saved) : [];
  });

  // Modals and Overlays
  const [incomingOrder, setIncomingOrder] = useState<DeliveryOrder | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<DeliveryOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Telemetry & Sound State
  const [isMuted, setIsMuted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('logistech_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('logistech_active_order', JSON.stringify(activeOrder));
  }, [activeOrder]);

  useEffect(() => {
    localStorage.setItem('logistech_wallet', JSON.stringify(walletStats));
  }, [walletStats]);

  useEffect(() => {
    localStorage.setItem('logistech_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('logistech_incidents', JSON.stringify(incidents));
  }, [incidents]);

  // PWA Install Prompt Listener & Service Worker Registration
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration error:', err);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundFx.isMuted = newMuted;
  };

  const handleToggleOnline = () => {
    setCourier((prev) => ({
      ...prev,
      isOnline: !prev.isOnline
    }));
  };

  // Order Acceptance Handler
  const handleAcceptOrder = (order: DeliveryOrder) => {
    const acceptedOrder: DeliveryOrder = {
      ...order,
      status: 'assigned'
    };

    setActiveOrder(acceptedOrder);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setIncomingOrder(null);
    setActiveTab('map');
  };

  const handleRejectOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setIncomingOrder(null);
  };

  // Simulate incoming order
  const handleSimulateNewOrder = () => {
    const isBodega = currentMode === 'bodega';
    const isNegocios = currentMode === 'negocios';

    const dist = parseFloat((Math.random() * 5 + 1.8).toFixed(1));
    const mins = Math.round(dist * 3.5 + 4);
    const priceCalc = calculatePriceForOrder(currentMode, dist, mins, isBodega ? 3 : 1);

    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const code = (isBodega ? 'BOD' : isNegocios ? 'NEG' : 'EXP') + '-' + Math.floor(1000 + Math.random() * 9000);

    const simulatedTitles: Record<ModalityType, string[]> = {
      express: [
        'Entrega Urgente Llaves y Documentos Notaría',
        'Medicamentos Droguería San Jorge',
        'Sobre Confidencial Banco de Occidente'
      ],
      negocios: [
        'Restaurante Pizzería Romana - 2 Pizzas Familiares',
        'Hamburguesas Chef Burger - Pedido #4821',
        'Supermercado La 14 Express - Domicilio Express'
      ],
      bodega: [
        'Ruta Masiva Zona Norte - 3 Paradas Logísticas',
        'Despacho Consolidado Paquetería E-Commerce',
        'Distribución Bodega Central Acopi Yumbo'
      ]
    };

    const titleList = simulatedTitles[currentMode];
    const chosenTitle = titleList[Math.floor(Math.random() * titleList.length)];

    const newSimulatedOrder: DeliveryOrder = {
      id: orderId,
      code,
      modality: currentMode,
      title: chosenTitle,
      senderName: isBodega ? 'CEDI Bodega Norte' : isNegocios ? 'Restaurante / Local Aliado' : 'Usuario Particular Exprés',
      senderPhone: '+57 312 400 9081',
      recipientName: isBodega ? 'Clientes Ruta Consolidada' : 'Daniela Ortiz',
      recipientPhone: '+57 301 884 1920',
      pickupLocation: {
        lat: 3.4516 + (Math.random() - 0.5) * 0.03,
        lng: -76.5320 + (Math.random() - 0.5) * 0.03,
        name: isBodega ? 'Muelle de Carga CEDI' : 'Local Comercial Aliado',
        address: 'Av. 4N # 19-50, Cali',
        notes: 'Preguntar por el pedido con código ' + code
      },
      deliveryLocation: {
        lat: 3.4240 + (Math.random() - 0.5) * 0.03,
        lng: -76.5430 + (Math.random() - 0.5) * 0.03,
        name: 'Residencial Los Sauces',
        address: 'Calle 9 # 44-12, Apto 302',
        notes: 'Anunciar en portería con el vigilante'
      },
      stops: isBodega
        ? [
            {
              id: 'st-sim-1',
              recipientName: 'Paola Andrea Muñoz',
              address: 'Calle 9 # 44-12',
              lat: 3.4400,
              lng: -76.5350,
              packageCode: 'PKG-' + Math.floor(100 + Math.random() * 900),
              pointsValue: 8,
              status: 'pending',
              phone: '+57 318 440 9981'
            },
            {
              id: 'st-sim-2',
              recipientName: 'Jorge Eduardo Tovar',
              address: 'Carrera 56 # 11-20',
              lat: 3.4300,
              lng: -76.5400,
              packageCode: 'PKG-' + Math.floor(100 + Math.random() * 900),
              pointsValue: 9,
              status: 'pending',
              phone: '+57 310 551 2299'
            },
            {
              id: 'st-sim-3',
              recipientName: 'Farmacia La Riviera',
              address: 'Calle 16 # 80-45',
              lat: 3.4200,
              lng: -76.5430,
              packageCode: 'PKG-' + Math.floor(100 + Math.random() * 900),
              pointsValue: 11,
              status: 'pending',
              phone: '+57 317 882 1010'
            }
          ]
        : undefined,
      distanceKm: dist,
      estimatedMinutes: mins,
      packageDescription: isBodega
        ? '3 Cajas de paquetería e-commerce'
        : isNegocios
        ? 'Alimentos calientes con bolsa térmica'
        : 'Sobre manila / Paquete mediano',
      priceCash: priceCalc.priceCash,
      pricePoints: priceCalc.pricePoints,
      paymentMethod: isBodega ? 'Créditos Bodega' : 'Pagado Digital',
      tip: isNegocios ? 2500 : isBodega ? 0 : 1500,
      urgency: 'alta',
      createdAt: 'Hace un momento',
      status: 'unassigned'
    };

    setIncomingOrder(newSimulatedOrder);
    setOrders((prev) => [newSimulatedOrder, ...prev]);
  };

  // Status Progression Handler
  const handleAdvanceOrderStatus = (newStatus: OrderStatus) => {
    if (!activeOrder) return;
    setActiveOrder({
      ...activeOrder,
      status: newStatus
    });
  };

  // Complete Delivery
  const handleCompleteDelivery = () => {
    if (!activeOrder) return;

    const completed = activeOrder;
    setActiveOrder(null);
    setSuccessOrder(completed);

    // Update Wallet
    if (completed.modality === 'bodega') {
      const ptsToAdd = completed.pricePoints || 25;
      setWalletStats((prev) => ({
        ...prev,
        pointsBalance: prev.pointsBalance + ptsToAdd,
        todayPoints: prev.todayPoints + ptsToAdd,
        weekPoints: prev.weekPoints + ptsToAdd,
        massivePackagesCount: prev.massivePackagesCount + (completed.stops ? completed.stops.length : 1),
        geoPointsVisited: prev.geoPointsVisited + (completed.stops ? completed.stops.length : 1)
      }));

      // Add to transaction ledger
      const newTx: TransactionHistory = {
        id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
        orderCode: completed.code,
        modality: 'bodega',
        type: 'earning',
        amountPoints: ptsToAdd,
        description: `Entrega masiva bodega (${completed.stops ? completed.stops.length : 1} paquetes)`,
        timestamp: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };
      setTransactions((prev) => [newTx, ...prev]);
    } else {
      // Cash Modality (Exprés / Negocios)
      const cashToAdd = completed.priceCash || 12000;
      const tipToAdd = completed.tip || 0;
      const totalEarned = cashToAdd + tipToAdd;

      setWalletStats((prev) => ({
        ...prev,
        cashBalance: prev.cashBalance + totalEarned,
        todayCash: prev.todayCash + totalEarned,
        weekCash: prev.weekCash + totalEarned,
        cashTips: prev.cashTips + tipToAdd,
        totalKm: parseFloat((prev.totalKm + completed.distanceKm).toFixed(1)),
        completedOrdersCash: prev.completedOrdersCash + 1
      }));

      // Add to transaction ledger
      const newTx: TransactionHistory = {
        id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
        orderCode: completed.code,
        modality: completed.modality,
        type: 'earning',
        amountCash: totalEarned,
        description: `Servicio ${completed.modality === 'express' ? 'Exprés' : 'Negocios'} (${completed.title})`,
        timestamp: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };
      setTransactions((prev) => [newTx, ...prev]);
    }
  };

  // Novelty / Incident Submission
  const handleSubmitIncidentReport = (report: IncidentReport) => {
    setIncidents((prev) => [report, ...prev]);
    if (activeOrder) {
      setActiveOrder(null);
    }
    setActiveTab('incidents');
  };

  // Bodega Stop Toggle
  const handleToggleBodegaStop = (stopId: string) => {
    if (!activeOrder || !activeOrder.stops) return;
    const updatedStops = activeOrder.stops.map((s) => {
      if (s.id === stopId) {
        return {
          ...s,
          status: s.status === 'delivered' ? ('pending' as const) : ('delivered' as const)
        };
      }
      return s;
    });

    setActiveOrder({
      ...activeOrder,
      stops: updatedStops
    });
  };

  // Withdraw and Redeem Handlers
  const handleWithdrawCash = (amount: number, method: string) => {
    setWalletStats((prev) => ({
      ...prev,
      cashBalance: prev.cashBalance - amount
    }));

    const withdrawTx: TransactionHistory = {
      id: 'TXN-WD-' + Math.floor(1000 + Math.random() * 9000),
      orderCode: 'RETIRO',
      modality: 'express',
      type: 'withdrawal',
      amountCash: -amount,
      description: `Retiro a ${method}`,
      timestamp: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    };
    setTransactions((prev) => [withdrawTx, ...prev]);
  };

  const handleRedeemPoints = (points: number) => {
    setWalletStats((prev) => ({
      ...prev,
      pointsBalance: Math.max(0, prev.pointsBalance - points)
    }));

    const redeemTx: TransactionHistory = {
      id: 'TXN-RDM-' + Math.floor(1000 + Math.random() * 9000),
      orderCode: 'CANJE',
      modality: 'bodega',
      type: 'bonus',
      amountPoints: -points,
      description: `Canje de ${points} pts por Bono Combustible`,
      timestamp: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    };
    setTransactions((prev) => [redeemTx, ...prev]);
  };

  // Orders count per mode
  const orderCounts = {
    express: orders.filter((o) => o.modality === 'express' && o.status === 'unassigned').length,
    negocios: orders.filter((o) => o.modality === 'negocios' && o.status === 'unassigned').length,
    bodega: orders.filter((o) => o.modality === 'bodega' && o.status === 'unassigned').length
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header & Telemetry */}
      <Header
        courier={courier}
        onToggleOnline={handleToggleOnline}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        deferredPrompt={deferredPrompt}
        onInstallPwa={handleInstallPwa}
        activeOrderCount={activeOrder ? 1 : 0}
      />

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 pb-28">
        {/* Floating In-flight Order Bar (when on other tabs) */}
        {activeOrder && activeTab !== 'map' && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => setActiveTab('map')}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 border border-cyan-500/50 shadow-lg cursor-pointer flex items-center justify-between gap-3 glow-cyan"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono-tech font-bold text-cyan-300 uppercase">
                    Servicio en Curso ({activeOrder.code})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-tech">• {activeOrder.distanceKm} km</span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">{activeOrder.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 shrink-0 font-mono-tech">
              <span>Ver Ruta</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        )}

        {/* Tab 1: Orders Radar Feed */}
        {activeTab === 'orders' && (
          <motion.div
            key="tab-orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <ModalitySelector
              currentMode={currentMode}
              onSelectMode={(mode) => setCurrentMode(mode)}
              orderCounts={orderCounts}
            />

            <OrdersFeed
              orders={orders}
              currentMode={currentMode}
              onAcceptOrder={handleAcceptOrder}
              onRejectOrder={handleRejectOrder}
              onSimulateOrder={handleSimulateNewOrder}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
            />
          </motion.div>
        )}

        {/* Tab 2: Map & Routing with Live HUD */}
        {activeTab === 'map' && (
          <motion.div
            key="tab-map"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Interactive Map */}
            <div className="h-[48vh] min-h-[340px] w-full">
              <LeafletMapView
                activeOrder={activeOrder}
                courierPos={[courier.currentLat, courier.currentLng]}
                onUpdateCourierPos={(pos) => {
                  setCourier((prev) => ({
                    ...prev,
                    currentLat: pos[0],
                    currentLng: pos[1]
                  }));
                }}
                onArrivedAtDestination={() => {
                  if (activeOrder && activeOrder.status === 'in_transit') {
                    handleAdvanceOrderStatus('at_destination');
                  }
                }}
              />
            </div>

            {/* Active Delivery HUD (if order is running) */}
            {activeOrder ? (
              <ActiveDeliveryHUD
                order={activeOrder}
                onAdvanceStatus={handleAdvanceOrderStatus}
                onOpenCallModal={() => setIsCallModalOpen(true)}
                onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
                onCompleteDelivery={handleCompleteDelivery}
                onToggleBodegaStop={handleToggleBodegaStop}
              />
            ) : (
              /* Ready for Dispatch Info Banner when on Map with no active order */
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-200">Sin ruta activa asignada</h4>
                  <p className="text-xs text-slate-400">Ve a la pestaña "Pedidos" para aceptar o simular un despacho.</p>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <ListOrdered className="w-4 h-4" />
                  <span>Ver Radar</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 3: Wallet & Earnings Balance */}
        {activeTab === 'wallet' && (
          <motion.div
            key="tab-wallet"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <WalletView
              stats={walletStats}
              transactions={transactions}
              onWithdrawCash={handleWithdrawCash}
              onRedeemPoints={handleRedeemPoints}
            />
          </motion.div>
        )}

        {/* Tab 4: Incidents & Returns History */}
        {activeTab === 'incidents' && (
          <motion.div
            key="tab-incidents"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <IncidentsView
              incidents={incidents}
              onBackToOrders={() => setActiveTab('orders')}
            />
          </motion.div>
        )}
      </main>

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800/80 px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          {/* Tab 1: Pedidos */}
          <button
            id="nav-tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'orders'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <ListOrdered className="w-5 h-5" />
              {orders.length > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 font-mono-tech">
                  {orders.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1">Pedidos</span>
          </button>

          {/* Tab 2: Ruta / Mapa */}
          <button
            id="nav-tab-map"
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'map'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <MapIcon className="w-5 h-5" />
              {activeOrder && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1">Ruta & Mapa</span>
          </button>

          {/* Tab 3: Billetera */}
          <button
            id="nav-tab-wallet"
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'wallet'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[11px] mt-1">Billetera</span>
          </button>

          {/* Tab 4: Novedades */}
          <button
            id="nav-tab-incidents"
            onClick={() => setActiveTab('incidents')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'incidents'
                ? 'text-rose-400 bg-rose-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <AlertTriangle className="w-5 h-5" />
              {incidents.length > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white font-mono-tech">
                  {incidents.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1">Novedades</span>
          </button>
        </div>
      </nav>

      {/* Incoming Order Radar Modal */}
      <NewOrderIncomingModal
        order={incomingOrder}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
      />

      {/* Call / Communication Modal */}
      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        order={activeOrder}
      />

      {/* Incident / Devolución Report Modal */}
      <IncidentReportModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        order={activeOrder}
        courierName={courier.name}
        onSubmitReport={handleSubmitIncidentReport}
      />

      {/* Success Celebration Screen */}
      <SuccessDeliveryModal
        order={successOrder}
        onDismiss={() => {
          setSuccessOrder(null);
          setActiveTab('orders');
        }}
      />

      {/* Custom Order Creator Modal */}
      <CreateCustomOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateOrder={(newOrder) => {
          setOrders((prev) => [newOrder, ...prev]);
          setIncomingOrder(newOrder);
        }}
        defaultModality={currentMode}
      />
    </div>
  );
}
