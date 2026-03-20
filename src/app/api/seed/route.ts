import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Category, Transaction, InstallmentPlan, ScheduledCommitment } from '@/lib/models'

export async function POST() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()
        const userId = session.user.id

        // Limpiar datos existentes
        await Promise.all([
            Account.deleteMany({ userId }),
            Category.deleteMany({ userId }),
            Transaction.deleteMany({ userId }),
            InstallmentPlan.deleteMany({ userId }),
            ScheduledCommitment.deleteMany({ userId }),
        ])

        // CATEGORÍAS
        const cats = await Category.insertMany([
            // Ingresos
            { userId, name: 'Sueldo', type: 'income', color: '#16a34a', sortOrder: 0, isDefault: true, isArchived: false },
            { userId, name: 'Bonos (Sueldo)', type: 'income', color: '#15803d', sortOrder: 1, isDefault: true, isArchived: false },
            { userId, name: 'Freelance', type: 'income', color: '#2563eb', sortOrder: 2, isDefault: true, isArchived: false },
            { userId, name: 'Préstamos', type: 'income', color: '#8b5cf6', sortOrder: 3, isDefault: true, isArchived: false },
            { userId, name: 'Otros ingresos', type: 'income', color: '#9ca3af', sortOrder: 4, isDefault: true, isArchived: false },
            // Gastos
            { userId, name: 'Supermercado', type: 'expense', color: '#22c55e', sortOrder: 0, isDefault: true, isArchived: false },
            { userId, name: 'Restaurantes y delivery', type: 'expense', color: '#f97316', sortOrder: 1, isDefault: true, isArchived: false },
            { userId, name: 'Transporte', type: 'expense', color: '#3b82f6', sortOrder: 2, isDefault: true, isArchived: false },
            { userId, name: 'Salud y farmacia', type: 'expense', color: '#ec4899', sortOrder: 3, isDefault: true, isArchived: false },
            { userId, name: 'Indumentaria', type: 'expense', color: '#8b5cf6', sortOrder: 4, isDefault: true, isArchived: false },
            { userId, name: 'Entretenimiento', type: 'expense', color: '#eab308', sortOrder: 5, isDefault: true, isArchived: false },
            { userId, name: 'Suscripciones', type: 'expense', color: '#14b8a6', sortOrder: 6, isDefault: true, isArchived: false },
            { userId, name: 'Servicios', type: 'expense', color: '#6b7280', sortOrder: 7, isDefault: true, isArchived: false },
            { userId, name: 'Educación', type: 'expense', color: '#0ea5e9', sortOrder: 8, isDefault: true, isArchived: false },
            { userId, name: 'Hogar', type: 'expense', color: '#a16207', sortOrder: 9, isDefault: true, isArchived: false },
            { userId, name: 'Viajes', type: 'expense', color: '#06b6d4', sortOrder: 10, isDefault: true, isArchived: false },
            { userId, name: 'Impuestos', type: 'expense', color: '#dc2626', sortOrder: 11, isDefault: true, isArchived: false },
            { userId, name: 'Pago de préstamos', type: 'expense', color: '#8b5cf6', sortOrder: 12, isDefault: true, isArchived: false },
            { userId, name: 'Otros gastos', type: 'expense', color: '#9ca3af', sortOrder: 13, isDefault: true, isArchived: false },
        ])

        const c = Object.fromEntries(cats.map((c) => [c.name, c._id]))

        // CUENTAS
        const accounts = await Account.insertMany([
            { userId, name: 'Galicia', type: 'bank', currency: 'ARS', initialBalance: 150000, isActive: true, includeInNetWorth: true, color: '#3b82f6' },
            { userId, name: 'Efectivo', type: 'cash', currency: 'ARS', initialBalance: 50000, isActive: true, includeInNetWorth: true, color: '#22c55e' },
            { userId, name: 'Mercado Pago', type: 'wallet', currency: 'ARS', initialBalance: 30000, isActive: true, includeInNetWorth: true, color: '#009ee3' },
            { userId, name: 'Visa Galicia', type: 'credit_card', currency: 'ARS', initialBalance: 0, isActive: true, includeInNetWorth: true, color: '#f59e0b' },
            { userId, name: 'Ahorros USD', type: 'savings', currency: 'USD', initialBalance: 2000, isActive: true, includeInNetWorth: true, color: '#10b981' },
        ])

        const a = Object.fromEntries(accounts.map((a) => [a.name, a._id]))

        // CUOTAS
        const plan1 = await InstallmentPlan.create({
            userId, description: 'Smart TV Samsung 55"', totalAmount: 360000,
            installmentAmount: 30000, installmentCount: 12, currency: 'ARS',
            accountId: a['Visa Galicia'], categoryId: c['Hogar'],
            firstClosingMonth: '2026-01', purchaseDate: new Date('2024-12-28'),
        })

        const plan2 = await InstallmentPlan.create({
            userId, description: 'iPhone 15', totalAmount: 900000,
            installmentAmount: 75000, installmentCount: 12, currency: 'ARS',
            accountId: a['Visa Galicia'], categoryId: c['Otros gastos'],
            firstClosingMonth: '2026-02', purchaseDate: new Date('2026-01-15'),
        })

        const plan3 = await InstallmentPlan.create({
            userId, description: 'Silla gamer', totalAmount: 180000,
            installmentAmount: 30000, installmentCount: 6, currency: 'ARS',
            accountId: a['Visa Galicia'], categoryId: c['Hogar'],
            firstClosingMonth: '2026-01', purchaseDate: new Date('2024-12-20'),
        })

        // COMPROMISOS
        await ScheduledCommitment.insertMany([
            {
                userId, description: 'Alquiler', amount: 180000, currency: 'ARS',
                categoryId: c['Hogar'], accountId: a['Galicia'],
                recurrence: 'monthly', dayOfMonth: 1, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
            {
                userId, description: 'Expensas', amount: 45000, currency: 'ARS',
                categoryId: c['Hogar'], accountId: a['Galicia'],
                recurrence: 'monthly', dayOfMonth: 10, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
            {
                userId, description: 'Internet Fibertel', amount: 12000, currency: 'ARS',
                categoryId: c['Servicios'], accountId: a['Galicia'],
                recurrence: 'monthly', dayOfMonth: 15, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
            {
                userId, description: 'Netflix', amount: 4500, currency: 'ARS',
                categoryId: c['Suscripciones'], accountId: a['Mercado Pago'],
                recurrence: 'monthly', dayOfMonth: 5, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
            {
                userId, description: 'Spotify', amount: 2200, currency: 'ARS',
                categoryId: c['Suscripciones'], accountId: a['Mercado Pago'],
                recurrence: 'monthly', dayOfMonth: 8, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
            {
                userId, description: 'Gimnasio', amount: 15000, currency: 'ARS',
                categoryId: c['Salud y farmacia'], accountId: a['Efectivo'],
                recurrence: 'monthly', dayOfMonth: 1, applyMode: 'manual', isActive: true,
                startDate: new Date('2024-01-01'),
            },
        ])

        // TRANSACCIONES
        const txns = []

        // ===== ENERO 2026 =====
        // Ingresos
        txns.push({ userId, type: 'income', amount: 450000, currency: 'ARS', date: new Date('2026-01-05'), description: 'Sueldo enero', categoryId: c['Sueldo'], destinationAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'income', amount: 50000, currency: 'ARS', date: new Date('2026-01-10'), description: 'Bono anual', categoryId: c['Bonos (Sueldo)'], destinationAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'income', amount: 80000, currency: 'ARS', date: new Date('2026-01-18'), description: 'Proyecto freelance - Landing page', categoryId: c['Freelance'], destinationAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })

        // Gastos fijos
        txns.push({ userId, type: 'expense', amount: 180000, currency: 'ARS', date: new Date('2026-01-01'), description: 'Alquiler enero', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 45000, currency: 'ARS', date: new Date('2026-01-10'), description: 'Expensas enero', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 12000, currency: 'ARS', date: new Date('2026-01-15'), description: 'Internet Fibertel', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 4500, currency: 'ARS', date: new Date('2026-01-05'), description: 'Netflix', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 2200, currency: 'ARS', date: new Date('2026-01-08'), description: 'Spotify', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 15000, currency: 'ARS', date: new Date('2026-01-01'), description: 'Gimnasio enero', categoryId: c['Salud y farmacia'], sourceAccountId: a['Efectivo'], status: 'confirmed', createdFrom: 'web' })

        // Gastos variables enero
        txns.push({ userId, type: 'expense', amount: 42000, currency: 'ARS', date: new Date('2026-01-07'), description: 'Supermercado Carrefour', categoryId: c['Supermercado'], sourceAccountId: a['Visa Galicia'], merchant: 'Carrefour', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 18000, currency: 'ARS', date: new Date('2026-01-14'), description: 'Supermercado Dia', categoryId: c['Supermercado'], sourceAccountId: a['Efectivo'], merchant: 'Dia', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 8500, currency: 'ARS', date: new Date('2026-01-03'), description: 'PedidosYa - pizza', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Mercado Pago'], merchant: 'PedidosYa', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 12000, currency: 'ARS', date: new Date('2026-01-11'), description: 'Restaurante Don Julio', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Visa Galicia'], merchant: 'Don Julio', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 6500, currency: 'ARS', date: new Date('2026-01-20'), description: 'Rappi - sushi', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Mercado Pago'], merchant: 'Rappi', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 9200, currency: 'ARS', date: new Date('2026-01-08'), description: 'SUBE y Uber', categoryId: c['Transporte'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 4800, currency: 'ARS', date: new Date('2026-01-22'), description: 'Farmacia Farmacity', categoryId: c['Salud y farmacia'], sourceAccountId: a['Efectivo'], merchant: 'Farmacity', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 35000, currency: 'ARS', date: new Date('2026-01-15'), description: 'Zapatillas Nike', categoryId: c['Indumentaria'], sourceAccountId: a['Visa Galicia'], merchant: 'Nike', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 8000, currency: 'ARS', date: new Date('2026-01-25'), description: 'Cine + cena', categoryId: c['Entretenimiento'], sourceAccountId: a['Efectivo'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 22000, currency: 'ARS', date: new Date('2026-01-18'), description: 'Luz y gas enero', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-01-20'), description: 'Smart TV Samsung - cuota 1', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan1._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-01-20'), description: 'Silla gamer - cuota 1', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan3._id, status: 'confirmed', createdFrom: 'web' })

        // Transferencias enero
        txns.push({ userId, type: 'transfer', amount: 50000, currency: 'ARS', date: new Date('2026-01-06'), description: 'Paso a Mercado Pago', sourceAccountId: a['Galicia'], destinationAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })

        // ===== FEBRERO 2026 =====
        // Ingresos
        txns.push({ userId, type: 'income', amount: 450000, currency: 'ARS', date: new Date('2026-02-05'), description: 'Sueldo febrero', categoryId: c['Sueldo'], destinationAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'income', amount: 120000, currency: 'ARS', date: new Date('2026-02-15'), description: 'Proyecto freelance - App mobile', categoryId: c['Freelance'], destinationAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })

        // Gastos fijos febrero
        txns.push({ userId, type: 'expense', amount: 180000, currency: 'ARS', date: new Date('2026-02-01'), description: 'Alquiler febrero', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 45000, currency: 'ARS', date: new Date('2026-02-10'), description: 'Expensas febrero', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 12000, currency: 'ARS', date: new Date('2026-02-15'), description: 'Internet Fibertel', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 4500, currency: 'ARS', date: new Date('2026-02-05'), description: 'Netflix', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 2200, currency: 'ARS', date: new Date('2026-02-08'), description: 'Spotify', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 15000, currency: 'ARS', date: new Date('2026-02-01'), description: 'Gimnasio febrero', categoryId: c['Salud y farmacia'], sourceAccountId: a['Efectivo'], status: 'confirmed', createdFrom: 'web' })

        // Gastos variables febrero
        txns.push({ userId, type: 'expense', amount: 48000, currency: 'ARS', date: new Date('2026-02-06'), description: 'Supermercado Carrefour', categoryId: c['Supermercado'], sourceAccountId: a['Visa Galicia'], merchant: 'Carrefour', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 22000, currency: 'ARS', date: new Date('2026-02-13'), description: 'Supermercado Coto', categoryId: c['Supermercado'], sourceAccountId: a['Efectivo'], merchant: 'Coto', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 15000, currency: 'ARS', date: new Date('2026-02-14'), description: 'Cena San Valentín', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Visa Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 7200, currency: 'ARS', date: new Date('2026-02-09'), description: 'PedidosYa - hamburguesas', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Mercado Pago'], merchant: 'PedidosYa', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 11000, currency: 'ARS', date: new Date('2026-02-18'), description: 'Uber + SUBE', categoryId: c['Transporte'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 28000, currency: 'ARS', date: new Date('2026-02-22'), description: 'Consulta médica + análisis', categoryId: c['Salud y farmacia'], sourceAccountId: a['Visa Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 55000, currency: 'ARS', date: new Date('2026-02-20'), description: 'Campera cuero', categoryId: c['Indumentaria'], sourceAccountId: a['Visa Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 18000, currency: 'ARS', date: new Date('2026-02-23'), description: 'Recital Coldplay', categoryId: c['Entretenimiento'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 24000, currency: 'ARS', date: new Date('2026-02-18'), description: 'Luz, gas y agua', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-02-20'), description: 'Smart TV Samsung - cuota 2', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan1._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 75000, currency: 'ARS', date: new Date('2026-02-20'), description: 'iPhone 15 - cuota 1', categoryId: c['Otros gastos'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan2._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-02-20'), description: 'Silla gamer - cuota 2', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan3._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 45000, currency: 'ARS', date: new Date('2026-02-28'), description: 'Impuesto automotor', categoryId: c['Impuestos'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })

        // Transferencias febrero
        txns.push({ userId, type: 'transfer', amount: 80000, currency: 'ARS', date: new Date('2026-02-06'), description: 'Paso a Mercado Pago', sourceAccountId: a['Galicia'], destinationAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })

        // ===== MARZO 2026 =====
        // Ingresos
        txns.push({ userId, type: 'income', amount: 450000, currency: 'ARS', date: new Date('2026-03-05'), description: 'Sueldo marzo', categoryId: c['Sueldo'], destinationAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'income', amount: 400000, currency: 'ARS', date: new Date('2026-03-10'), description: 'Bonos Q1', categoryId: c['Bonos (Sueldo)'], destinationAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })

        // Gastos fijos marzo
        txns.push({ userId, type: 'expense', amount: 180000, currency: 'ARS', date: new Date('2026-03-01'), description: 'Alquiler marzo', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 45000, currency: 'ARS', date: new Date('2026-03-10'), description: 'Expensas marzo', categoryId: c['Hogar'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 12000, currency: 'ARS', date: new Date('2026-03-15'), description: 'Internet Fibertel', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 4500, currency: 'ARS', date: new Date('2026-03-05'), description: 'Netflix', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 2200, currency: 'ARS', date: new Date('2026-03-08'), description: 'Spotify', categoryId: c['Suscripciones'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 15000, currency: 'ARS', date: new Date('2026-03-01'), description: 'Gimnasio marzo', categoryId: c['Salud y farmacia'], sourceAccountId: a['Efectivo'], status: 'confirmed', createdFrom: 'web' })

        // Gastos variables marzo
        txns.push({ userId, type: 'expense', amount: 52000, currency: 'ARS', date: new Date('2026-03-05'), description: 'Supermercado Carrefour', categoryId: c['Supermercado'], sourceAccountId: a['Visa Galicia'], merchant: 'Carrefour', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 25000, currency: 'ARS', date: new Date('2026-03-12'), description: 'Supermercado Jumbo', categoryId: c['Supermercado'], sourceAccountId: a['Efectivo'], merchant: 'Jumbo', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 9500, currency: 'ARS', date: new Date('2026-03-07'), description: 'PedidosYa - thai', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Mercado Pago'], merchant: 'PedidosYa', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 22000, currency: 'ARS', date: new Date('2026-03-15'), description: 'Restaurante La Cabrera', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Visa Galicia'], merchant: 'La Cabrera', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 8000, currency: 'ARS', date: new Date('2026-03-09'), description: 'Rappi - japonesa', categoryId: c['Restaurantes y delivery'], sourceAccountId: a['Mercado Pago'], merchant: 'Rappi', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 13500, currency: 'ARS', date: new Date('2026-03-10'), description: 'Uber + taxi', categoryId: c['Transporte'], sourceAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 8500, currency: 'ARS', date: new Date('2026-03-18'), description: 'Farmacia + vitaminas', categoryId: c['Salud y farmacia'], sourceAccountId: a['Efectivo'], merchant: 'Farmacity', status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 42000, currency: 'ARS', date: new Date('2026-03-22'), description: 'Ropa de verano', categoryId: c['Indumentaria'], sourceAccountId: a['Visa Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 15000, currency: 'ARS', date: new Date('2026-03-16'), description: 'Entradas teatro + bar', categoryId: c['Entretenimiento'], sourceAccountId: a['Efectivo'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 26000, currency: 'ARS', date: new Date('2026-03-18'), description: 'Servicios marzo', categoryId: c['Servicios'], sourceAccountId: a['Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 85000, currency: 'ARS', date: new Date('2026-03-20'), description: 'Vuelo a Bariloche', categoryId: c['Viajes'], sourceAccountId: a['Visa Galicia'], status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-03-20'), description: 'Smart TV Samsung - cuota 3', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan1._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 75000, currency: 'ARS', date: new Date('2026-03-20'), description: 'iPhone 15 - cuota 2', categoryId: c['Otros gastos'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan2._id, status: 'confirmed', createdFrom: 'web' })
        txns.push({ userId, type: 'expense', amount: 30000, currency: 'ARS', date: new Date('2026-03-20'), description: 'Silla gamer - cuota 3', categoryId: c['Hogar'], sourceAccountId: a['Visa Galicia'], installmentPlanId: plan3._id, status: 'confirmed', createdFrom: 'web' })

        // Transferencias marzo
        txns.push({ userId, type: 'transfer', amount: 100000, currency: 'ARS', date: new Date('2026-03-06'), description: 'Paso a Mercado Pago', sourceAccountId: a['Galicia'], destinationAccountId: a['Mercado Pago'], status: 'confirmed', createdFrom: 'web' })

        await Transaction.insertMany(txns)

        return NextResponse.json({
            success: true,
            summary: {
                categories: cats.length,
                accounts: accounts.length,
                transactions: txns.length,
                installmentPlans: 3,
                commitments: 6,
            }
        })
    } catch (error) {
        console.error('Error en seed:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}