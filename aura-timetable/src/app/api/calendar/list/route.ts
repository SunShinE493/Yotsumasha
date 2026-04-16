import { google } from "googleapis";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: (session as any).accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.calendarList.list();
    const calendars = response.data.items?.map(item => ({
      id: item.id,
      summary: item.summary,
      primary: item.primary || false
    })) || [];

    return NextResponse.json(calendars);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
