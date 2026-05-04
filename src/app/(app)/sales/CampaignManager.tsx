"use client";

import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { createMarketingCampaign } from "@/app/(app)/actions/createMarketingCampaign";
import {
  updateMarketingCampaign,
  deleteMarketingCampaign,
} from "@/app/(app)/actions/updateMarketingCampaign";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
} from "lucide-react";

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

function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "PAUSED":
      return "secondary" as const;
    case "COMPLETED":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

export default function CampaignManager({ campaigns }: CampaignManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    const result = await deleteMarketingCampaign(id);
    if (result.error) {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-[400] text-[#005F6A]">
            Marketing Campaigns
          </h3>
          <p className="text-xs text-[#005F6A]/50 mt-0.5">
            Track campaign budgets, channels, and performance
          </p>
        </div>
        <Button
          variant="action"
          size="sm"
          onClick={() => {
            setEditingCampaign(null);
            setShowModal(true);
          }}>
          <Plus className="w-4 h-4 mr-1" />
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card variant="default" className="p-8 text-center">
          <Megaphone className="w-8 h-8 text-[#005F6A]/30 mx-auto mb-2" />
          <p className="text-sm text-[#005F6A]/60">No campaigns yet</p>
          <p className="text-xs text-[#005F6A]/40 mt-1">
            Create your first marketing campaign to start tracking performance
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const budgetUsed =
              campaign.budget > 0
                ? (campaign.spent / campaign.budget) * 100
                : 0;
            return (
              <Card key={campaign.id} variant="default" className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-[400] text-[#005F6A] truncate">
                        {campaign.name}
                      </h4>
                      <Badge
                        variant={statusBadgeVariant(campaign.status)}
                        size="sm">
                        {campaign.status}
                      </Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-[#005F6A]/50 mt-1 line-clamp-1">
                        {campaign.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {campaign.channel && (
                        <span className="text-xs text-[#005F6A]/60 flex items-center gap-1">
                          <Megaphone className="w-3 h-3" />
                          {campaign.channel}
                        </span>
                      )}
                      <span className="text-xs text-[#005F6A]/60 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />$
                        {campaign.spent.toFixed(0)} / $
                        {campaign.budget.toFixed(0)}
                      </span>
                      {campaign.startDate && (
                        <span className="text-xs text-[#005F6A]/60 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(campaign.startDate).toLocaleDateString()}
                          {campaign.endDate &&
                            ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                        </span>
                      )}
                      <span className="text-xs text-[#005F6A]/40">
                        {campaign.landingPageCount} landing page
                        {campaign.landingPageCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {campaign.budget > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              budgetUsed > 100
                                ? "bg-red-400"
                                : budgetUsed > 80
                                  ? "bg-yellow-400"
                                  : "bg-[#005F6A]"
                            }`}
                            style={{
                              width: `${Math.min(budgetUsed, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setShowModal(true);
                      }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
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
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={editingCampaign?.status || "DRAFT"}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#005F6A]/20 focus:border-[#005F6A]">
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                Channel
              </label>
              <select
                name="channel"
                defaultValue={editingCampaign?.channel || ""}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#005F6A]/20 focus:border-[#005F6A]">
                <option value="">Select channel</option>
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
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
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                name="startDate"
                type="date"
                defaultValue={
                  editingCampaign?.startDate
                    ? new Date(editingCampaign.startDate)
                        .toISOString()
                        .split("T")[0]
                    : ""
                }
              />
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                End Date
              </label>
              <Input
                name="endDate"
                type="date"
                defaultValue={
                  editingCampaign?.endDate
                    ? new Date(editingCampaign.endDate)
                        .toISOString()
                        .split("T")[0]
                    : ""
                }
              />
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
