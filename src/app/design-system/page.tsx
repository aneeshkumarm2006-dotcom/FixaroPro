import type { Metadata } from "next";
import "./fixaro-ds.css";
import DesignSystemClient from "./DesignSystemClient";

export const metadata: Metadata = {
  title: "Fixaro — Design System",
  description: "The Fixaro admin design system: charcoal + safety-orange operational kit, light + dark.",
};

export default function DesignSystemPage() {
  return <DesignSystemClient />;
}
