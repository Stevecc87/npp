import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = String(searchParams.get('leadId') ?? '');
    if (!leadId) return new NextResponse('Missing leadId', { status: 400 });

    const supabase = createSupabaseServerClient();

    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (photosError) throw photosError;

    const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
    if (paths.length === 0) return NextResponse.json({ urls: [] });

    const entries = await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await supabase.storage.from('lead-photos').createSignedUrl(path, 60 * 60);
        if (error) {
          console.error('Failed to sign photo URL', { path, error: error.message });
          return null;
        }
        return data?.signedUrl ?? null;
      })
    );

    return NextResponse.json({ urls: entries.filter(Boolean) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
