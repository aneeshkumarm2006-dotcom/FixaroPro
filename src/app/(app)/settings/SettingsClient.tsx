"use client";

import { useState } from "react";
import {
  User as UserIcon,
  Percent,
  DollarSign,
  Briefcase,
  CreditCard,
  Boxes,
  Package,
  Star,
  Shield,
  Truck,
  MapPin,
  ListChecks,
  Calendar as CalendarIcon,
  GraduationCap,
  FileSignature,
} from "lucide-react";
import ProfileTab from "./tabs/ProfileTab";
import TaxSettingsTab from "./tabs/TaxSettingsTab";
import PricingRulesTab from "./tabs/PricingRulesTab";
import JobTypesTab from "./tabs/JobTypesTab";
import PaymentTypesTab from "./tabs/PaymentTypesTab";
import InventoryRulesTab from "./tabs/InventoryRulesTab";
import KitTemplatesTab from "./tabs/KitTemplatesTab";
import MultipliersTab from "./tabs/MultipliersTab";
import RolesTab from "./tabs/RolesTab";
import SuppliersTab from "./tabs/SuppliersTab";
import InventoryLocationsTab from "./tabs/InventoryLocationsTab";
import ServiceAreasTab from "./tabs/ServiceAreasTab";
import ChecklistTemplatesTab from "./tabs/ChecklistTemplatesTab";
import AvailabilityTab from "./tabs/AvailabilityTab";
import TrainingTab, {
  TrainingModuleRecord,
} from "./tabs/TrainingTab";
import DocumentsTab, {
  DocumentRecord,
  UserOption,
} from "./tabs/DocumentsTab";
import {
  SettingsUser,
  AppSettingRecord,
  ProductRecord,
  KitTemplateRecord,
  InventoryRuleRecord,
  SupplierRecord,
  InventoryLocationRecord,
  ChecklistTemplateRecord,
  ServiceAreaRecord,
} from "./types";

interface SettingsClientProps {
  user: SettingsUser;
  isAdmin: boolean;
  appSettings: AppSettingRecord[];
  products: ProductRecord[];
  kitTemplates: KitTemplateRecord[];
  inventoryRules: InventoryRuleRecord[];
  suppliers: SupplierRecord[];
  inventoryLocations: InventoryLocationRecord[];
  checklistTemplates: ChecklistTemplateRecord[];
  trainingModules: TrainingModuleRecord[];
  documents: DocumentRecord[];
  users: UserOption[];
  serviceAreas: ServiceAreaRecord[];
}

type TabId =
  | "profile"
  | "availability"
  | "tax"
  | "pricing"
  | "jobTypes"
  | "paymentTypes"
  | "inventoryRules"
  | "kitTemplates"
  | "checklistTemplates"
  | "training"
  | "documents"
  | "multipliers"
  | "roles"
  | "suppliers"
  | "inventoryLocations"
  | "serviceAreas";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof UserIcon;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "availability", label: "Availability", icon: CalendarIcon },
  { id: "tax", label: "Tax", icon: Percent, adminOnly: true },
  { id: "pricing", label: "Pricing Rules", icon: DollarSign, adminOnly: true },
  { id: "jobTypes", label: "Job Types", icon: Briefcase, adminOnly: true },
  {
    id: "paymentTypes",
    label: "Payment Types",
    icon: CreditCard,
    adminOnly: true,
  },
  {
    id: "inventoryRules",
    label: "Inventory Rules",
    icon: Boxes,
    adminOnly: true,
  },
  {
    id: "kitTemplates",
    label: "Kit Templates",
    icon: Package,
    adminOnly: true,
  },
  {
    id: "checklistTemplates",
    label: "Checklist Templates",
    icon: ListChecks,
    adminOnly: true,
  },
  {
    id: "training",
    label: "Training",
    icon: GraduationCap,
    adminOnly: true,
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileSignature,
    adminOnly: true,
  },
  { id: "multipliers", label: "Multipliers", icon: Star, adminOnly: true },
  { id: "roles", label: "Roles", icon: Shield, adminOnly: true },
  { id: "suppliers", label: "Suppliers", icon: Truck, adminOnly: true },
  {
    id: "inventoryLocations",
    label: "Inventory Locations",
    icon: MapPin,
    adminOnly: true,
  },
  {
    id: "serviceAreas",
    label: "Service Areas",
    icon: MapPin,
    adminOnly: true,
  },
];

export default function SettingsClient({
  user,
  isAdmin,
  appSettings,
  products,
  kitTemplates,
  inventoryRules,
  suppliers,
  inventoryLocations,
  checklistTemplates,
  trainingModules,
  documents,
  users,
  serviceAreas,
}: SettingsClientProps) {
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl !font-light tracking-tight text-[#005F6A]">
          Settings
        </h1>
        <p className="text-sm text-[#005F6A]/70 mt-1">
          Manage your account and application configuration
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <nav className="w-60 flex-shrink-0">
          <div className="bg-[#005F6A]/5 rounded-2xl p-1 space-y-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-[350] transition-all duration-200 whitespace-nowrap ${
                    active
                      ? "bg-[#005F6A]/90 text-white"
                      : "text-[#005F6A] hover:bg-[#005F6A]/10"
                  }`}>
                  <Icon strokeWidth={1.6} className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileTab user={user} />}
          {activeTab === "availability" && <AvailabilityTab />}
          {activeTab === "tax" && isAdmin && (
            <TaxSettingsTab settings={appSettings} />
          )}
          {activeTab === "pricing" && isAdmin && (
            <PricingRulesTab settings={appSettings} />
          )}
          {activeTab === "jobTypes" && isAdmin && (
            <JobTypesTab settings={appSettings} />
          )}
          {activeTab === "paymentTypes" && isAdmin && (
            <PaymentTypesTab settings={appSettings} />
          )}
          {activeTab === "inventoryRules" && isAdmin && (
            <InventoryRulesTab
              products={products}
              rules={inventoryRules}
            />
          )}
          {activeTab === "kitTemplates" && isAdmin && (
            <KitTemplatesTab
              products={products}
              kitTemplates={kitTemplates}
            />
          )}
          {activeTab === "checklistTemplates" && isAdmin && (
            <ChecklistTemplatesTab
              templates={checklistTemplates}
              settings={appSettings}
            />
          )}
          {activeTab === "training" && isAdmin && (
            <TrainingTab modules={trainingModules} />
          )}
          {activeTab === "documents" && isAdmin && (
            <DocumentsTab documents={documents} users={users} />
          )}
          {activeTab === "multipliers" && isAdmin && (
            <MultipliersTab settings={appSettings} />
          )}
          {activeTab === "roles" && isAdmin && <RolesTab />}
          {activeTab === "suppliers" && isAdmin && (
            <SuppliersTab products={products} suppliers={suppliers} />
          )}
          {activeTab === "inventoryLocations" && isAdmin && (
            <InventoryLocationsTab
              products={products}
              locations={inventoryLocations}
            />
          )}
          {activeTab === "serviceAreas" && isAdmin && (
            <ServiceAreasTab serviceAreas={serviceAreas} />
          )}
        </div>
      </div>
    </div>
  );
}
