import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    /*
     * هذه القيم يجب أن تأتي من نظام الدفع الخاص بك.
     */
    const {
      provider,
      payment_id,
      order_id,
      status,
      amount,
      currency,
      talent_id,
    } = body;

    // Basic validation
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Missing provider" },
        { status: 400 }
      );
    }

    if (!payment_id) {
      return NextResponse.json(
        { success: false, error: "Missing payment_id" },
        { status: 400 }
      );
    }

    if (!talent_id) {
      return NextResponse.json(
        { success: false, error: "Missing talent_id" },
        { status: 400 }
      );
    }

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "Missing order_id" },
        { status: 400 }
      );
    }

    /*
     * لا نقوم بتفعيل Pro إلا إذا كانت عملية الدفع ناجحة.
     */
    if (status !== "success" && status !== "completed") {
      return NextResponse.json({
        success: true,
        processed: false,
        message: "Payment is not successful",
      });
    }

    /*
     * استدعاء دالة Supabase الآمنة التي بنيناها.
     */
    const { data, error } = await supabaseAdmin.rpc(
      "activate_talent_pro",
      {
        p_talent_id: talent_id,
        p_payment_id: payment_id,
        p_order_id: order_id,
        p_provider: provider,
        p_amount: amount || null,
        p_currency: currency || "DZD",
      }
    );

    if (error) {
      console.error("activate_talent_pro error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Subscription activation failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: true,
      result: data,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid webhook request",
      },
      { status: 400 }
    );
  }
}
