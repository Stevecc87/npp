import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createSupabaseServerClient();

    const payload = {
      lead_id: String(body.leadId),
      storage_path: String(body.storagePath),
      file_name: String(body.fileName),
      content_type: body.contentType ? String(body.contentType) : null,
      size: body.size ? Number(body.size) : null
    };

    const { error } = await supabase.from('photos').insert(payload);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
