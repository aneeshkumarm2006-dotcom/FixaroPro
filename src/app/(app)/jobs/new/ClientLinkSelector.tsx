"use client";

interface ClientOption {
  id: string;
  name: string;
  address?: string | null;
}

interface ClientLinkSelectorProps {
  clients: ClientOption[];
  defaultValue?: string;
}

export default function ClientLinkSelector({
  clients,
  defaultValue,
}: ClientLinkSelectorProps) {
  const setInputValue = (name: string, value: string) => {
    const el = document.querySelector(
      `input[name="${name}"]`
    ) as HTMLInputElement | null;
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  return (
    <select
      id="clientId"
      name="clientId"
      defaultValue={defaultValue || ""}
      onChange={(e) => {
        const c = clients.find((cl) => cl.id === e.target.value);
        if (!c) return;
        setInputValue("clientName", c.name);
        setInputValue("location", c.address || "");
      }}
      className="w-full h-[42px] px-3 rounded-xl bg-[#005F6A]/5 text-sm text-[#005F6A] border-0 focus:outline-none focus:ring-1 focus:ring-[#005F6A]/20">
      <option value="">— None —</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
