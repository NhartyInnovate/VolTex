import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { AppNotification } from "@/types";

export const dynamic = "force-dynamic";

interface RawNotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link_url?: string | null;
  metadata?: Record<string, unknown>;
  deduplication_key: string;
  is_read: boolean;
  created_at: string;
}

/**
 * GET /api/notifications
 * Returns the calling user's recent notifications and unread count.
 * Enforced by server session and Supabase Row Level Security.
 */
export async function GET() {
  try {
    const supabase = createServerUserClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Query recent notifications (limit 20)
    const { data: rawRows, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message || "Failed to fetch notifications." },
        { status: 500 }
      );
    }

    const notifications: AppNotification[] = (rawRows || []).map(
      (r: RawNotificationRow) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        message: r.message,
        type: r.type as AppNotification["type"],
        linkUrl: r.link_url,
        metadata: r.metadata,
        deduplicationKey: r.deduplication_key,
        isRead: r.is_read,
        createdAt: r.created_at,
      })
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Body: { notificationId?: string; markAll?: boolean }
 * Marks a specific notification or all notifications as read for the calling user.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = createServerUserClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body;

    if (markAll) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, markedAll: true });
    }

    if (notificationId) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, notificationId });
    }

    return NextResponse.json(
      { error: "Missing notificationId or markAll parameter." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
