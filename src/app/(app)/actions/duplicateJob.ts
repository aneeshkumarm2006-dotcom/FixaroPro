"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function duplicateJob(jobId: string): Promise<{ success: boolean; newJobId?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const role = (session.user as any).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { success: false, error: "Not authorized" };
  }

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { cleaners: true, addOns: true },
    });

    if (!job) return { success: false, error: "Job not found" };

    const newJob = await db.job.create({
      data: {
        clientName: job.clientName,
        clientId: job.clientId,
        location: job.location,
        apartmentNumber: job.apartmentNumber,
        description: job.description,
        jobType: job.jobType,
        jobDate: null,
        startTime: job.startTime,
        endTime: job.endTime,
        status: "CREATED",
        price: job.price,
        employeePay: job.employeePay,
        parking: job.parking,
        notes: job.notes,
        paymentType: job.paymentType,
        discountAmount: job.discountAmount,
        bedCount: job.bedCount,
        bathCount: job.bathCount,
        halfBathCount: job.halfBathCount,
        squareFootage: job.squareFootage,
        payRateMultiplier: job.payRateMultiplier,
        isFlexible: job.isFlexible,
        requiredCleaners: job.requiredCleaners,
        isCashJob: job.isCashJob,
        bookingSource: job.bookingSource,
        subtotalAmount: job.subtotalAmount,
        gstAmount: job.gstAmount,
        qstAmount: job.qstAmount,
        totalAmount: job.totalAmount,
        paymentReceived: false,
        invoiceSent: false,
        employeeId: job.employeeId,
        cleaners: { connect: job.cleaners.map((c) => ({ id: c.id })) },
        addOns: {
          create: job.addOns.map((a) => ({ name: a.name, price: a.price })),
        },
      },
    });

    await db.jobLog.create({
      data: {
        jobId: newJob.id,
        userId: session.user.id,
        action: "NOTE_ADDED",
        description: `Duplicated from job #${job.jobNumber}`,
      },
    });

    revalidatePath("/jobs");
    return { success: true, newJobId: newJob.id };
  } catch (error) {
    console.error("Error duplicating job:", error);
    return { success: false, error: "Failed to duplicate job" };
  }
}
