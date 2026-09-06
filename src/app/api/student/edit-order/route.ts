export const dynamic = "force-dynamic";
// src/app/api/student/edit-order/route.ts
// Allows student to edit topic/instructions before payment is confirmed

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.CLIENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId, topic, department, specialInstructions, guidelineFileUrl } = await req.json();

  if (!orderId || !topic?.trim()) {
    return NextResponse.json({ error: "orderId and topic are required." }, { status: 400 });
  }

  // Verify order belongs to this student and is still pending
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id:true, clientId:true, status:true, paymentMethod:true },
  });

  if (!order || order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Only allow editing if payment not yet confirmed
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "This order is already in progress and cannot be edited." }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      topic:               topic.trim(),
      department:          department?.trim() || "",
      specialInstructions: specialInstructions || null,
      guidelineFileUrl:    guidelineFileUrl || null,
    },
  });

  return NextResponse.json({ success: true, message: "Order updated successfully." });
}
