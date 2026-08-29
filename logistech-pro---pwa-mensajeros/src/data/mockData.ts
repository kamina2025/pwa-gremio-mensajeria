import { DeliveryOrder, ModalityType, WalletStats, TransactionHistory } from '../types';

// Pricing formula helpers
export const calculatePriceForOrder = (
  modality: ModalityType,
  distanceKm: number,
  estimatedMinutes: number,
  packageCount: number = 1
): { priceCash?: number; pricePoints?: number } => {
  if (modality === 'express') {
    // Base $3.800 + $1.200/km + $250/min
    const base = 3800;
    const distanceCost = Math.round(distanceKm * 1200);
    const timeCost = Math.round(estimatedMinutes * 250);
    const total = Math.round((base + distanceCost + timeCost) / 100) * 100;
    return { priceCash: total };
  } else if (modality === 'negocios') {
    // Base $4.200 + $1.400/km + $300/min
    const base = 4200;
    const distanceCost = Math.round(distanceKm * 1400);
    const timeCost = Math.round(estimatedMinutes * 300);
    const total = Math.round((base + distanceCost + timeCost) / 100) * 100;
    return { priceCash: total };
  } else {
    // Bodega (Logística masiva): Base 10 pts + 4 pts por paquete/parada
    const points = 10 + packageCount * 4 + Math.round(distanceKm * 0.8);
    return { pricePoints: Math.max(15, points) };
  }
};

export const initialOrders: DeliveryOrder[] = [
  {
    id: 'ORD-EXP-7821',
    code: 'EXP-7821',
    modality: 'express',
    title: 'Entrega Urgente de Documentos Notariales',
    senderName: 'Notaría 4 de Cali',
    senderPhone: '+57 312 458 9912',
    recipientName: 'Carlos Mario Benítez',
    recipientPhone: '+57 301 776 2309',
    pickupLocation: {
      lat: 3.4516,
      lng: -76.5320,
      name: 'Notaría 4 - Edificio Versalles',
      address: 'Avenida 5N # 21-45, Cali',
      notes: 'Preguntar en ventanilla 3 por sobre sellado'
    },
    deliveryLocation: {
      lat: 3.4372,
      lng: -76.5225,
      name: 'Oficinas Grupo Alfa',
      address: 'Calle 13 # 4-22, Oficina 502',
      notes: 'Timbre 502 en recepción del edificio'
    },
    distanceKm: 3.8,
    estimatedMinutes: 14,
    packageDescription: 'Sobre manila sellado con documentos confidenciales',
    packageWeightKg: 0.4,
    priceCash: 11800,
    paymentMethod: 'Pagado Digital',
    amountToCollect: 0,
    tip: 2000,
    urgency: 'alta',
    createdAt: 'Hace 4 minutos',
    status: 'unassigned'
  },
  {
    id: 'ORD-NEG-4490',
    code: 'NEG-4490',
    modality: 'negocios',
    title: 'Restaurante El Corral Gourmet - Combo Hamburguesas',
    senderName: 'El Corral Gourmet Granada',
    senderPhone: '+57 320 889 0041',
    recipientName: 'Valeria Restrepo',
    recipientPhone: '+57 315 662 1088',
    pickupLocation: {
      lat: 3.4578,
      lng: -76.5362,
      name: 'El Corral Granada',
      address: 'Avenida 9N # 12N-14, Barrio Granada',
      notes: 'Entrada mensajeros por el lateral, código #COR-99'
    },
    deliveryLocation: {
      lat: 3.4180,
      lng: -76.5410,
      name: 'Residencial San Fernando Plaza',
      address: 'Carrera 34 # 4B-50, Apto 401 Torre B',
      notes: 'Dejar en portería con vigilante o subir previa autorización'
    },
    distanceKm: 5.6,
    estimatedMinutes: 22,
    packageDescription: '2 Combos Vaquero + Malteadas (Bolsa térmica obligatoria)',
    packageWeightKg: 1.8,
    priceCash: 16500,
    paymentMethod: 'Efectivo (Contraentrega)',
    amountToCollect: 54000,
    tip: 3500,
    urgency: 'alta',
    createdAt: 'Hace 8 minutos',
    status: 'unassigned'
  },
  {
    id: 'ORD-BOD-9023',
    code: 'BOD-9023',
    modality: 'bodega',
    title: 'Ruta Masiva Zona Sur - 4 Entregas Geográficas',
    senderName: 'Centro de Distribución Bodega Principal Sur',
    senderPhone: '+57 300 900 1122',
    recipientName: 'Múltiples Clientes (Ruta Consolidada)',
    recipientPhone: '+57 300 900 1122',
    pickupLocation: {
      lat: 3.4720,
      lng: -76.5180,
      name: 'CEDI Logístico Acopi / Yumbo',
      address: 'Zona Industrial Calle 15 # 28-90 Muelle 4',
      notes: 'Presentar carné de mensajero en garita principal'
    },
    deliveryLocation: {
      lat: 3.3980,
      lng: -76.5480,
      name: 'Última Parada: Ciudad Jardín',
      address: 'Carrera 105 # 14-80, Cali Sur',
      notes: 'Ruta optimizada con 4 paradas consecutivas'
    },
    stops: [
      {
        id: 'stp-1',
        recipientName: 'Paola Andrea Muñoz',
        address: 'Calle 9 # 44-12, Los Cámbulos',
        lat: 3.4240,
        lng: -76.5430,
        packageCode: 'PKG-771-A',
        pointsValue: 8,
        status: 'pending',
        phone: '+57 318 440 9981'
      },
      {
        id: 'stp-2',
        recipientName: 'Jorge Eduardo Tovar',
        address: 'Carrera 56 # 11-20, Camino Real',
        lat: 3.4110,
        lng: -76.5390,
        packageCode: 'PKG-771-B',
        pointsValue: 8,
        status: 'pending',
        phone: '+57 310 551 2299'
      },
      {
        id: 'stp-3',
        recipientName: 'Farmacia La Riviera',
        address: 'Calle 16 # 80-45, El Ingenio',
        lat: 3.3890,
        lng: -76.5350,
        packageCode: 'PKG-771-C',
        pointsValue: 10,
        status: 'pending',
        phone: '+57 317 882 1010'
      },
      {
        id: 'stp-4',
        recipientName: 'Felipe Morales',
        address: 'Carrera 105 # 14-80, Ciudad Jardín',
        lat: 3.3760,
        lng: -76.5420,
        packageCode: 'PKG-771-D',
        pointsValue: 9,
        status: 'pending',
        phone: '+57 316 990 4455'
      }
    ],
    distanceKm: 14.2,
    estimatedMinutes: 45,
    packageDescription: '4 Paquetes e-commerce medianos etiquetados con código QR',
    packageWeightKg: 7.5,
    pricePoints: 35,
    paymentMethod: 'Créditos Bodega',
    urgency: 'media',
    createdAt: 'Hace 12 minutos',
    status: 'unassigned'
  }
];

export const initialWalletStats: WalletStats = {
  cashBalance: 168400,
  todayCash: 58200,
  weekCash: 412000,
  cashTips: 18500,
  totalKm: 56.4,
  activeHours: 6.5,
  completedOrdersCash: 8,
  
  pointsBalance: 1120,
  todayPoints: 85,
  weekPoints: 490,
  massivePackagesCount: 164,
  geoPointsVisited: 58,
  bodegaAccuracyRate: 99.2
};

export const initialTransactions: TransactionHistory[] = [
  {
    id: 'TXN-901',
    orderCode: 'EXP-7610',
    modality: 'express',
    type: 'earning',
    amountCash: 14500,
    description: 'Entrega Exprés Centro a Norte',
    timestamp: 'Hoy, 15:40'
  },
  {
    id: 'TXN-902',
    orderCode: 'NEG-3901',
    modality: 'negocios',
    type: 'earning',
    amountCash: 18200,
    description: 'Pedido Restaurante Pizzería Romana',
    timestamp: 'Hoy, 14:15'
  },
  {
    id: 'TXN-903',
    orderCode: 'BOD-8812',
    modality: 'bodega',
    type: 'earning',
    amountPoints: 42,
    description: 'Ruta masiva CEDI Yumbo - 5 Puntos',
    timestamp: 'Hoy, 12:30'
  },
  {
    id: 'TXN-904',
    orderCode: 'TIP-3901',
    modality: 'negocios',
    type: 'tip',
    amountCash: 4000,
    description: 'Propina digital de cliente agradecido',
    timestamp: 'Hoy, 14:18'
  }
];
