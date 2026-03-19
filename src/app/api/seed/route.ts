import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Transaction, InstallmentPlan, ScheduledCommitment } from '@/lib/models'
import mongoose from 'mongoose'

export async function POST() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()
        const userId = new mongoose.Types.ObjectId(session.user.id)

        // Cuentas
        const [banco, efectivo, mercadopago, visa] = await Account.insertMany([
            {
                userId, name: 'Galicia', type: 'bank', currency: 'ARS',
                institution: 'Galicia', initialBalance: 150000, isActive: true,
                includeInNetWorth: true, color: '#3b82f6',
            },
            {
                userId, name: 'Efectivo', type: 'cash', currency: 'ARS',
                initialBalance: 20000, isActive: true, includeInNetWorth: true, color: '#22c55e',
            },
            {
                userId, name: 'Mercado Pago', type: 'wallet', currency: 'ARS',
                institution: 'Mercado Pago', initialBalance: 35000, isActive: true,
                includeInNetWorth: true, color: '#6366f1',
            },
            {
                userId, name: 'Visa Galicia', type: 'credit_card', currency: 'ARS',
                institution: 'Galicia', initialBalance: 0, isActive: true,
                includeInNetWorth: true, color: '#f97316',
                creditCardConfig: { closingDay: 20, dueDay: 10, creditLimit: 800000 },
            },
        ])

        // Categorías del usuario (las que ya existen)
        const { Category } = await import('@/lib/models')
        const cats = await Category.find({ userId })
        const catMap: Record<string, mongoose.Types.ObjectId> = {}
        cats.forEach((c) => { catMap[c.name] = c._id })

        const now = new Date()
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        // Transacciones del mes actual
        await Transaction.insertMany([
            {
                userId, type: 'income', amount: 450000, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 5),
                description: 'Sueldo marzo', categoryId: catMap['Sueldo'],
                destinationAccountId: banco._id, status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 85000, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 6),
                description: 'Supermercado Carrefour', categoryId: catMap['Supermercado'],
                sourceAccountId: banco._id, merchant: 'Carrefour', status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 12000, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 7),
                description: 'Almuerzo con cliente', categoryId: catMap['Restaurantes y delivery'],
                sourceAccountId: visa._id, merchant: 'La Cabrera', status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 25000, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 8),
                description: 'SUBE y Uber', categoryId: catMap['Transporte'],
                sourceAccountId: mercadopago._id, status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 18500, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 10),
                description: 'Farmacity', categoryId: catMap['Salud y farmacia'],
                sourceAccountId: banco._id, merchant: 'Farmacity', status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 9900, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 11),
                description: 'Netflix', categoryId: catMap['Suscripciones'],
                sourceAccountId: visa._id, merchant: 'Netflix', status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'expense', amount: 6500, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 11),
                description: 'Spotify', categoryId: catMap['Suscripciones'],
                sourceAccountId: visa._id, merchant: 'Spotify', status: 'confirmed', createdFrom: 'web',
            },
            {
                userId, type: 'transfer', amount: 30000, currency: 'ARS',
                date: new Date(now.getFullYear(), now.getMonth(), 12),
                description: 'Transferencia a Mercado Pago',
                sourceAccountId: banco._id, destinationAccountId: mercadopago._id,
                status: 'confirmed', createdFrom: 'web',
            },
        ])

        // Plan de cuotas — Smart TV
        const plan = await InstallmentPlan.create({
            userId,
            accountId: visa._id,
            categoryId: catMap['Entretenimiento'],
            description: 'Smart TV Samsung',
            merchant: 'Frávega',
            currency: 'ARS',
            totalAmount: 360000,
            installmentCount: 12,
            installmentAmount: 30000,
            purchaseDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
            firstClosingMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        })

        // Transacción madre del plan
        await Transaction.create({
            userId, type: 'expense', amount: 360000, currency: 'ARS',
            date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
            description: 'Smart TV Samsung',
            categoryId: catMap['Entretenimiento'],
            sourceAccountId: visa._id,
            merchant: 'Frávega',
            installmentPlanId: plan._id,
            status: 'confirmed', createdFrom: 'web',
        })

        // Compromisos programados
        await ScheduledCommitment.insertMany([
            {
                userId, description: 'Alquiler', amount: 180000, currency: 'ARS',
                categoryId: catMap['Hogar'], recurrence: 'monthly',
                dayOfMonth: 1, applyMode: 'manual', isActive: true,
            },
            {
                userId, description: 'Internet Fibertel', amount: 12000, currency: 'ARS',
                categoryId: catMap['Servicios'], recurrence: 'monthly',
                dayOfMonth: 10, applyMode: 'manual', isActive: true,
            },
            {
                userId, description: 'Gimnasio', amount: 15000, currency: 'ARS',
                categoryId: catMap['Salud y farmacia'], recurrence: 'monthly',
                dayOfMonth: 5, applyMode: 'manual', isActive: true,
            },
            {
                userId, description: 'Expensas', amount: 45000, currency: 'ARS',
                categoryId: catMap['Hogar'], recurrence: 'monthly',
                dayOfMonth: 15, applyMode: 'manual', isActive: true,
            },
        ])

        return NextResponse.json({ message: 'Seed completado correctamente' })
    } catch (error) {
        console.error('Error en seed:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}