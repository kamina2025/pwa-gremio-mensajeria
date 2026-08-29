import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Navigation, 
  Compass, 
  Layers, 
  Maximize2, 
  MapPin, 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  Store,
  Boxes
} from 'lucide-react';
import { DeliveryOrder, ModalityType } from '../types';

interface LeafletMapViewProps {
  activeOrder: DeliveryOrder | null;
  courierPos: [number, number];
  onUpdateCourierPos?: (pos: [number, number]) => void;
  onArrivedAtDestination?: () => void;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  activeOrder,
  courierPos,
  onUpdateCourierPos,
  onArrivedAtDestination
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [isSimulatingMove, setIsSimulatingMove] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(38);
  const [turnInstruction, setTurnInstruction] = useState('Continúa recto por la avenida principal hacia el destino');

  // Generate route coordinates between points
  const getRouteWaypoints = (): [number, number][] => {
    if (!activeOrder) {
      // Default sample route in Cali / area
      return [
        [3.4516, -76.5320],
        [3.4470, -76.5340],
        [3.4410, -76.5360],
        [3.4350, -76.5380],
        [3.4300, -76.5400],
        [3.4240, -76.5430]
      ];
    }

    const points: [number, number][] = [];
    // Start at pickup
    points.push([activeOrder.pickupLocation.lat, activeOrder.pickupLocation.lng]);

    // Interpolate some intermediate road points for realistic curves
    const pLat = activeOrder.pickupLocation.lat;
    const pLng = activeOrder.pickupLocation.lng;
    const dLat = activeOrder.deliveryLocation.lat;
    const dLng = activeOrder.deliveryLocation.lng;

    points.push([pLat + (dLat - pLat) * 0.25 + 0.002, pLng + (dLng - pLng) * 0.25 - 0.001]);
    points.push([pLat + (dLat - pLat) * 0.5 - 0.001, pLng + (dLng - pLng) * 0.5 + 0.002]);

    if (activeOrder.stops && activeOrder.stops.length > 0) {
      activeOrder.stops.forEach((s) => {
        points.push([s.lat, s.lng]);
      });
    }

    points.push([pLat + (dLat - pLat) * 0.75 + 0.001, pLng + (dLng - pLng) * 0.75]);
    points.push([dLat, dLng]);

    return points;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter: [number, number] = activeOrder
      ? [activeOrder.pickupLocation.lat, activeOrder.pickupLocation.lng]
      : courierPos;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(initialCenter, 14);

    // Dark high-tech CARTO tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Layer group for dynamic markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Polyline when active order or courier position changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. Courier Marker
    const courierIconHtml = `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping"></div>
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg border-2 border-slate-950 font-bold">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
          </svg>
        </div>
      </div>
    `;

    const courierIcon = L.divIcon({
      html: courierIconHtml,
      className: 'courier-pulse-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const courierMarker = L.marker(courierPos, { icon: courierIcon }).addTo(markersGroup);
    courierMarker.bindPopup(`
      <div class="p-2 text-xs font-sans">
        <strong class="text-cyan-400 block font-mono-tech">TU POSICIÓN GPS</strong>
        <p class="text-slate-300">Mensajero en Ruta Activa</p>
      </div>
    `);
    courierMarkerRef.current = courierMarker;

    // If there is an active order, plot origin & destinations
    if (activeOrder) {
      const isBodega = activeOrder.modality === 'bodega';
      const isNegocios = activeOrder.modality === 'negocios';
      const themeColorHex = isBodega ? '#a855f7' : isNegocios ? '#10b981' : '#06b6d4';

      // Pickup Marker (A)
      const pickupIconHtml = `
        <div class="flex items-center justify-center w-8 h-8 rounded-2xl bg-slate-900 border-2 border-cyan-400 text-cyan-300 font-bold text-xs shadow-lg font-mono-tech">
          A
        </div>
      `;
      const pickupMarker = L.marker([activeOrder.pickupLocation.lat, activeOrder.pickupLocation.lng], {
        icon: L.divIcon({
          html: pickupIconHtml,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(markersGroup);

      pickupMarker.bindPopup(`
        <div class="p-2 text-xs font-sans">
          <span class="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono-tech uppercase font-bold text-[10px]">PUNTO DE RECOGIDA</span>
          <h4 class="font-bold text-slate-100 mt-1">${activeOrder.pickupLocation.name}</h4>
          <p class="text-slate-400 text-[11px]">${activeOrder.pickupLocation.address}</p>
        </div>
      `);

      // Bodega multiple stops OR single destination
      if (isBodega && activeOrder.stops && activeOrder.stops.length > 0) {
        activeOrder.stops.forEach((stop, index) => {
          const stopIconHtml = `
            <div class="flex items-center justify-center w-7 h-7 rounded-full bg-purple-900 border-2 border-purple-400 text-purple-200 font-bold text-xs shadow-lg font-mono-tech">
              ${index + 1}
            </div>
          `;
          const stopMarker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
              html: stopIconHtml,
              className: '',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
          }).addTo(markersGroup);

          stopMarker.bindPopup(`
            <div class="p-2 text-xs font-sans">
              <span class="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 font-mono-tech uppercase font-bold text-[10px]">PARADA #${index + 1} (+${stop.pointsValue} pts)</span>
              <h4 class="font-bold text-slate-100 mt-1">${stop.recipientName}</h4>
              <p class="text-slate-400 text-[11px]">${stop.address}</p>
            </div>
          `);
        });
      } else {
        // Single Delivery Marker (B)
        const deliveryIconHtml = `
          <div class="flex items-center justify-center w-8 h-8 rounded-2xl bg-slate-900 border-2 ${
            isNegocios ? 'border-emerald-400 text-emerald-300' : 'border-cyan-400 text-cyan-300'
          } font-bold text-xs shadow-lg font-mono-tech">
            B
          </div>
        `;
        const deliveryMarker = L.marker([activeOrder.deliveryLocation.lat, activeOrder.deliveryLocation.lng], {
          icon: L.divIcon({
            html: deliveryIconHtml,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(markersGroup);

        deliveryMarker.bindPopup(`
          <div class="p-2 text-xs font-sans">
            <span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono-tech uppercase font-bold text-[10px]">DESTINO DE ENTREGA</span>
            <h4 class="font-bold text-slate-100 mt-1">${activeOrder.deliveryLocation.name}</h4>
            <p class="text-slate-400 text-[11px]">${activeOrder.deliveryLocation.address}</p>
          </div>
        `);
      }

      // Draw Route Polyline
      const waypoints = getRouteWaypoints();
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
      }

      const polyline = L.polyline(waypoints, {
        color: themeColorHex,
        weight: 5,
        opacity: 0.85,
        dashArray: isBodega ? '6, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      routePolylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [activeOrder, courierPos]);

  // GPS Movement Simulation Interval
  useEffect(() => {
    if (!isSimulatingMove) return;

    const waypoints = getRouteWaypoints();
    const interval = setInterval(() => {
      setSimulationIndex((prev) => {
        const next = (prev + 1) % waypoints.length;
        const newCoord = waypoints[next];
        if (onUpdateCourierPos) {
          onUpdateCourierPos(newCoord);
        }

        // Update instruction text dynamically
        if (next === 1) {
          setTurnInstruction('En 250m: Gira a la derecha en Calle 5 hacia Av. Roosevelt');
          setCurrentSpeed(42);
        } else if (next === 2) {
          setTurnInstruction('Continúa por la calzada derecha durante 1.2 km');
          setCurrentSpeed(46);
        } else if (next === 3) {
          setTurnInstruction('Atención: Reductor de velocidad en 100m, prepárate para girar');
          setCurrentSpeed(28);
        } else if (next === waypoints.length - 1) {
          setTurnInstruction('¡Has llegado al punto de entrega! Notifica al cliente.');
          setCurrentSpeed(0);
          setIsSimulatingMove(false);
          if (onArrivedAtDestination) {
            onArrivedAtDestination();
          }
        }

        return next;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [isSimulatingMove, activeOrder, onUpdateCourierPos, onArrivedAtDestination]);

  const handleCenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(courierPos, 16, { animate: true });
    }
  };

  const handleFitRoute = () => {
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.fitBounds(routePolylineRef.current.getBounds(), {
        padding: [60, 60],
        animate: true
      });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex flex-col">
      {/* Turn-by-Turn Navigation HUD Overlay */}
      {activeOrder && (
        <div className="absolute top-3 left-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-sm shadow-cyan-500/30">
              <Navigation className="w-5 h-5 -rotate-45 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100 leading-snug">{turnInstruction}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono-tech text-slate-400">
                <span className="text-cyan-400 font-bold">{currentSpeed} km/h</span>
                <span>•</span>
                <span className="text-slate-300">ETA ~{activeOrder.estimatedMinutes} min</span>
                <span>•</span>
                <span className="text-slate-400">{activeOrder.distanceKm} km restantes</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-mono-tech">
              GPS LOCK
            </span>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full flex-1 z-10" />

      {/* Floating Map Controls */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          id="btn-recenter-map"
          onClick={handleCenterMap}
          className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-700 shadow-xl transition active:scale-95"
          title="Centrar en mi ubicación"
        >
          <Compass className="w-5 h-5" />
        </button>

        {activeOrder && (
          <button
            id="btn-fit-route"
            onClick={handleFitRoute}
            className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-xl transition active:scale-95"
            title="Ver toda la ruta"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        )}

        {activeOrder && (
          <button
            id="btn-simulate-gps"
            onClick={() => setIsSimulatingMove(!isSimulatingMove)}
            className={`p-3 rounded-xl border shadow-xl transition active:scale-95 flex items-center justify-center ${
              isSimulatingMove
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'
            }`}
            title={isSimulatingMove ? 'Pausar Simulación GPS' : 'Simular Movimiento GPS'}
          >
            {isSimulatingMove ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
        )}
      </div>

      {/* GPS Simulation Status Pill */}
      {isSimulatingMove && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-amber-950/90 backdrop-blur-md border border-amber-500/60 px-3 py-1.5 rounded-xl text-amber-300 text-xs font-mono-tech flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Simulando conducción en tiempo real...</span>
        </div>
      )}
    </div>
  );
};
