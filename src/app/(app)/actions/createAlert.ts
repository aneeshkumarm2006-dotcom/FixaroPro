"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminRole } from "@/lib/role-routing";
import type { AlertType, AlertSeverity, Prisma } from "@prisma/client";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "./notificationPrefsConstants";

// Alerts are the admin operations inbox. These three mutations are reachable as
// POST server actions, so a signed-out caller could otherwise create noise
// alerts or dismiss/read (hide) real ones (CLIENT_COMPLAINT, OVERDUE_PAYMENT…)
// by id — an IDOR on the ops inbox. Require an admin-app session.
async function requireAdminApp(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  return !!session && isAdminRole((session.user as { role?: string }).role);
}

interface CreateAlertInput {
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  recipientUserId?: string;
}

export async function createAlert(input: CreateAlertInput) {
  try {
    if (!(await requireAdminApp())) {
      return { success: false, error: "Not authorized" };
    }
    const alert = await db.alert.create({
      data: {
        type: input.type,
        severity: input.severity ?? "WARNING",
        title: input.title,
        message: input.message,
        relatedId: input.relatedId ?? null,
        relatedType: input.relatedType ?? null,
        recipientUserId: input.recipientUserId ?? null,
      },
    });
    return { success: true, alert };
  } catch (error) {
    console.error("Error creating alert:", error);
    return { success: false, error: "Failed to create alert" };
  }
}

export async function dismissAlert(alertId: string) {
  try {
    if (!(await requireAdminApp())) {
      return { success: false, error: "Not authorized" };
    }
    await db.alert.update({
      where: { id: alertId },
      data: { isDismissed: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Error dismissing alert:", error);
    return { success: false, error: "Failed to dismiss alert" };
  }
}

export async function markAlertRead(alertId: string) {
  try {
    if (!(await requireAdminApp())) {
      return { success: false, error: "Not authorized" };
    }
    await db.alert.update({
      where: { id: alertId },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Error marking alert as read:", error);
    return { success: false, error: "Failed to mark alert as read" };
  }
}

// ── Spec-driven notification routing (§11.1, §11.2) ────────────────
// Maps each AlertType to the NotificationPrefs key that gates delivery.
// AlertTypes absent from this map (CANCELLATION, GENERAL) skip per-user
// pref filtering and fan out to every routed recipient.
const ALERT_TYPE_TO_PREF_KEY: Partial<
  Record<AlertType, keyof NotificationPrefs>
> = {
  LOW_INVENTORY: "lowInventory",
  PROVIDER_LOW_STOCK: "providerLowStock",
  CLEANER_PAYMENT: "cleanerPayment",
  IMMEDIATE_PAYOUT: "immediatePayout",
  OVERDUE_PAYMENT: "latePayment",
  OVERDUE_COMMERCIAL: "overdueCommercial",
  CLIENT_COMPLAINT: "clientComplaint",
  RATING_DECREASE: "ratingDecrease",
};

const PREFS_KEY_PREFIX = "notifications.prefs.";

interface NotifyByRulePayload {
  severity?: AlertSeverity;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  /**
   * Direct recipients to merge with role-based recipients (e.g. the cleaner
   * whose payout was processed). Per-user pref filtering still applies.
   */
  extraRecipientUserIds?: string[];
  /** When true, role expansion is skipped — only extraRecipientUserIds receive the alert. */
  skipRoleRouting?: boolean;
}

interface NotifyByRuleResult {
  success: boolean;
  created?: number;
  error?: string;
}

/**
 * Look up active AlertRoutingRule rows for the given alertType, expand each
 * rule to the set of users holding that role, merge in any direct recipients,
 * filter by per-user NotificationPrefs, and fan out one Alert row per user
 * (with recipientUserId set). Returns the number of rows created.
 */
export async function notifyByRule(
  alertType: AlertType,
  payload: NotifyByRulePayload,
): Promise<NotifyByRuleResult> {
  try {
    const recipientIds = new Set<string>();

    if (!payload.skipRoleRouting) {
      const rules = await db.alertRoutingRule.findMany({
        where: { alertType, isActive: true },
        select: { recipientRole: true },
      });
      if (rules.length > 0) {
        const usersByRole = await db.user.findMany({
          where: { role: { in: rules.map((r) => r.recipientRole) } },
          select: { id: true },
        });
        for (const u of usersByRole) recipientIds.add(u.id);
      }
    }

    for (const id of payload.extraRecipientUserIds ?? []) {
      recipientIds.add(id);
    }

    if (recipientIds.size === 0) {
      return { success: true, created: 0 };
    }

    const prefKey = ALERT_TYPE_TO_PREF_KEY[alertType];
    const prefsByUserId = new Map<string, NotificationPrefs>();
    if (prefKey) {
      const keys = [...recipientIds].map((id) => PREFS_KEY_PREFIX + id);
      const settings = await db.appSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      });
      for (const s of settings) {
        const uid = s.key.slice(PREFS_KEY_PREFIX.length);
        const stored = s.value as Partial<NotificationPrefs>;
        prefsByUserId.set(uid, { ...DEFAULT_NOTIFICATION_PREFS, ...stored });
      }
    }

    const data: Prisma.AlertCreateManyInput[] = [];
    for (const userId of recipientIds) {
      if (prefKey) {
        const prefs = prefsByUserId.get(userId) ?? DEFAULT_NOTIFICATION_PREFS;
        if (!prefs[prefKey]) continue;
      }
      data.push({
        type: alertType,
        severity: payload.severity ?? "WARNING",
        title: payload.title,
        message: payload.message,
        relatedId: payload.relatedId ?? null,
        relatedType: payload.relatedType ?? null,
        recipientUserId: userId,
      });
    }

    if (data.length === 0) {
      return { success: true, created: 0 };
    }

    const result = await db.alert.createMany({ data });
    return { success: true, created: result.count };
  } catch (error) {
    console.error("Error in notifyByRule:", error);
    return { success: false, error: "Failed to route alerts" };
  }
}
