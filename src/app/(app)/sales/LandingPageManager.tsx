"use client";

import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PremiumSelect from "@/components/ui/PremiumSelect";
import { createLandingPage, updateLandingPage, deleteLandingPage } from "@/app/(app)/actions/createLandingPage";
import {
  Globe,
  Plus,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  ctaText: string;
  ctaLink: string;
  isPublished: boolean;
  campaignId: string | null;
  campaignName: string | null;
  totalVisits: number;
  recentVisits: number;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface LandingPageManagerProps {
  landingPages: LandingPage[];
  campaigns: Campaign[];
}

export default function LandingPageManager({
  landingPages,
  campaigns,
}: LandingPageManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editingPage
      ? await updateLandingPage(editingPage.id, formData)
      : await createLandingPage(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setShowModal(false);
      setEditingPage(null);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this landing page?")) return;
    const result = await deleteLandingPage(id);
    if (result.error) {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-[400] text-[#005F6A]">Landing Pages</h3>
          <p className="text-xs text-[#005F6A]/50 mt-0.5">
            Create and manage public landing pages for marketing campaigns
          </p>
        </div>
        <Button
          variant="action"
          size="sm"
          onClick={() => {
            setEditingPage(null);
            setCampaignId("");
            setShowModal(true);
          }}>
          <Plus className="w-4 h-4 mr-1" />
          New Page
        </Button>
      </div>

      {landingPages.length === 0 ? (
        <Card variant="default" className="p-8 text-center">
          <Globe className="w-8 h-8 text-[#005F6A]/30 mx-auto mb-2" />
          <p className="text-sm text-[#005F6A]/60">No landing pages yet</p>
          <p className="text-xs text-[#005F6A]/40 mt-1">
            Create your first landing page to start capturing leads
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {landingPages.map((page) => (
            <Card key={page.id} variant="default" className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-[400] text-[#005F6A] truncate">
                      {page.title}
                    </h4>
                    <Badge
                      variant={page.isPublished ? "default" : "secondary"}
                      size="sm">
                      {page.isPublished ? (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Draft
                        </span>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#005F6A]/50 mt-1">
                    /{page.slug}
                    {page.campaignName && (
                      <span className="ml-2 text-[#005F6A]/40">
                        Campaign: {page.campaignName}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-[#005F6A]/60">
                      {page.totalVisits} total visits
                    </span>
                    <span className="text-xs text-[#005F6A]/60">
                      {page.recentVisits} last 30d
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {page.isPublished && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.open(`/p/${page.slug}`, "_blank")
                      }>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPage(page);
                      setCampaignId(page.campaignId || "");
                      setShowModal(true);
                    }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(page.id)}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingPage(null);
          setCampaignId("");
          setError(null);
        }}
        title={editingPage ? "Edit Landing Page" : "New Landing Page"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Title
            </label>
            <Input
              name="title"
              defaultValue={editingPage?.title || ""}
              placeholder="Page title"
              required
            />
          </div>

          {!editingPage && (
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                URL Slug
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">/p/</span>
                <Input
                  name="slug"
                  placeholder="my-landing-page"
                  required
                  className="flex-1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Content
            </label>
            <Textarea
              name="content"
              defaultValue={editingPage?.content || ""}
              placeholder="Page content (supports basic text)"
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                CTA Button Text
              </label>
              <Input
                name="ctaText"
                defaultValue={editingPage?.ctaText || "Get a Free Quote"}
                placeholder="Get a Free Quote"
              />
            </div>
            <div>
              <label className="block text-sm font-[350] text-gray-700 mb-1">
                CTA Link
              </label>
              <Input
                name="ctaLink"
                defaultValue={editingPage?.ctaLink || "/"}
                placeholder="/"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-[350] text-gray-700 mb-1">
              Campaign
            </label>
            <PremiumSelect
              name="campaignId"
              value={campaignId}
              onChange={setCampaignId}
              options={[
                { value: "", label: "No campaign" },
                ...campaigns.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="No campaign"
              size="md"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              value="true"
              defaultChecked={editingPage?.isPublished || false}
              id="isPublished"
              className="rounded border-gray-300"
            />
            <label
              htmlFor="isPublished"
              className="text-sm font-[350] text-gray-700">
              Publish immediately
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="cancel"
              size="sm"
              onClick={() => {
                setShowModal(false);
                setEditingPage(null);
              }}
              disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action"
              size="sm"
              disabled={loading}>
              {loading ? "Saving..." : editingPage ? "Update" : "Create Page"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
