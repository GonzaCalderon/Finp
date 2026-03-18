import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isAuthRoute = req.nextUrl.pathname.startsWith('/login') ||
        req.nextUrl.pathname.startsWith('/register')
    const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
    // Rutas de API de auth siempre permitidas
    if (isApiAuthRoute) return NextResponse.next()

    // Si no está logueado y no es ruta de auth, redirigir a login
    if (!isLoggedIn && !isAuthRoute) {
        return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // Si está logueado y va a login/register, redirigir a dashboard
    if (isLoggedIn && isAuthRoute) {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

