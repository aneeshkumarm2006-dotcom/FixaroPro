"use client";

import { useMemo, useState } from "react";
import {
  useServiceCatalog,
  useServiceCategories,
  useService,
  useBasePrice,
  usePolicy,
} from "@/lib/config/ServiceConfigProvider";
import { type ServiceConfigItem } from "@/lib/config/types";

interface JobTypeSelectorProps {
  initialValue?: string | null;
}

/**
 * Admin job-type picker. Same vocabulary as the customer booking flow: this
 * stores the catalog SERVICE VALUE (e.g. "DRYWALL_REPAIR") in Job.jobType, not
 * a free-text label. That is what makes an admin-created job visible on the
 * crew board (which filters `jobType in eligibleTypes`) and what lets the
 * equipment checklist + kit matching resolve for it.
 *
 * The catalog comes from the runtime config (admin-editable ServiceCatalogItem),
 * never from the SERVICE_CATALOG seed constants — so a service an admin adds or
 * retires shows up here without a deploy.
 */
export default function JobTypeSelector({ initialValue }: JobTypeSelectorProps) {
  const catalog = useServiceCatalog();
  const categories = useServiceCategories();
  const policy = usePolicy();
  const basePriceFor = useBasePrice();

  const [jobType, setJobType] = useState(initialValue || "");
  const selected = useService(jobType);

  // A job already on a RETIRED service keeps its label instead of rendering the
  // raw enum code — activeServices() excludes it, so look it up unfiltered.
  const selectedLabel = useMemo(() => {
    if (!jobType) return "";
    return selected?.label ?? jobType;
  }, [jobType, selected]);

  const [activeCategory, setActiveCategory] = useState<string>(
    () => selected?.category ?? categories[0] ?? ""
  );

  const servicesInCategory = catalog.filter((s) => s.category === activeCategory);

  function selectService(item: ServiceConfigItem) {
    setJobType(item.value);
    prefillPrice(item);
  }

  /**
   * Prefill the Price field from the catalog, exactly the way the booking flow
   * prices a fresh booking:
   *   hourly → the booking minimum at the configured rate (package-aware)
   *   fixed  → the service's fixed price (one unit)
   *   quote  → left blank; the number arrives from the quote/bid flow
   *
   * Only ever fills a BLANK price — the admin override (and an existing job's
   * saved price) is never clobbered.
   */
  function prefillPrice(item: ServiceConfigItem) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("price") as HTMLInputElement | null;
    if (!el || el.value.trim() !== "") return;
    if (item.pricing === "quote") return;

    const units =
      item.pricing === "fixed" && item.fixedPricePerUnit
        ? 1
        : policy.minBookingHours;
    const price = basePriceFor(units, item.value);
    if (!price) return;

    el.value = price.toFixed(2);
    // PriceSummary listens for "input", so the totals update with the prefill.
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div>
      {/* The value the server action persists to Job.jobType. */}
      <input type="hidden" name="jobType" value={jobType} />

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${
                activeCategory === cat ? "var(--accent)" : "rgba(28,25,23,0.15)"
              }`,
              background: activeCategory === cat ? "var(--accent)" : "#fff",
              color: activeCategory === cat ? "#fff" : "var(--ink)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services in the active category */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 6,
          maxHeight: 220,
          overflowY: "auto",
          padding: 2,
        }}
      >
        {servicesInCategory.map((s) => {
          const isSelected = s.value === jobType;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => selectService(s)}
              title={s.priceNote ?? undefined}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${
                  isSelected ? "var(--accent)" : "rgba(28,25,23,0.12)"
                }`,
                background: isSelected ? "rgba(232,93,4,0.06)" : "#fff",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                lineHeight: 1.3,
              }}
            >
              {s.label}
              {s.priceNote && (
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 400,
                    color: "var(--primary-50)",
                    marginTop: 2,
                  }}
                >
                  {s.priceNote}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 8, fontSize: 12, color: "var(--primary-60)" }}>
        {jobType ? (
          <>
            Selected: <strong>{selectedLabel}</strong>
            {selected && selected.pricing === "quote" && " · custom quote"}
          </>
        ) : (
          "No service selected yet."
        )}
      </p>
    </div>
  );
}
