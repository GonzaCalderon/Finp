/**
 * Script de seed para E2E — crea el usuario de test con sus datos iniciales.
 *
 * Uso:
 *   npm run test:seed
 *
 * Lee las variables de .env.test.local y crea en finm-test:
 *   - usuario test@finp.dev / TestPass123!
 *   - categorías predeterminadas
 *   - cuenta "Efectivo" predeterminada
 *
 * Es idempotente: si el usuario ya existe, no hace nada.
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Cargar .env.test.local antes que cualquier otra cosa
config({ path: resolve(process.cwd(), '.env.test.local'), override: true })

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI no definido en .env.test.local')
    process.exit(1)
}

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'test@finp.dev'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!'
const TEST_NAME = 'Test User'

// ── Schemas inline (evita importar código que depende de Next.js) ──────────────

const UserSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        displayName: { type: String, required: true, trim: true },
        baseCurrency: { type: String, enum: ['ARS', 'USD'], required: true },
        timezone: { type: String, required: true },
    },
    { timestamps: true }
)

const CategorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    color: { type: String },
    sortOrder: { type: Number },
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
})

const AccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    currency: { type: String, required: true },
    initialBalance: { type: Number, default: 0 },
    color: { type: String },
    isActive: { type: Boolean, default: true },
    includeInNetWorth: { type: Boolean, default: true },
    allowNegativeBalance: { type: Boolean, default: false },
})

const DEFAULT_CATEGORIES = [
    { name: 'Supermercado', type: 'expense', color: '#22c55e', sortOrder: 0 },
    { name: 'Restaurantes y delivery', type: 'expense', color: '#f97316', sortOrder: 1 },
    { name: 'Transporte', type: 'expense', color: '#3b82f6', sortOrder: 2 },
    { name: 'Salud y farmacia', type: 'expense', color: '#ec4899', sortOrder: 3 },
    { name: 'Indumentaria', type: 'expense', color: '#8b5cf6', sortOrder: 4 },
    { name: 'Entretenimiento', type: 'expense', color: '#eab308', sortOrder: 5 },
    { name: 'Suscripciones', type: 'expense', color: '#14b8a6', sortOrder: 6 },
    { name: 'Servicios', type: 'expense', color: '#6b7280', sortOrder: 7 },
    { name: 'Educación', type: 'expense', color: '#0ea5e9', sortOrder: 8 },
    { name: 'Hogar', type: 'expense', color: '#a16207', sortOrder: 9 },
    { name: 'Viajes', type: 'expense', color: '#06b6d4', sortOrder: 10 },
    { name: 'Impuestos', type: 'expense', color: '#dc2626', sortOrder: 11 },
    { name: 'Pago de préstamos', type: 'expense', color: '#8B5CF6' },
    { name: 'Otros gastos', type: 'expense', color: '#9ca3af', sortOrder: 12 },
    { name: 'Sueldo', type: 'income', color: '#16a34a', sortOrder: 0 },
    { name: 'Bonos (Sueldo)', type: 'income', color: '#15803d', sortOrder: 1 },
    { name: 'Freelance', type: 'income', color: '#2563eb', sortOrder: 2 },
    { name: 'Alquileres', type: 'income', color: '#7c3aed', sortOrder: 3 },
    { name: 'Préstamos', type: 'income', color: '#8B5CF6' },
    { name: 'Otros ingresos', type: 'income', color: '#9ca3af', sortOrder: 4 },
]

async function seed() {
    console.log('🌱  Conectando a la DB de test...')
    await mongoose.connect(MONGODB_URI!)

    const User = mongoose.models.User || mongoose.model('User', UserSchema)
    const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema)
    const Account = mongoose.models.Account || mongoose.model('Account', AccountSchema)

    const existing = await User.findOne({ email: TEST_EMAIL })
    if (existing) {
        console.log(`✅  El usuario ${TEST_EMAIL} ya existe en la DB de test. Nada que hacer.`)
        await mongoose.disconnect()
        return
    }

    console.log(`👤  Creando usuario ${TEST_EMAIL}...`)
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)
    const user = await User.create({
        email: TEST_EMAIL,
        passwordHash,
        displayName: TEST_NAME,
        baseCurrency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
    })

    console.log('🏷️   Creando categorías predeterminadas...')
    await Category.insertMany(
        DEFAULT_CATEGORIES.map((cat) => ({
            ...cat,
            userId: user._id,
            isDefault: true,
            isArchived: false,
        }))
    )

    console.log('🏦  Creando cuenta Efectivo...')
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

    console.log('✅  Seed completado:')
    console.log(`    email:    ${TEST_EMAIL}`)
    console.log(`    password: ${TEST_PASSWORD}`)
    console.log(`    DB:       ${MONGODB_URI!.split('@')[1]?.split('?')[0] ?? 'configurada'}`)

    await mongoose.disconnect()
}

seed().catch((e) => {
    console.error('❌  Error en el seed:', e)
    process.exit(1)
})
