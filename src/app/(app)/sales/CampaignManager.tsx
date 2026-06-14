"use client";

import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PremiumSelect from "@/components/ui/PremiumSelect";
import DatePicker from "@/components/ui/DatePicker";
import { createMarketingCampaign } from "@/app/(app)/actions/createMarketingCampaign";
import {
  updateMarketingCampaign,
  deleteMarketingCampaign,
} from "@/app/(app)/actions/updateMarketingCampaign";
import { Megaphone, Plus, X } from "lucide-react";

const CAMPAIGN_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

const CHANNELS = [
  "Social Media",
  "Email",
  "Door-to-Door",
  "Flyers",
  "Google Ads",
  "Referral Program",
  "Other",
];

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  budget: number;
  spent: number;
  startDate: string | null;
  endDate: string | null;
  channel: string | null;
  notes: string | null;
  landingPageCount: number;
  createdAt: string;
}

interface CampaignManagerProps {
  campaigns: Campaign[];
}

function statusPillStyle(status: string): {
  label: string;
  bg: string;
  fg: string;
  dot: string;
} {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", bg: "var(--emerald-100)", fg: "var(--emerald-800)", dot: "#059669" };
    case "PAUSED":
      return { label: "Paused", bg: "var(--amber-50)", fg: "var(--amber-800)", dot: "#d97706" };
    case "COMPLETED":
      return { label: "Completed", bg: "#f1f5f9", fg: "#334155", dot: "#64748b" };
    case "DRAFT":
    default:
      return { label: "Draft", bg: "#dbeafe", fg: "#1e40af", dot: "#2f6fae" };
  }
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function campaignDates(start: string | null, end: string | null): string | null {
  if (start && end) return `${shortDate(start)}–${shortDate(end)}`;
  if (start) return shortDate(start);
  if (end) return shortDate(end);
  return null;
}

export default function CampaignManager({ campaigns }: CampaignManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Controlled state for form selects/dates
  const [formStatus, setFormStatus] = useState("DRAFT");
  const [formChannel, setFormChannel] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editingCampaign
      ? await updateMarketingCampaign(editingCampaign.id, formData)
      : await createMarketingCampaign(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setShowModal(false);
      setEditingCampaign(null);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMarketingCampaign(confirmDeleteId);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="sl-tab-bar">
        <span className="sl-tab-hint">
          {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingCampaign(null);
            setFormStatus("DRAFT");
            setFormChannel("");
            setFormStartDate("");
            setFormEndDate("");
            setShowModal(true);
          }}>
          <Plus size={14} />
          New campaign
        </button>
      </div>

      {deleteError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {deleteError}
        </div>
      )}

      {campaigns.length === 0 ? (
        <Card variant="default" className="p-8 text-center">
          <Megaphone className="w-8 h-8 text-[#1c1917]/30 mx-auto mb-2" />
          <p className="text-sm text-[#1c1917]/60">No campaigns yet</p>
          <p className="text-xs text-[#1c1917]/40 mt-1">
            Create your first marketing campaign to start tracking performance
          </p>
        </Card>
      ) : (
        <div className="sl-card-list">
          {campaigns.map((campaign) => {
            const pct =
              campaign.budget > 0
                ? Math.min(100, Math.round((campaign.spent / campaign.budget) * 100))
                : 0;
            const st = statusPillStyle(campaign.status);
            const dates = campaignDates(campaign.startDate, campaign.endDate);
            return (
              <div key={campaign.id} className="dcard sl-camp">
                {confirmDeleteId === campaign.id ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-[400] text-[#1c1917]">Delete &ldquo;{campaign.name}&rdquo;?</p>
                      <p className="text-xs text-[#1c1917]/50 mt-0.5">This cannot be undone.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}>
                        Cancel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                        {deleting ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sl-camp-head">
                      <div>
                        <div className="sl-camp-toprow">
                          <h3 className="sl-lp-title">{campaign.name}</h3>
                          <span className="pill" style={{ background: st.bg, color: st.fg }}>
                            <span className="pill-dot" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                        </div>
                        <div className="sl-camp-meta">
                          {[campaign.channel, dates].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="sl-camp-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setFormStatus(campaign.status || "DRAFT");
                            setFormChannel(campaign.channel || "");
                            setFormStartDate(campaign.startDate ? new Date(campaign.startDate).toISOString().split("T")[0] : "");
                            setFormEndDate(campaign.endDate ? new Date(campaign.endDate).toISOString().split("T")[0] : "");
                            setShowModal(true);
                          }}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 36, height: 36 }}
                          aria-label={`Delete ${campaign.name}`}
                          onClick={() => setConfirmDeleteId(campaign.id)}>
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="sl-budget">
                      <div className="sl-budget-row">
                        <span>{money(campaign.spent)} spent</span>
                        <span style={{ color: "var(--primary-50)" }}>
                          of {money(campaign.budget)}
                        </span>
                      </div>
                      <div className="sl-budget-track">
                        <div
                          className="sl-budget-fill"
                          style={{
                            width: pct + "%",
                            background: pct >= 100 ? "var(--amber-600)" : "var(--primary)",
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCampaign(null);
          setError(null);
          setFormStatus("DRAFT");
          setFormChannel("");
          setFormStartDate("");
          setFormEndDate("");
        }}
        title={editingCampaign ? "Edit Campaign" : "New Campaign"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Campaign Name
            </label>
            <Input
              name="name"
              defaultValue={editingCampaign?.name || ""}
              placeholder="e.g. Spring Cleaning Promo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              name="description"
              defaultValue={editingCampaign?.description || ""}
              placeholder="Campaign description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">Status</label>
              <PremiumSelect
                name="status"
                value={formStatus}
                onChange={setFormStatus}
                options={CAMPAIGN_STATUSES}
                size="md"
              />
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">Channel</label>
              <PremiumSelect
                name="channel"
                value={formChannel}
                onChange={setFormChannel}
                placeholder="Select channel"
                options={[{ value: "", label: "No channel" }, ...CHANNELS.map(ch => ({ value: ch, label: ch }))]}
                size="md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                Budget ($)
              </label>
              <Input
                name="budget"
                type="number"
                step="0.01"
                defaultValue={editingCampaign?.budget || "0"}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                Spent ($)
              </label>
              <Input
                name="spent"
                type="number"
                step="0.01"
                defaultValue={editingCampaign?.spent || "0"}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">Start Date</label>
              <DatePicker name="startDate" value={formStartDate} onChange={setFormStartDate} size="md" />
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">End Date</label>
              <DatePicker name="endDate" value={formEndDate} onChange={setFormEndDate} size="md" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Notes
            </label>
            <Textarea
              name="notes"
              defaultValue={editingCampaign?.notes || ""}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="cancel"
              size="sm"
              onClick={() => {
                setShowModal(false);
                setEditingCampaign(null);
              }}
              disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action"
              size="sm"
              disabled={loading}>
              {loading
                ? "Saving..."
                : editingCampaign
                  ? "Update"
                  : "Create Campaign"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
