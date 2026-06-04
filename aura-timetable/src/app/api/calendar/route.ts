import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const calendarId = searchParams.get('calendarId') || 'primary';

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: (session as any).accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: (() => {
        const now = new Date();
        const jstDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        jstDate.setDate(jstDate.getDate() - 7);
        jstDate.setHours(0, 0, 0, 0);
        return new Date(jstDate.getTime() - 9 * 60 * 60 * 1000).toISOString();
      })(),
      timeMax: (() => {
        const now = new Date();
        const jstDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        jstDate.setDate(jstDate.getDate() + 30);
        jstDate.setHours(23, 59, 59, 999);
        return new Date(jstDate.getTime() - 9 * 60 * 60 * 1000).toISOString();
      })(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return NextResponse.json(response.data.items || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
