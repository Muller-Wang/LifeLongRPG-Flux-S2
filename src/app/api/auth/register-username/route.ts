import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { buildUsernameAuthEmail, isValidUsername, normalizeUsername } from '@/lib/auth/username';
import { ensureUserProfile, getUserProfileByUsername } from '@/lib/user/store';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  const username = normalizeUsername(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!displayName) {
    return NextResponse.json({ error: 'missing_display_name' }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'invalid_username' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 });
  }

  try {
    const existingProfile = await getUserProfileByUsername(username!);
    if (existingProfile) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 });
    }

    const sb = getSupabase();
    const authEmail = buildUsernameAuthEmail(username!);
    const { data, error } = await sb.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username
      }
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'auth_create_failed', detail: error?.message ?? 'unknown_error' },
        { status: 400 }
      );
    }

    try {
      const profile = await ensureUserProfile({
        id: data.user.id,
        displayName,
        username: username!,
        metadata: {
          authProvider: 'username',
          email: authEmail,
          emailBound: false
        }
      });

      return NextResponse.json({
        userId: data.user.id,
        authEmail,
        profile
      });
    } catch (profileError: any) {
      await sb.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        {
          error: 'profile_create_failed',
          detail: profileError?.message ?? String(profileError)
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
