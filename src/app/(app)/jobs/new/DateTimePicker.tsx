"use client";

import { useState } from "react";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";

interface ControlledDatePickerProps {
  name: string;
  defaultValue?: string;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
}

export function ControlledDatePicker({
  name,
  defaultValue = "",
  size = "md",
  placeholder,
}: ControlledDatePickerProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <DatePicker
      name={name}
      value={value}
      onChange={setValue}
      size={size}
      placeholder={placeholder}
    />
  );
}

interface ControlledTimePickerProps {
  name: string;
  defaultValue?: string;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
}

export function ControlledTimePicker({
  name,
  defaultValue = "",
  size = "md",
  placeholder,
}: ControlledTimePickerProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TimePicker
      name={name}
      value={value}
      onChange={setValue}
      size={size}
      placeholder={placeholder}
    />
  );
}
