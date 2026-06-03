"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue with Next.js bundling
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const TYPE_COLORS: Record<string, string> = {
  DOOR_KNOCK: "#e85d04",
  FLYER_DROP: "#0EA5E9",
  REFERRAL: "#10B981",
  ONLINE_AD: "#8B5CF6",
  SOCIAL_MEDIA: "#F59E0B",
  OTHER: "#6B7280",
};

const TYPE_LABELS: Record<string, string> = {
  DOOR_KNOCK: "Door Knock",
  FLYER_DROP: "Flyer Drop",
  REFERRAL: "Referral",
  ONLINE_AD: "Online Ad",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
};

function createColoredIcon(color: string) {
  return L.divIcon({
    html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

interface SalesArea {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string | null;
  notes: string | null;
  date: string;
  createdAt: string;
}

interface SalesMapViewProps {
  salesAreas: SalesArea[];
  onPinClick?: (area: SalesArea) => void;
}

function FitBounds({ salesAreas }: { salesAreas: SalesArea[] }) {
  const map = useMap();

  useEffect(() => {
    if (salesAreas.length === 0) return;

    if (salesAreas.length === 1) {
      map.setView(
        [salesAreas[0].latitude, salesAreas[0].longitude],
        13
      );
    } else {
      const bounds = L.latLngBounds(
        salesAreas.map((a) => [a.latitude, a.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [salesAreas, map]);

  return null;
}

export default function SalesMapView({
  salesAreas,
  onPinClick,
}: SalesMapViewProps) {
  const defaultCenter: [number, number] = [45.5017, -73.5673]; // Montreal

  return (
    <div className="relative">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ height: "400px", width: "100%" }}
        className="rounded-xl z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds salesAreas={salesAreas} />
        {salesAreas.map((area) => (
          <Marker
            key={area.id}
            position={[area.latitude, area.longitude]}
            icon={createColoredIcon(
              TYPE_COLORS[area.type] || TYPE_COLORS.OTHER
            )}
            eventHandlers={{
              click: () => onPinClick?.(area),
            }}>
            <Popup>
              <div className="text-sm">
                <p className="font-[500] text-[#1c1917]">{area.name}</p>
                <p className="text-xs text-gray-500">
                  {TYPE_LABELS[area.type] || area.type}
                </p>
                {area.address && (
                  <p className="text-xs text-gray-400 mt-1">{area.address}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(area.date).toLocaleDateString("en-US")}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-sm rounded-lg shadow-sm p-3">
        <p className="text-xs font-[400] text-gray-600 mb-1.5">Pin Types</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ background: TYPE_COLORS[key] }}
              />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
