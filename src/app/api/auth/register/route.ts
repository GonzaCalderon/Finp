import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, Category, Account } from '@/lib/models'
import { DEFAULT_CATEGORIES } from '@/lib/constants/defaultCategories'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, password, displayName } = body as {
            email?: string
            password?: string
            displayName?: string
        }

        if (!email || !password || !displayName) {
            return NextResponse.json(
                { error: 'Todos los campos son requeridos' },
                { status: 400 }
            )
        }

        const trimmedName = displayName.trim()
        const normalizedEmail = email.toLowerCase().trim()

        if (trimmedName.length < 2 || trimmedName.length > 60) {
            return NextResponse.json(
                { error: 'El nombre debe tener entre 2 y 60 caracteres' },
                { status: 400 }
            )
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 8 caracteres' },
                { status: 400 }
            )
        }

        if (!/[a-zA-Z]/.test(password)) {
            return NextResponse.json(
                { error: 'La contraseña debe contener al menos una letra' },
                { status: 400 }
            )
        }

        if (!/[0-9]/.test(password)) {
            return NextResponse.json(
                { error: 'La contraseña debe contener al menos un número' },
                { status: 400 }
            )
        }

        await connectDB()

        const existingUser = await User.findOne({ email: normalizedEmail })

        if (existingUser) {
            return NextResponse.json(
                { error: 'El email ya está registrado' },
                { status: 409 }
            )
        }

        const passwordHash = await bcrypt.hash(password, 12)

        const user = await User.create({
            email: normalizedEmail,
            passwordHash,
            displayName: trimmedName,
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

        // Crear cuenta Efectivo predeterminada
        await Account.create({
            userId: user._id,
            name: 'Efectivo',
            type: 'cash',
            currency: 'ARS',
            initialBalance: 0,
            color: '#10B981',
            isActive: true,
            includeInNetWorth: true,
            allowNegativeBalance: false,
        })

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
