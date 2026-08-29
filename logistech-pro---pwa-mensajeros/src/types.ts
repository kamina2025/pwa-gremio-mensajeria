export type ModalityType = 'express' | 'negocios' | 'bodega';

export type OrderStatus = 
  | 'unassigned'
  | 'assigned'
  | 'heading_to_pickup'
  | 'at_pickup'
  | 'in_transit'
  | 'at_destination'
  | 'delivered'
  | 'returned_with_incident'
  | 'cancelled';

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
  name: string;
  notes?: string;
}

export interface BodegaStop {
  id: string;
  recipientName: string;
  address: string;
  lat: number;
  lng: number;
  packageCode: string;
  pointsValue: number;
  status: 'pending' | 'delivered' | 'incident';
  phone: string;
}

export interface DeliveryOrder {
  id: string;
  code: string;
  modality: ModalityType;
  title: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  pickupLocation: LocationPoint;
  deliveryLocation: LocationPoint;
  stops?: BodegaStop[]; // For massive bodega logistics with multi-point drops
  distanceKm: number;
  estimatedMinutes: number;
  packageDescription: string;
  packageWeightKg?: number;
  priceCash?: number; // In currency for express & negocios (e.g., $14.500)
  pricePoints?: number; // In credits/points for bodega (e.g., 25 pts)
  paymentMethod: 'Efectivo (Contraentrega)' | 'Pagado Digital' | 'Créditos Bodega';
  amountToCollect?: number;
  tip?: number;
  urgency: 'alta' | 'media' | 'baja';
  createdAt: string;
  status: OrderStatus;
  incident?: IncidentReport;
  deliveryProof?: {
    recipientSignature?: string;
    photoUrl?: string;
    receivedBy?: string;
    deliveredAt?: string;
  };
}

export interface IncidentReport {
  id: string;
  orderId: string;
  orderCode: string;
  causal: 
    | 'Dirección incorrecta / No existe'
    | 'Cliente ausente / No responde llamadas'
    | 'Zona peligrosa o acceso restringido'
    | 'Paquete averiado / Mal estado en tránsito'
    | 'Cliente rechaza el pedido o valor'
    | 'Falla mecánica del mensajero'
    | 'Condiciones climáticas extremas';
  notes: string;
  photoEvidence?: string;
  timestamp: string;
  returnedToOrigin: boolean;
  courierName: string;
}

export interface CourierProfile {
  name: string;
  idNumber: string;
  vehicleType: 'Motocicleta' | 'Bicicleta' | 'Automóvil' | 'Furgón';
  plate: string;
  rating: number;
  level: 'Novato' | 'Pro' | 'Elite Oro';
  isOnline: boolean;
  batteryLevel: number;
  currentLat: number;
  currentLng: number;
}

export interface WalletStats {
  cashBalance: number; // For express & negocios
  todayCash: number;
  weekCash: number;
  cashTips: number;
  totalKm: number;
  activeHours: number;
  completedOrdersCash: number;
  
  // Bodega points system
  pointsBalance: number; // Credits/points
  todayPoints: number;
  weekPoints: number;
  massivePackagesCount: number;
  geoPointsVisited: number;
  bodegaAccuracyRate: number;
}

export interface TransactionHistory {
  id: string;
  orderCode: string;
  modality: ModalityType;
  type: 'earning' | 'tip' | 'bonus' | 'withdrawal';
  amountCash?: number;
  amountPoints?: number;
  description: string;
  timestamp: string;
}
