import { NextResponse } from 'next/server'

const ADMIN_SECRET = process.env.ADMIN_DASHBOARD_SECRET

export async function POST(request: Request) {
  if (!ADMIN_SECRET) return NextResponse.json({ error: 'Admin dashboard is not configured.' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  if (body.secret !== ADMIN_SECRET) return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 })

  const response = NextResponse.json({ success: true })
  response.cookies.set('rsdz_admin', ADMIN_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
