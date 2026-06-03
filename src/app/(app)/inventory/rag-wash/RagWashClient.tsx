"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { ArrowLeft, Users, Droplets } from "lucide-react";

interface EmployeeRagWashData {
  id: string;
  name: string;
  email: string;
  role: string;
  totalWashes: number;
  totalRags: number;
  lastWashDate: string | null;
  lastWashRagCount: number;
}

interface RagWashClientProps {
  employees: EmployeeRagWashData[];
}

export default function RagWashClient({ employees }: RagWashClientProps) {
  const router = useRouter();

  const employeesWithWashes = employees.filter((e) => e.totalWashes > 0);
  const employeesWithoutWashes = employees.filter((e) => e.totalWashes === 0);

  return (
    <div className="max-w-[80rem] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="default"
          size="sm"
          border={false}
          onClick={() => router.push("/inventory")}
          className="px-6 py-3">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Inventory
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl !font-light tracking-tight text-[#1c1917]">
            Rag Wash Tracking
          </h1>
          <p className="text-sm text-[#1c1917]/70 !font-light mt-1">
            Track and manage rag washing for all cleaners
          </p>
        </div>
        <Badge variant="cleano" size="sm">
          {employees.length} cleaners
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#1c1917]/70">
              Total Washes
            </span>
            <p className="h2-title text-[#1c1917]">
              {employees.reduce((sum, e) => sum + e.totalWashes, 0)}
            </p>
          </div>
        </Card>
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#1c1917]/70">
              Total Rags Washed
            </span>
            <p className="h2-title text-[#1c1917]">
              {employees.reduce((sum, e) => sum + e.totalRags, 0)}
            </p>
          </div>
        </Card>
        <Card variant="cleano_light" className="p-6 h-[7rem]">
          <div className="h-full flex flex-col justify-between">
            <span className="app-title-small !text-[#1c1917]/70">
              Active Washers
            </span>
            <p className="h2-title text-[#1c1917]">
              {employeesWithWashes.length}
            </p>
          </div>
        </Card>
      </div>

      {/* Employee List */}
      <div className="space-y-4">
        <h2 className="text-lg font-[350] tracking-tight text-[#1c1917]">
          Technicians
        </h2>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <div className="flex bg-[#e85d04]/5 rounded-t-2xl">
                {[
                  { label: "Employee", className: "w-[250px]" },
                  { label: "Total Washes", className: "w-[150px]" },
                  { label: "Total Rags", className: "w-[150px]" },
                  { label: "Last Wash", className: "w-[200px]" },
                  { label: "Actions", className: "w-[150px]" },
                ].map((col) => (
                  <div
                    key={col.label}
                    className={`${col.className} p-4 text-left text-xs font-[350] !text-[#1c1917]/40 uppercase tracking-wide`}>
                    {col.label}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-[#e85d04]/4">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center hover:bg-[#e85d04]/1 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(`/inventory/rag-wash/${emp.id}`)
                    }>
                    <div className="w-[250px] p-4">
                      <p className="text-sm font-[350] text-[#1c1917]">
                        {emp.name}
                      </p>
                      <p className="text-xs text-[#1c1917]/50 mt-0.5">
                        {emp.email}
                      </p>
                    </div>
                    <div className="w-[150px] p-4">
                      <span className="text-sm font-[350] text-[#1c1917]">
                        {emp.totalWashes}
                      </span>
                    </div>
                    <div className="w-[150px] p-4">
                      <span className="text-sm font-[350] text-[#1c1917]">
                        {emp.totalRags}
                      </span>
                    </div>
                    <div className="w-[200px] p-4">
                      {emp.lastWashDate ? (
                        <div>
                          <p className="text-sm font-[350] text-[#1c1917]">
                            {new Date(emp.lastWashDate).toLocaleDateString("en-US")}
                          </p>
                          <p className="text-xs text-[#1c1917]/50">
                            {emp.lastWashRagCount} rags
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-[#1c1917]/30">
                          No washes
                        </span>
                      )}
                    </div>
                    <div className="w-[150px] p-4">
                      <Button
                        variant="primary"
                        size="sm"
                        border={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/inventory/rag-wash/${emp.id}`);
                        }}
                        className="rounded-2xl px-4 py-2.5">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {employees.map((emp) => (
            <Card
              key={emp.id}
              variant="cleano_light"
              className="p-4 cursor-pointer"
              onClick={() => router.push(`/inventory/rag-wash/${emp.id}`)}>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-[400] text-[#1c1917]">
                      {emp.name}
                    </p>
                    <p className="text-xs text-[#1c1917]/60">{emp.email}</p>
                  </div>
                  <Badge variant="cleano" size="sm">
                    {emp.totalWashes} washes
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-[#1c1917]/60">
                  <span>{emp.totalRags} rags total</span>
                  {emp.lastWashDate && (
                    <span>
                      Last: {new Date(emp.lastWashDate).toLocaleDateString("en-US")}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
