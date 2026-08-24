import { NextRequest, NextResponse } from "next/server";
import { fulfillPayment } from "@/lib/payment-fulfillment";

export const runtime = "nodejs";

function getWebhookSecret() {
  return process.env.PAYMENT_WEBHOOK_SECRET || "";
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: NextRequest) {
  try {
    const configuredSecret = getWebhookSecret();

    if (!configuredSecret) {
      console.error("PAYMENT_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { success: false, error: "Webhook is not configured" },
        { status: 503 }
      );
    }

    const suppliedSecret = request.headers.get("x-webhook-secret") || "";

    if (!timingSafeEqual(suppliedSecret, configuredSecret)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const reference =
      typeof body?.reference === "string"
        ? body.reference.trim()
        : typeof body?.order_reference === "string"
          ? body.order_reference.trim()
          : typeof body?.order_id === "string"
            ? body.order_id.trim()
            : "";

    const status =
      typeof body?.status === "string"
        ? body.status.toLowerCase()
        : "";

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing payment reference" },
        { status: 400 }
      );
    }

    if (
      status !== "success" &&
      status !== "completed" &&
      status !== "paid" &&
      status !== "approved"
    ) {
      return NextResponse.json({
        success: true,
        processed: false,
        message: "Payment status is not successful",
        reference,
      });
    }

    // Single fulfillment path for every provider.
    // fulfillPayment() handles Talent Pro activation and idempotency.
    const result = await fulfillPayment(reference, "payment-webhook");

    return NextResponse.json({
      success: true,
      processed: true,
      reference,
      alreadyPaid: Boolean(result.alreadyPaid),
      productCode: result.order?.product_code || null,
      talentProActivation: result.talentProActivation || null,
    });
  } catch (error) {
    console.error("Payment webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}
