"use client";

// Admin editor for the config layer (SOP §3, stage 8).
//
// Four tabs, one per thing that used to be a TypeScript constant:
//   Services  — the catalog + each service's pricing model, fixed price and
//               materials/equipment amount + type (SOP §5)
//   Painting  — the §7 internal cost baselines behind the customer quote range
//   Policy    — every fee, window and rate, rendered from the registry so each
//               one carries its label, help text and validation rule (SOP §2.3)
//   Export/Import — the per-environment config transfer §3 requires (8.2)

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Paintbrush,
  SlidersHorizontal,
  ArrowLeftRight,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import type {
  RuntimeConfig,
  ServiceConfigItem,
  PaintingScopeConfig,
  ServicePricingType,
  MaterialsType,
} from "@/lib/config/types";
import {
  materialsLineLabel,
  paintingQuoteRange,
  resolveBasePrice,
} from "@/lib/config/types";
import type { PolicySettingDef, PolicyGroup } from "@/lib/config/policy-registry";
import {
  saveServiceCatalogItem,
  setServiceActive,
  seedServiceCatalog,
} from "../actions/updateServiceCatalog";
import {
  savePaintingBaseline,
  setPaintingBaselineActive,
} from "../actions/updatePaintingBaselines";
import {
  updatePolicySettings,
  resetPolicySettings,
} from "../actions/updatePolicySettings";
import {
  exportConfig,
  previewConfigImport,
  applyConfigImport,
} from "../actions/configIo";
import type { ConfigDiff } from "@/lib/config/config-io";

type Tab = "services" | "painting" | "policy" | "io";
type Msg = { type: "success" | "error"; text: string } | null;

const PRICING_LABELS: Record<ServicePricingType, string> = {
  hourly: "Hourly — billable clocked hours × labour rate",
  fixed: "Fixed — a set price, optionally per unit",
  quote: "Quote — bid- or quote-derived (painting, mouldings)",
};

const MATERIALS_LABELS: Record<MaterialsType, string> = {
  deposit: "Deposit — refundable, captured upfront, apply/refund controls",
  cost: "Cost — billed on the final invoice, nothing captured upfront",
  charge: "Charge — flat, captured upfront, NOT a deposit (painting's $119)",
};

export default function ServiceCatalogClient({
  config,
  policyDefs,
  openJobsByService,
}: {
  config: RuntimeConfig;
  policyDefs: PolicySettingDef[];
  openJobsByService: Record<string, number>;
}) {
  const [tab, setTab] = useState<Tab>("services");
  const router = useRouter();

  const TABS: { id: Tab; label: string; Icon: typeof Wrench }[] = [
    { id: "services", label: "Services", Icon: Wrench },
    { id: "painting", label: "Painting baselines", Icon: Paintbrush },
    { id: "policy", label: "Policy & pricing", Icon: SlidersHorizontal },
    { id: "io", label: "Export / Import", Icon: ArrowLeftRight },
  ];

  return (
    <div className="admin-font p-8">
      <header style={{ marginBottom: 22 }}>
        <p className="eyebrow">Admin</p>
        <h1
          className="display"
          style={{ fontSize: "clamp(32px, 4.2vw, 46px)", marginTop: 6 }}>
          Service catalog{" "}
          <span
            style={{
              color: "var(--primary-40)",
              fontWeight: 300,
              fontFamily: "var(--font-serif)",
            }}>
            · {config.services.length}
          </span>
        </h1>
        <p className="subtitle" style={{ marginTop: 10, fontSize: 15.5 }}>
          Services, materials pricing, painting baselines and policy values. Edits apply
          immediately across booking, the quote form, the handyman portal and billing —
          and are audit-logged.
        </p>
      </header>

      {config.source === "defaults" && (
        <Callout tone="warn">
          <strong>Catalog not seeded.</strong> The config tables are empty, so Fixaro is
          serving the built-in defaults. Nothing is broken — but edits here will not take
          effect until the catalog is seeded.{" "}
          <SeedButton onDone={() => router.refresh()} />
        </Callout>
      )}

      <div className="atabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`atab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}>
            <t.Icon size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "services" && (
          <ServicesTab config={config} openJobsByService={openJobsByService} />
        )}
        {tab === "painting" && <PaintingTab config={config} />}
        {/* `key` remounts the tab whenever the saved policy changes, so its form
            state is rebuilt from the new config. Without it, "Reset to defaults"
            → router.refresh() left the inputs holding the PRE-reset numbers,
            every field flagged "unsaved", and one more click on Save would write
            the old labour rate and cancellation fee straight back over the
            reset. */}
        {tab === "policy" && (
          <PolicyTab
            key={JSON.stringify(config.policy)}
            config={config}
            defs={policyDefs}
          />
        )}
        {tab === "io" && <ExportImportTab />}
      </div>
    </div>
  );
}

// ── Services ───────────────────────────────────────────────────────────────

function ServicesTab({
  config,
  openJobsByService,
}: {
  config: RuntimeConfig;
  openJobsByService: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceConfigItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  const byCategory = useMemo(() => {
    const m = new Map<string, ServiceConfigItem[]>();
    for (const s of config.services) {
      const list = m.get(s.category) ?? [];
      list.push(s);
      m.set(s.category, list);
    }
    return m;
  }, [config.services]);

  function toggleActive(s: ServiceConfigItem) {
    const open = openJobsByService[s.value] ?? 0;
    if (
      s.active &&
      !confirm(
        `Retire "${s.label}"?\n\nIt disappears from the booking page, the quote form and new-job targeting.\n\n` +
          `${open} open job(s) on this service keep running, and nothing in history changes. You can restore it at any time.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setServiceActive(s.value, !s.active);
      if (res.success) {
        setMsg({
          type: "success",
          text: s.active ? `${s.label} retired.` : `${s.label} is bookable again.`,
        });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error ?? "Failed." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "var(--primary-60)", margin: 0 }}>
          A service&apos;s <strong>pricing model</strong> (how labour is billed) and its{" "}
          <strong>materials type</strong> (what the §5 amount means) are independent —
          any combination is valid.
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}>
          <Plus size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} /> Add service
        </button>
      </div>

      {msg && <Feedback msg={msg} />}

      {creating && (
        <ServiceForm
          config={config}
          initial={null}
          onClose={() => setCreating(false)}
          onSaved={(text) => {
            setCreating(false);
            setMsg({ type: "success", text });
            router.refresh();
          }}
        />
      )}

      {[...byCategory.entries()].map(([category, services]) => (
        <section key={category}>
          <h4
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: ".06em",
              color: "var(--primary-40)",
              marginBottom: 10,
            }}>
            {category}
          </h4>
          <div className="atable-wrap">
            <div className="atable-scroll">
              <table className="atable">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Pricing</th>
                    <th>Base price (2h / 1 unit)</th>
                    <th>Materials &amp; equipment</th>
                    <th>Status</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const materials =
                      s.materialsAmount != null && s.materialsType != null
                        ? {
                            amount: s.materialsAmount,
                            type: s.materialsType,
                            note: s.materialsNote,
                          }
                        : null;
                    const open = openJobsByService[s.value] ?? 0;
                    const example =
                      s.pricing === "quote"
                        ? "—"
                        : `$${resolveBasePrice(
                            config,
                            s.fixedPricePerUnit ? 1 : config.policy.minBookingHours,
                            s.value
                          ).toFixed(2)}`;
                    return (
                      <tr key={s.value} style={{ opacity: s.active ? 1 : 0.55 }}>
                        <td style={{ whiteSpace: "normal", maxWidth: 240 }}>
                          <div style={{ fontWeight: 500 }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "var(--primary-50)", marginTop: 2 }}>
                            {s.value}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 13 }}>{s.pricing}</span>
                          {s.pricing === "fixed" && s.fixedPrice != null && (
                            <div style={{ fontSize: 11, color: "var(--primary-60)" }}>
                              ${s.fixedPrice}
                              {s.fixedPricePerUnit ? " / unit" : " flat"}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>{example}</td>
                        <td style={{ whiteSpace: "normal", maxWidth: 260, fontSize: 13 }}>
                          {materials ? (
                            materialsLineLabel(materials)
                          ) : (
                            <span style={{ color: "var(--primary-50)" }}>
                              None — no materials charge
                            </span>
                          )}
                        </td>
                        <td>
                          {s.active ? (
                            <span className="pill" style={{ background: "#d1fae5", color: "#065f46" }}>
                              Active
                            </span>
                          ) : (
                            <span className="pill" style={{ background: "#f1f5f9", color: "#475569" }}>
                              Retired
                            </span>
                          )}
                          {open > 0 && (
                            <div style={{ fontSize: 11, color: "var(--primary-60)", marginTop: 3 }}>
                              {open} open job{open === 1 ? "" : "s"}
                            </div>
                          )}
                        </td>
                        <td className="col-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditing(s);
                              setCreating(false);
                            }}>
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ marginLeft: 6 }}
                            disabled={pending}
                            onClick={() => toggleActive(s)}>
                            {s.active ? "Retire" : "Restore"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      {editing && (
        <ServiceForm
          config={config}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMsg({ type: "success", text });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ServiceForm({
  config,
  initial,
  onClose,
  onSaved,
}: {
  config: RuntimeConfig;
  initial: ServiceConfigItem | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isNew = initial == null;
  const [value, setValue] = useState(initial?.value ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? config.categories[0] ?? ""
  );
  const [pricing, setPricing] = useState<ServicePricingType>(initial?.pricing ?? "hourly");
  const [priceNote, setPriceNote] = useState(initial?.priceNote ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [fixedPrice, setFixedPrice] = useState<string>(
    initial?.fixedPrice != null ? String(initial.fixedPrice) : ""
  );
  const [fixedPricePerUnit, setFixedPricePerUnit] = useState(
    initial?.fixedPricePerUnit ?? false
  );
  const [hasMaterials, setHasMaterials] = useState(
    initial?.materialsAmount != null && initial?.materialsType != null
  );
  const [materialsAmount, setMaterialsAmount] = useState<string>(
    initial?.materialsAmount != null ? String(initial.materialsAmount) : ""
  );
  const [materialsType, setMaterialsType] = useState<MaterialsType>(
    initial?.materialsType ?? "cost"
  );
  const [materialsNote, setMaterialsNote] = useState(initial?.materialsNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveServiceCatalogItem({
        value: value.trim().toUpperCase(),
        label,
        category,
        pricing,
        priceNote: priceNote || null,
        active,
        sortOrder: initial?.sortOrder,
        fixedPrice: pricing === "fixed" ? Number(fixedPrice) : null,
        fixedPricePerUnit: pricing === "fixed" ? fixedPricePerUnit : false,
        materialsAmount: hasMaterials ? Number(materialsAmount) : null,
        materialsType: hasMaterials ? materialsType : null,
        materialsNote: hasMaterials ? materialsNote || null : null,
      });
      if (res.success) {
        onSaved(`${label} saved.`);
      } else {
        setError(res.error ?? "Failed to save.");
      }
    });
  }

  return (
    <div className="q-drawer-overlay" onClick={() => !pending && onClose()}>
      <aside
        className="q-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}>
        <div className="q-drawer-head">
          <div>
            <h3 className="q-drawer-title">{isNew ? "Add service" : initial!.label}</h3>
            <div className="q-drawer-sub">
              {isNew ? "New catalog entry" : initial!.value}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={pending}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <FormField
            label="Service code"
            hint="UPPER_SNAKE_CASE. This is the id jobs, eligibility rows and equipment checklists reference — it cannot be changed once the service exists.">
            <input
              className="cl-input"
              value={value}
              disabled={!isNew}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              placeholder="GUTTER_GUARD_INSTALL"
            />
          </FormField>

          <FormField label="Customer-facing label">
            <input
              className="cl-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gutter guard installation"
            />
          </FormField>

          <FormField
            label="Category"
            hint="Groups the service in the booking page and quote form. A new name creates a new group.">
            <input
              className="cl-input"
              list="svc-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="svc-categories">
              {config.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>

          <FormField
            label="Pricing model"
            hint="How LABOUR is billed. Independent of the materials setting below.">
            <select
              className="cl-input"
              value={pricing}
              onChange={(e) => setPricing(e.target.value as ServicePricingType)}>
              {(Object.keys(PRICING_LABELS) as ServicePricingType[]).map((p) => (
                <option key={p} value={p}>
                  {PRICING_LABELS[p]}
                </option>
              ))}
            </select>
          </FormField>

          {pricing === "fixed" && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(28,25,23,0.03)",
                border: "1px solid rgba(28,25,23,0.08)",
                display: "grid",
                gap: 12,
              }}>
              <FormField
                label="Fixed price ($)"
                hint="Required for a fixed-price service — a service with no price bills $0 of labour.">
                <input
                  className="cl-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fixedPrice}
                  onChange={(e) => setFixedPrice(e.target.value)}
                />
              </FormField>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={fixedPricePerUnit}
                  onChange={(e) => setFixedPricePerUnit(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>Price is per unit</strong>
                  <br />
                  <span style={{ color: "var(--primary-60)" }}>
                    Multiplies by the count the customer picks (Silicone sealing bills per
                    room). The booking page shows a room picker instead of an hour picker.
                  </span>
                </span>
              </label>
            </div>
          )}

          <FormField
            label="Price note (optional)"
            hint="Shown under the service on the booking page, e.g. “$209 per room”.">
            <input
              className="cl-input"
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
            />
          </FormField>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(28,25,23,0.03)",
              border: "1px solid rgba(28,25,23,0.08)",
              display: "grid",
              gap: 12,
            }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={hasMaterials}
                onChange={(e) => setHasMaterials(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>This service has a materials &amp; equipment amount (SOP §5)</strong>
                <br />
                <span style={{ color: "var(--primary-60)" }}>
                  Applied only when the customer checks the all-or-nothing “Fixaro provides
                  all materials and equipment” box. Leave unchecked for services with no
                  automatic charge (AC installation).
                </span>
              </span>
            </label>

            {hasMaterials && (
              <>
                <FormField label="Amount ($)">
                  <input
                    className="cl-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialsAmount}
                    onChange={(e) => setMaterialsAmount(e.target.value)}
                  />
                </FormField>
                <FormField label="Type">
                  <select
                    className="cl-input"
                    value={materialsType}
                    onChange={(e) => setMaterialsType(e.target.value as MaterialsType)}>
                    {(Object.keys(MATERIALS_LABELS) as MaterialsType[]).map((t) => (
                      <option key={t} value={t}>
                        {MATERIALS_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Qualifier (optional)"
                  hint="Appended to the customer-facing line, e.g. “paint not included”.">
                  <input
                    className="cl-input"
                    value={materialsNote}
                    onChange={(e) => setMaterialsNote(e.target.value)}
                    placeholder="paint not included"
                  />
                </FormField>
                <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0 }}>
                  Customer sees:{" "}
                  <strong>
                    {materialsLineLabel({
                      amount: Number(materialsAmount) || 0,
                      type: materialsType,
                      note: materialsNote || null,
                    })}
                  </strong>
                </p>
              </>
            )}
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Bookable (unchecking retires the service — it is never deleted)</span>
          </label>

          {error && <Feedback msg={{ type: "error", text: error }} />}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save service"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Painting baselines ─────────────────────────────────────────────────────

function PaintingTab({ config }: { config: RuntimeConfig }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PaintingScopeConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Callout tone="info">
        These are the <strong>internal cost baselines</strong> (SOP §7), before surplus. The
        customer sees <strong>baseline × {config.policy.paintingSurplusRate}</strong> (the
        painting surplus multiplier, on the Policy tab). Never enter a post-surplus figure
        here — it would be marked up twice.
      </Callout>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            // Clear any open edit before creating — the drawer renders on
            // `editing || creating` with `initial={editing}`, so leaving both set
            // would show the EDIT form (pre-filled, key disabled) under an
            // "Add scope" click.
            setEditing(null);
            setCreating(true);
          }}>
          <Plus size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} /> Add scope
        </button>
      </div>

      {msg && <Feedback msg={msg} />}

      <div className="atable-wrap">
        <div className="atable-scroll">
          <table className="atable">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Internal baseline</th>
                <th>Customer sees</th>
                <th>Status</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {config.paintingScopes.map((s) => {
                const range = paintingQuoteRange(config, s.key);
                return (
                  <tr key={s.key} style={{ opacity: s.active ? 1 : 0.55 }}>
                    <td style={{ whiteSpace: "normal", maxWidth: 220 }}>
                      <div style={{ fontWeight: 500 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "var(--primary-50)", marginTop: 2 }}>
                        {s.key}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      ${s.baselineMin.toFixed(0)}
                      {s.baselineMin !== s.baselineMax && ` – $${s.baselineMax.toFixed(0)}`}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>
                      {range
                        ? range.min === range.max
                          ? `~$${range.min.toFixed(0)}`
                          : `~$${range.min.toFixed(0)} – $${range.max.toFixed(0)}`
                        : "—"}
                    </td>
                    <td>
                      {s.active ? (
                        <span className="pill" style={{ background: "#d1fae5", color: "#065f46" }}>
                          Active
                        </span>
                      ) : (
                        <span className="pill" style={{ background: "#f1f5f9", color: "#475569" }}>
                          Retired
                        </span>
                      )}
                    </td>
                    <td className="col-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setCreating(false);
                          setEditing(s);
                        }}>
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 6 }}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await setPaintingBaselineActive(s.key, !s.active);
                            if (res.success) {
                              setMsg({ type: "success", text: `${s.label} updated.` });
                              router.refresh();
                            } else {
                              setMsg({ type: "error", text: res.error ?? "Failed." });
                            }
                          })
                        }>
                        {s.active ? "Retire" : "Restore"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(editing || creating) && (
        <PaintingForm
          surplus={config.policy.paintingSurplusRate}
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={(text) => {
            setEditing(null);
            setCreating(false);
            setMsg({ type: "success", text });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PaintingForm({
  surplus,
  initial,
  onClose,
  onSaved,
}: {
  surplus: number;
  initial: PaintingScopeConfig | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isNew = initial == null;
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [min, setMin] = useState(String(initial?.baselineMin ?? ""));
  const [max, setMax] = useState(String(initial?.baselineMax ?? ""));
  const [note, setNote] = useState(initial?.note ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewMin = (Number(min) || 0) * surplus;
  const previewMax = (Number(max) || 0) * surplus;

  return (
    <div className="q-drawer-overlay" onClick={() => !pending && onClose()}>
      <aside className="q-drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="q-drawer-head">
          <div>
            <h3 className="q-drawer-title">{isNew ? "Add scope" : initial!.label}</h3>
            <div className="q-drawer-sub">Internal cost baseline (pre-surplus)</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={pending}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <FormField label="Scope key" hint="lower_snake_case. Painting jobs store this — it cannot change later.">
            <input
              className="cl-input"
              value={key}
              disabled={!isNew}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="apt_6_5"
            />
          </FormField>
          <FormField label="Customer-facing label">
            <input className="cl-input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Baseline min ($)">
              <input
                className="cl-input"
                type="number"
                min="0"
                step="1"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            </FormField>
            <FormField label="Baseline max ($)">
              <input
                className="cl-input"
                type="number"
                min="0"
                step="1"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </FormField>
          </div>
          <p style={{ fontSize: 12, color: "var(--primary-60)", margin: 0 }}>
            Customer will be quoted{" "}
            <strong>
              {previewMin === previewMax
                ? `~$${previewMin.toFixed(0)}`
                : `~$${previewMin.toFixed(0)} – $${previewMax.toFixed(0)}`}
            </strong>{" "}
            (baseline × {surplus}).
          </p>
          <FormField label="Note (optional)">
            <input className="cl-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Offered on the booking page</span>
          </label>

          {error && <Feedback msg={{ type: "error", text: error }} />}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await savePaintingBaseline({
                    key: key.trim(),
                    label,
                    baselineMin: Number(min),
                    baselineMax: Number(max),
                    note: note || null,
                    active,
                    sortOrder: initial?.sortOrder,
                  });
                  if (res.success) onSaved(`${label} saved.`);
                  else setError(res.error ?? "Failed to save.");
                });
              }}>
              {pending ? "Saving…" : "Save scope"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Policy ─────────────────────────────────────────────────────────────────

function PolicyTab({
  config,
  defs,
}: {
  config: RuntimeConfig;
  defs: PolicySettingDef[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const d of defs) {
      v[d.key] = String(config.policy[d.field]);
    }
    return v;
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<PolicyGroup, PolicySettingDef[]>();
    for (const d of defs) {
      const list = m.get(d.group) ?? [];
      list.push(d);
      m.set(d.group, list);
    }
    return m;
  }, [defs]);

  const dirty = defs.some((d) => Number(values[d.key]) !== config.policy[d.field]);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updatePolicySettings(
        defs.map((d) => ({ key: d.key, value: Number(values[d.key]) }))
      );
      if (res.success) {
        setMsg({
          type: "success",
          text: res.changed ? `${res.changed} value(s) saved.` : "No changes.",
        });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error ?? "Failed to save." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Callout tone="info">
        Every rule below carries a label, default, help text and a validation rule enforced
        server-side (SOP §2.3), and every change is written to the Audit Log. These values
        drive customer copy, provider copy and the money that actually moves — they are the
        same numbers the booking page quotes and the charge path bills.
      </Callout>

      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="cl-section-card">
          <div className="cl-section-card-head">
            <div>
              <h3>{group}</h3>
            </div>
          </div>
          <div style={{ display: "grid", gap: 18, padding: "4px 0" }}>
            {items.map((d) => {
              const raw = values[d.key];
              const num = Number(raw);
              const invalid =
                raw === "" ||
                !Number.isFinite(num) ||
                num < d.min ||
                num > d.max ||
                (d.integer && !Number.isInteger(num));
              const changed = num !== config.policy[d.field];
              return (
                <div key={d.key}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: 4,
                    }}>
                    {d.label}
                    {changed && (
                      <span
                        className="pill"
                        style={{ background: "#fffbeb", color: "#92400e", fontSize: 10 }}>
                        unsaved
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      className="cl-input"
                      type="number"
                      min={d.min}
                      max={d.max}
                      step={d.step}
                      value={raw}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [d.key]: e.target.value }))
                      }
                      style={{
                        maxWidth: 160,
                        borderColor: invalid ? "#dc2626" : undefined,
                      }}
                    />
                    <span style={{ fontSize: 13, color: "var(--primary-60)" }}>{d.unit}</span>
                    <code style={{ fontSize: 11, color: "var(--primary-40)" }}>{d.key}</code>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: invalid ? "#dc2626" : "var(--primary-60)",
                      margin: "4px 0 0",
                      lineHeight: 1.5,
                    }}>
                    {invalid
                      ? `Must be ${d.integer ? "a whole number " : ""}between ${d.min} and ${d.max}.`
                      : d.help}
                    {!invalid && (
                      <span style={{ color: "var(--primary-40)" }}> · Default {d.default}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {msg && <Feedback msg={msg} />}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm("Reset every policy and pricing value to the Fixaro defaults?")) return;
            startTransition(async () => {
              const res = await resetPolicySettings();
              if (res.success) {
                setMsg({ type: "success", text: "Reset to defaults." });
                router.refresh();
              } else {
                setMsg({ type: "error", text: res.error ?? "Failed." });
              }
            });
          }}>
          <RotateCcw size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
          Reset to defaults
        </button>
        <button className="btn btn-primary" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save policy values"}
        </button>
      </div>
    </div>
  );
}

// ── Export / import ────────────────────────────────────────────────────────

function ExportImportTab() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [diff, setDiff] = useState<ConfigDiff | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const res = await exportConfig();
      if (!res.success) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: "success", text: `Exported ${res.filename}.` });
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDiff(null);
    setErrors([]);
    setMsg(null);
    file.text().then((text) => {
      setJson(text);
      startTransition(async () => {
        const res = await previewConfigImport(text);
        if (res.success) setDiff(res.diff);
        else setErrors(res.errors);
      });
    });
  }

  const changed = diff
    ? diff.changes.filter((c) => c.kind !== "unchanged")
    : [];

  return (
    <div className="space-y-6">
      <section className="cl-section-card">
        <div className="cl-section-card-head">
          <div>
            <h3>Export</h3>
            <p>
              Download this environment&apos;s full config: services and their materials
              pricing, painting baselines, equipment checklists, notification toggles, and
              every policy/pricing value.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--primary-60)", lineHeight: 1.6 }}>
          Provider eligibility is <strong>not</strong> included — those rows are keyed by
          user id and mean nothing in another environment. Grant eligibility per environment
          in Employees → Eligibility. No keys, tokens or customer data are in the file.
        </p>
        <button className="btn btn-primary" onClick={download} disabled={pending}>
          <Download size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          Export config JSON
        </button>
      </section>

      <section className="cl-section-card">
        <div className="cl-section-card-head">
          <div>
            <h3>Import</h3>
            <p>
              Upload a config export from another environment. Nothing is written until you
              review the diff and confirm.
            </p>
          </div>
        </div>

        <Callout tone="warn">
          Importing can change the labour rate, deposits, materials charges and the
          cancellation fee — <strong>what customers are charged</strong>. Services missing
          from the bundle are <strong>retired, never deleted</strong>, so jobs and history
          survive. Review the diff below carefully.
        </Callout>

        <input
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          disabled={pending}
          style={{ fontSize: 13, marginTop: 12 }}
        />

        {errors.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Feedback msg={{ type: "error", text: `${errors.length} problem(s) — nothing was imported:` }} />
            <ul style={{ margin: "8px 0 0 18px", fontSize: 12, color: "#b91c1c" }}>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {diff && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 10 }}>
              <Stat label="Create" value={diff.created} tone="#059669" />
              <Stat label="Update" value={diff.updated} tone="#d97706" />
              <Stat label="Retire" value={diff.deactivated} tone="#dc2626" />
              <Stat label="Unchanged" value={diff.unchanged} tone="#64748b" />
            </div>

            {changed.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--primary-60)" }}>
                This bundle is identical to the current config. Nothing to apply.
              </p>
            ) : (
              <div
                style={{
                  maxHeight: 340,
                  overflowY: "auto",
                  border: "1px solid rgba(28,25,23,0.10)",
                  borderRadius: 12,
                }}>
                <table className="atable">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Item</th>
                      <th>Change</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changed.map((c, i) => (
                      <tr key={`${c.section}-${c.id}-${i}`}>
                        <td style={{ fontSize: 12 }}>{c.section}</td>
                        <td style={{ fontSize: 12, fontWeight: 500 }}>{c.id}</td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              fontSize: 10,
                              background:
                                c.kind === "create"
                                  ? "#d1fae5"
                                  : c.kind === "update"
                                    ? "#fffbeb"
                                    : "#fee2e2",
                              color:
                                c.kind === "create"
                                  ? "#065f46"
                                  : c.kind === "update"
                                    ? "#92400e"
                                    : "#991b1b",
                            }}>
                            {c.kind}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "normal", fontSize: 12 }}>
                          {c.details.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {changed.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  className="btn btn-secondary"
                  disabled={pending}
                  onClick={() => {
                    setDiff(null);
                    setJson("");
                  }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `Apply this config?\n\n${diff.created} created · ${diff.updated} updated · ${diff.deactivated} retired.\n\nThis changes live pricing. The change is audit-logged.`
                      )
                    )
                      return;
                    startTransition(async () => {
                      const res = await applyConfigImport(json);
                      if (res.success) {
                        setMsg({
                          type: "success",
                          text: `Applied: ${res.diff.created} created, ${res.diff.updated} updated, ${res.diff.deactivated} retired.`,
                        });
                        setDiff(null);
                        setJson("");
                        router.refresh();
                      } else {
                        setErrors(res.errors);
                      }
                    });
                  }}>
                  <Upload size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                  {pending ? "Applying…" : "Apply config"}
                </button>
              </div>
            )}
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 12 }}>
            <Feedback msg={msg} />
          </div>
        )}
      </section>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function SeedButton({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-primary btn-sm"
      style={{ marginLeft: 8 }}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await seedServiceCatalog();
          onDone();
        })
      }>
      {pending ? "Seeding…" : "Seed catalog now"}
    </button>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 12, color: "var(--primary-60)", margin: "4px 0 0", lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Feedback({ msg }: { msg: NonNullable<Msg> }) {
  const ok = msg.type === "success";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 13,
        background: ok ? "#d1fae5" : "#fee2e2",
        color: ok ? "#065f46" : "#991b1b",
      }}>
      {ok ? <Check size={15} /> : <AlertTriangle size={15} />}
      {msg.text}
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "info" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 1.6,
        marginBottom: 16,
        background: tone === "warn" ? "#fffbeb" : "rgba(28,25,23,0.03)",
        border: `1px solid ${tone === "warn" ? "#fde68a" : "rgba(28,25,23,0.08)"}`,
        color: tone === "warn" ? "#92400e" : "var(--ink)",
      }}>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: tone }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--primary-60)" }}>{label}</div>
    </div>
  );
}
