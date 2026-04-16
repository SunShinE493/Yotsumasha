import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: (session as any).accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // Search for the root folder
    const response = await drive.files.list({
      q: "name = 'Aura Timetable Documents' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let folderId = response.data.files?.[0]?.id;

    if (!folderId) {
      // Create it if not found
      const fileMetadata = {
        name: 'Aura Timetable Documents',
        mimeType: 'application/vnd.google-apps.folder',
      };
      const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });
      folderId = folder.data.id!;
    }

    return NextResponse.json({ folderId });
  } catch (error: any) {
    console.error('Drive API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
