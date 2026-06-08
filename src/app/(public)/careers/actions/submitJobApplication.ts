"use server";

import { db } from "@/db";
import {
  sendCustomerApplicationReceived,
  sendAdminJobApplication,
} from "@/lib/email";

export interface JobApplicationInput {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  experience?: string;
  coverLetter?: string;
  resumeUrl?: string;
}

export async function submitJobApplication(input: JobApplicationInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) return { success: false, error: "Name is required" };
  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  const application = await db.jobApplication.create({
    data: {
      name,
      email,
      phone: input.phone?.trim() || null,
      position: input.position?.trim() || null,
      experience: input.experience?.trim() || null,
      coverLetter: input.coverLetter?.trim() || null,
      resumeUrl: input.resumeUrl?.trim() || null,
      source: "careers_page",
    },
  });

  sendCustomerApplicationReceived({
    to: email,
    applicantName: name,
    position: input.position?.trim() ?? null,
  }).catch((e) => console.error("applicant confirmation email", e));

  sendAdminJobApplication({
    applicationId: application.id,
    name,
    email,
    phone: input.phone?.trim() ?? null,
    position: input.position?.trim() ?? null,
    resumeUrl: input.resumeUrl?.trim() ?? null,
  }).catch((e) => console.error("admin application alert email", e));

  return { success: true, applicationId: application.id };
}
