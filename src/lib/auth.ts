import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                await connectDB()

                const user = await User.findOne({
                    email: (credentials.email as string).toLowerCase(),
                })

                if (!user) return null

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )

                if (!isValid) return null

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: user.displayName,
                }
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 60 * 60,      // 1 hora máximo
        updateAge: 60 * 30,   // renueva si hay actividad cada 30 minutos
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string
            }
            return session
        },
    },
    pages: {
        signIn: '/login',
    },
})