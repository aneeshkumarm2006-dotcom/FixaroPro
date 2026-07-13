"use client";

// Client access to the runtime config (SOP §3, stage 8).
//
// Client components can't query the DB, but they must not fall back to a second,
// stale copy of the catalog either — that is exactly the bug Stage 8 exists to
// remove. So each route group's server layout loads the config once and hands it
// to this provider; every client component below reads it through these hooks.
//
// The context DEFAULT is DEFAULT_RUNTIME_CONFIG (the TS seed constants), so a
// client component rendered outside a provider degrades to the seed catalog
// rather than crashing — the same fallback the server loader uses. That keeps
// the blast radius of a missed provider to "shows seed labels", not "white page".

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_RUNTIME_CONFIG } from "./defaults";
import {
  activeCategories,
  activePaintingScopes,
  activeServices,
  computeHourlyPrice,
  findService,
  materialsFor,
  paintingQuoteRange,
  pricingModelFor,
  resolveBasePrice,
  serviceLabel,
  type MaterialsPricing,
  type PaintingScopeConfig,
  type RuntimeConfig,
  type ServiceConfigItem,
  type ServicePricingType,
} from "./types";

const ServiceConfigContext = createContext<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);

export function ServiceConfigProvider({
  config,
  children,
}: {
  config: RuntimeConfig;
  children: React.ReactNode;
}) {
  return (
    <ServiceConfigContext.Provider value={config}>
      {children}
    </ServiceConfigContext.Provider>
  );
}

/** The whole config. Prefer a narrower hook below where one fits. */
export function useRuntimeConfig(): RuntimeConfig {
  return useContext(ServiceConfigContext);
}

/** Bookable services only — retired services (D0.2) are excluded. */
export function useServiceCatalog(): ServiceConfigItem[] {
  const cfg = useRuntimeConfig();
  return useMemo(() => activeServices(cfg), [cfg]);
}

/** Categories that still contain at least one active service. */
export function useServiceCategories(): string[] {
  const cfg = useRuntimeConfig();
  return useMemo(() => activeCategories(cfg), [cfg]);
}

export function useService(
  serviceType: string | null | undefined
): ServiceConfigItem | null {
  const cfg = useRuntimeConfig();
  return useMemo(() => findService(cfg, serviceType), [cfg, serviceType]);
}

export function useMaterialsPricing(
  serviceType: string | null | undefined
): MaterialsPricing | null {
  const cfg = useRuntimeConfig();
  return useMemo(() => materialsFor(cfg, serviceType), [cfg, serviceType]);
}

export function usePricingModel(
  serviceType: string | null | undefined
): ServicePricingType {
  const cfg = useRuntimeConfig();
  return useMemo(() => pricingModelFor(cfg, serviceType), [cfg, serviceType]);
}

export function usePaintingScopes(): PaintingScopeConfig[] {
  const cfg = useRuntimeConfig();
  return useMemo(() => activePaintingScopes(cfg), [cfg]);
}

/** Customer-facing painting quote range for a scope = baseline × surplus rate. */
export function usePaintingQuoteRange() {
  const cfg = useRuntimeConfig();
  return useMemo(
    () => (key: string | null | undefined) => paintingQuoteRange(cfg, key),
    [cfg]
  );
}

/**
 * Human label for a Job.jobType — the calendar, job cards and CRM surfaces all
 * render through this, so a service added or renamed in the admin catalog shows
 * up everywhere without a deploy (and never renders as a raw enum code).
 */
export function useServiceLabel() {
  const cfg = useRuntimeConfig();
  return useMemo(
    () => (serviceType: string | null | undefined) => serviceLabel(cfg, serviceType),
    [cfg]
  );
}

/** Booked labour price for a service at N hours/units, at the configured rate. */
export function useBasePrice() {
  const cfg = useRuntimeConfig();
  return useMemo(
    () => (hours: number, serviceType: string | null | undefined) =>
      resolveBasePrice(cfg, hours, serviceType),
    [cfg]
  );
}

/** Hourly labour price at the configured rate + 3-hour package. */
export function useHourlyPrice() {
  const cfg = useRuntimeConfig();
  return useMemo(
    () => (hours: number) =>
      computeHourlyPrice(
        hours,
        cfg.policy.labourRate,
        cfg.policy.threeHourPackage
      ),
    [cfg]
  );
}

/** Policy values (fees, windows, rates) for customer/provider-facing copy. */
export function usePolicy() {
  return useRuntimeConfig().policy;
}
