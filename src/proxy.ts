import { auth } from '@/lib/auth'
import { normalizeSafeInviteCallbackUrl } from '@/lib/utils/invite-callback'
import { NextResponse } from 'next/server'

export default auth((req) => {
    const isLoggedIn = Boolean(req.auth)
    const pathname = req.nextUrl.pathname
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
    const isApiAuthRoute = pathname.startsWith('/api/auth')
    const isPublicInviteRoute =
        pathname.startsWith('/spaces/invite/') || pathname.startsWith('/api/spaces/invites/')

    if (isApiAuthRoute || isPublicInviteRoute) return NextResponse.next()

    if (!isLoggedIn && !isAuthRoute) {
        const loginUrl = new URL('/login', req.nextUrl)
        loginUrl.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`)
        return NextResponse.redirect(loginUrl)
    }

    if (isLoggedIn && isAuthRoute) {
        const callbackUrl = normalizeSafeInviteCallbackUrl(req.nextUrl.searchParams.get('callbackUrl'))
        return NextResponse.redirect(new URL(callbackUrl ?? '/dashboard', req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
