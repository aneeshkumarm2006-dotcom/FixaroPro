"use client";

import { useState } from "react";
import PremiumSelect from "@/components/ui/PremiumSelect";

interface ClientOption {
  id: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ClientLinkSelectorProps {
  clients: ClientOption[];
  defaultValue?: string;
}

export default function ClientLinkSelector({
  clients,
  defaultValue,
}: ClientLinkSelectorProps) {
  const [value, setValue] = useState(defaultValue || "");

  const setInputValue = (name: string, val: string) => {
    const el = document.querySelector(
      `input[name="${name}"]`
    ) as HTMLInputElement | null;
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const options = [
    { value: "", label: "— None —" },
    ...clients.map((c) => ({
      value: c.id,
      label: c.name,
      description: [c.email, c.phone].filter(Boolean).join(" · ") || undefined,
      keywords: [c.email, c.phone].filter(Boolean).join(" "),
    })),
  ];

  return (
    <PremiumSelect
      name="clientId"
      value={value}
      onChange={(v) => {
        setValue(v);
        const c = clients.find((cl) => cl.id === v);
        if (!c) return;
        setInputValue("clientName", c.name);
        setInputValue("location", c.address || "");
      }}
      options={options}
      placeholder="Search by name, email or phone…"
      searchable
      size="md"
    />
  );
}
