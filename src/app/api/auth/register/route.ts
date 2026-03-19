import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, Category } from '@/lib/models'
import { DEFAULT_CATEGORIES } from '@/lib/constants/defaultCategories'

export async function POST(request: Request) {
    try {
        const { email, password, displayName } = await request.json()

        if (!email || !password || !displayName) {
            return NextResponse.json(
                { error: 'Todos los campos son requeridos' },
                { status: 400 }
            )
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 8 caracteres' },
                { status: 400 }
            )
        }

        await connectDB()

        const existingUser = await User.findOne({ email: email.toLowerCase() })

        if (existingUser) {
            return NextResponse.json(
                { error: 'El email ya está registrado' },
                { status: 409 }
            )
        }

        const passwordHash = await bcrypt.hash(password, 12)

        const user = await User.create({
            email: email.toLowerCase(),
            passwordHash,
            displayName,
            baseCurrency: 'ARS',
            timezone: 'America/Argentina/Buenos_Aires',
        })

        // Crear categorías predeterminadas
        await Category.insertMany(
            DEFAULT_CATEGORIES.map((cat) => ({
                ...cat,
                userId: user._id,
                isDefault: true,
                isArchived: false,
            }))
        )

        return NextResponse.json(
            {
                message: 'Usuario creado correctamente',
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    displayName: user.displayName,
                },
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Error en registro:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}