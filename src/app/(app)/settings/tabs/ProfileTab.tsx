"use client";

import { useEffect, useState } from "react";
import {
  User as UserIcon,
  KeyRound,
  Star,
  TrendingUp,
  DollarSign,
  Bell,
  Eye,
  EyeOff,
} from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import {
  updateUserSettings,
  updateUserPassword,
} from "../../actions/updateUserSettings";
import { getPerformanceData } from "../../actions/getPerformanceData";
import { SettingsUser } from "../types";
import { SectionCard, Field, Feedback, Msg } from "./_shared";
import PerformanceSection from "./PerformanceSection";
import IncomeSection from "./IncomeSection";
import NotificationSection from "./NotificationSection";

interface ProfileTabProps {
  user: SettingsUser;
}

type SubTab = "profile" | "performance" | "income" | "notifications";

const SUB_TABS: { id: SubTab; label: string; icon: typeof UserIcon }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "income", label: "My Income", icon: DollarSign },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function StarRow({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < filled
              ? "fill-[#77C8CC] text-[#77C8CC]"
              : "text-white/30"
          }`}
        />
      ))}
    </div>
  );
}

function PerformanceHeader({ employeeId }: { employeeId?: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getPerformanceData({ employeeId });
      if (cancelled) return;
      if (res.success) {
        setRating(res.data.rating30Day);
        setMultiplier(res.data.currentMultiplier);
        setTier(res.data.tierLabel);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#005F6A] to-[#077B86] p-5 text-white">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">
            30-Day Rating
          </p>
          {rating !== null ? (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-[300]">{rating.toFixed(2)}</p>
              <StarRow value={rating} />
            </div>
          ) : (
            <p className="text-2xl font-[300] mt-1 text-white/50">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">
            Pay Multiplier
          </p>
          <p className="text-2xl font-[300] mt-1">
            {multiplier !== null ? `${multiplier.toFixed(2)}x` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">
            Tier
          </p>
          <p className="text-2xl font-[300] mt-1">{tier ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function ProfileForms({ user }: { user: SettingsUser }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileMsg(null);
    try {
      const result = await updateUserSettings({
        name,
        email,
        phone: phone || null,
      });
      if (result.success) {
        setProfileMsg({ type: "success", text: "Profile updated." });
      } else {
        setProfileMsg({
          type: "error",
          text: result.error || "Failed to update profile.",
        });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Unexpected error." });
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingPassword(true);
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      setUpdatingPassword(false);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({
        type: "error",
        text: "Password must be at least 8 characters.",
      });
      setUpdatingPassword(false);
      return;
    }

    try {
      const result = await updateUserPassword({ currentPassword, newPassword });
      if (result.success) {
        setPasswordMsg({ type: "success", text: "Password updated." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({
          type: "error",
          text: result.error || "Failed to update password.",
        });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Unexpected error." });
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Profile Information"
        description="Update your name, email, and contact details."
        icon={UserIcon}>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <Field label="Full Name">
            <Input
              variant="form"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </Field>
          <Field label="Email Address">
            <Input
              variant="form"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </Field>
          <Field label="Phone Number">
            <Input
              variant="form"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
            />
          </Field>
          <Field
            label="Role"
            hint="Contact an administrator to change your role.">
            <div className="px-4 py-2.5 bg-[#005F6A]/5 rounded-2xl text-sm text-[#005F6A]">
              {user.role}
            </div>
          </Field>

          {profileMsg && <Feedback msg={profileMsg} />}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="action"
              border={false}
              disabled={updatingProfile}
              className="rounded-xl px-6 py-2.5">
              {updatingProfile ? "Updating..." : "Update Profile"}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Change Password"
        description="Use a strong password you don't reuse elsewhere."
        icon={KeyRound}>
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <Field label="Current Password">
            <div className="relative">
              <Input
                variant="form"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-9"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#005F6A]/50 hover:text-[#005F6A] transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field
            label="New Password"
            hint="Must be at least 8 characters.">
            <div className="relative">
              <Input
                variant="form"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-9"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#005F6A]/50 hover:text-[#005F6A] transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm New Password">
            <div className="relative">
              <Input
                variant="form"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="pr-9"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#005F6A]/50 hover:text-[#005F6A] transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {passwordMsg && <Feedback msg={passwordMsg} />}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="action"
              border={false}
              disabled={updatingPassword}
              className="rounded-xl px-6 py-2.5">
              {updatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

export default function ProfileTab({ user }: ProfileTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("profile");
  const isEmployee = user.role === "EMPLOYEE";

  if (!isEmployee) {
    return <ProfileForms user={user} />;
  }

  return (
    <div className="space-y-6">
      <PerformanceHeader />

      <div className="flex items-center gap-1 bg-[#005F6A]/5 rounded-2xl p-1 w-fit flex-wrap">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-white text-[#005F6A] font-[500] shadow-sm"
                  : "text-[#005F6A]/60 hover:text-[#005F6A]"
              }`}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === "profile" && <ProfileForms user={user} />}
      {subTab === "performance" && <PerformanceSection />}
      {subTab === "income" && <IncomeSection />}
      {subTab === "notifications" && <NotificationSection />}
    </div>
  );
}
