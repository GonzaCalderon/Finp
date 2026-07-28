/**
 * Seed idempotente para E2E.
 *
 * Antes de conectarse exige una base exclusiva, confirmada mediante
 * E2E_DATABASE_NAME y distinta de la configurada en .env.local.
 */

import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

import { DEFAULT_CATEGORIES } from '../../../src/lib/constants/defaultCategories'
import { Account } from '../../../src/lib/models/account.model'
import { Category } from '../../../src/lib/models/category.model'
import { User } from '../../../src/lib/models/user.model'
import { resolveE2EEnvironment } from './environment'
import {
    buildFinancialSmokePeriods,
    deriveFinancialSmokeEmail,
    FINANCIAL_SMOKE_IDS,
    FINANCIAL_SMOKE_NAMES,
    FINANCIAL_SMOKE_TAG,
    FINANCIAL_SMOKE_USER_NAME,
} from './financial-smoke'

const TEST_NAME = 'Test User'

async function ensureTestUser(
    email: string,
    password: string,
    displayName = TEST_NAME
) {
    const normalizedEmail = email.toLowerCase().trim()
    const existing = await User.findOne({ email: normalizedEmail })

    if (!existing) {
        const passwordHash = await bcrypt.hash(password, 12)
        const user = await User.create({
            email: normalizedEmail,
            passwordHash,
            displayName,
            baseCurrency: 'ARS',
            timezone: 'America/Argentina/Buenos_Aires',
        })
        return { user, created: true }
    }

    existing.displayName = displayName
    existing.baseCurrency = 'ARS'
    existing.timezone = 'America/Argentina/Buenos_Aires'
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
        existing.passwordHash = await bcrypt.hash(password, 12)
    }
    await existing.save()

    return { user: existing, created: false }
}

async function ensureDefaultCategories(userId: mongoose.Types.ObjectId) {
    const result = await Category.bulkWrite(
        DEFAULT_CATEGORIES.map((category) => ({
            updateOne: {
                filter: {
                    userId,
                    name: category.name,
                    type: category.type,
                },
                update: {
                    $set: {
                        ...category,
                        userId,
                        isDefault: true,
                        isArchived: false,
                    },
                },
                upsert: true,
            },
        }))
    )

    return {
        created: result.upsertedCount,
        updated: result.modifiedCount,
    }
}

async function ensureAccount(
    userId: mongoose.Types.ObjectId,
    name: string,
    values: Record<string, unknown>
) {
    const account = await Account.findOne({ userId, name })
    if (account) {
        Object.assign(account, values)
        await account.save()
        return false
    }

    await Account.create({ userId, name, ...values })
    return true
}

async function seedFinancialSmokeData(email: string, password: string) {
    const { user, created } = await ensureTestUser(
        deriveFinancialSmokeEmail(email),
        password,
        FINANCIAL_SMOKE_USER_NAME
    )
    user.set('preferences.monthStartDay', 1)
    user.set('preferences.consolidatedCurrency', 'ARS')
    user.set('preferences.operationalStartDate', undefined)
    await user.save()

    await ensureDefaultCategories(user._id)
    const [incomeCategory, expenseCategory] = await Promise.all([
        Category.findOne({ userId: user._id, type: 'income', isArchived: false }),
        Category.findOne({ userId: user._id, type: 'expense', isArchived: false }),
    ])
    if (!incomeCategory || !expenseCategory) {
        throw new Error('No se pudieron resolver las categorías del smoke financiero.')
    }

    const db = mongoose.connection.db
    if (!db) throw new Error('No se pudo obtener la base E2E.')

    const id = (value: string) => new mongoose.Types.ObjectId(value)
    const ids = Object.fromEntries(
        Object.entries(FINANCIAL_SMOKE_IDS).map(([key, value]) => [
            key,
            id(value),
        ])
    ) as Record<keyof typeof FINANCIAL_SMOKE_IDS, mongoose.Types.ObjectId>
    const { current, historical, dates } = buildFinancialSmokePeriods()
    const now = new Date()
    const timestamps = { createdAt: now, updatedAt: now }

    const accounts = db.collection('accounts')
    await Promise.all([
        accounts.replaceOne(
            { _id: ids.bankAccount },
            {
                _id: ids.bankAccount,
                userId: user._id,
                name: FINANCIAL_SMOKE_NAMES.bankAccount,
                type: 'bank',
                currency: 'ARS',
                supportedCurrencies: ['ARS', 'USD'],
                defaultPaymentMethods: ['debit'],
                initialBalance: 100_000,
                initialBalances: { ARS: 100_000, USD: 1_000 },
                color: '#0EA5E9',
                isActive: true,
                includeInNetWorth: true,
                allowNegativeBalance: true,
                ...timestamps,
            },
            { upsert: true }
        ),
        accounts.replaceOne(
            { _id: ids.negativeAccount },
            {
                _id: ids.negativeAccount,
                userId: user._id,
                name: FINANCIAL_SMOKE_NAMES.negativeAccount,
                type: 'cash',
                currency: 'ARS',
                supportedCurrencies: ['ARS'],
                defaultPaymentMethods: ['cash'],
                initialBalance: 10_000,
                initialBalances: { ARS: 10_000, USD: 0 },
                color: '#F97316',
                isActive: true,
                includeInNetWorth: true,
                allowNegativeBalance: true,
                ...timestamps,
            },
            { upsert: true }
        ),
        accounts.replaceOne(
            { _id: ids.creditCard },
            {
                _id: ids.creditCard,
                userId: user._id,
                name: FINANCIAL_SMOKE_NAMES.creditCard,
                type: 'credit_card',
                currency: 'ARS',
                supportedCurrencies: ['ARS', 'USD'],
                defaultPaymentMethods: ['credit_card'],
                initialBalance: 0,
                initialBalances: { ARS: 0, USD: 0 },
                color: '#6366F1',
                isActive: true,
                includeInNetWorth: true,
                allowNegativeBalance: true,
                creditCardConfig: {
                    closingDay: 20,
                    dueDay: 5,
                    creditLimit: 500_000,
                },
                ...timestamps,
            },
            { upsert: true }
        ),
    ])

    await db.collection('installmentplans').replaceOne(
        { _id: ids.installmentPlan },
        {
            _id: ids.installmentPlan,
            userId: user._id,
            accountId: ids.creditCard,
            categoryId: expenseCategory._id,
            description: FINANCIAL_SMOKE_NAMES.installment,
            merchant: 'E2E Store',
            currency: 'ARS',
            totalAmount: 120_000,
            installmentCount: 3,
            installmentAmount: 40_000,
            purchaseDate: dates.installmentPurchase,
            firstClosingMonth: current,
            ...timestamps,
        },
        { upsert: true }
    )

    const baseTransaction = {
        userId: user._id,
        status: 'confirmed',
        createdFrom: 'system',
        tags: [FINANCIAL_SMOKE_TAG],
        ...timestamps,
    }
    const transactions = db.collection('transactions')
    const fixtureTransactions = [
        {
            _id: ids.historicalIncome,
            ...baseTransaction,
            type: 'income',
            amount: 50_000,
            currency: 'ARS',
            date: dates.historicalIncome,
            description: FINANCIAL_SMOKE_NAMES.historicalIncome,
            categoryId: incomeCategory._id,
            destinationAccountId: ids.bankAccount,
        },
        {
            _id: ids.historicalExpenseArs,
            ...baseTransaction,
            type: 'expense',
            amount: 20_000,
            currency: 'ARS',
            date: dates.historicalExpenseArs,
            description: FINANCIAL_SMOKE_NAMES.historicalExpenseArs,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.bankAccount,
        },
        {
            _id: ids.historicalExpenseUsd,
            ...baseTransaction,
            type: 'expense',
            amount: 100,
            currency: 'USD',
            date: dates.historicalExpenseUsd,
            description: FINANCIAL_SMOKE_NAMES.historicalExpenseUsd,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.bankAccount,
        },
        {
            _id: ids.currentIncome,
            ...baseTransaction,
            type: 'income',
            amount: 200_000,
            currency: 'ARS',
            date: dates.currentIncome,
            description: FINANCIAL_SMOKE_NAMES.currentIncome,
            categoryId: incomeCategory._id,
            destinationAccountId: ids.bankAccount,
        },
        {
            _id: ids.currentExpenseArs,
            ...baseTransaction,
            type: 'expense',
            amount: 50_000,
            currency: 'ARS',
            date: dates.currentExpenseArs,
            description: FINANCIAL_SMOKE_NAMES.currentExpenseArs,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.bankAccount,
        },
        {
            _id: ids.currentExpenseUsd,
            ...baseTransaction,
            type: 'expense',
            amount: 300,
            currency: 'USD',
            date: dates.currentExpenseUsd,
            description: FINANCIAL_SMOKE_NAMES.currentExpenseUsd,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.bankAccount,
        },
        {
            _id: ids.currentExchange,
            ...baseTransaction,
            type: 'exchange',
            amount: 10_000,
            currency: 'ARS',
            destinationAmount: 10,
            destinationCurrency: 'USD',
            exchangeRate: 1_000,
            date: dates.currentExchange,
            description: FINANCIAL_SMOKE_NAMES.currentExchange,
            sourceAccountId: ids.bankAccount,
            destinationAccountId: ids.bankAccount,
        },
        {
            _id: ids.negativeExpense,
            ...baseTransaction,
            type: 'expense',
            amount: 25_000,
            currency: 'ARS',
            date: dates.negativeExpense,
            description: FINANCIAL_SMOKE_NAMES.negativeExpense,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.negativeAccount,
        },
        {
            _id: ids.partialDebtPayment,
            ...baseTransaction,
            type: 'personal_debt_payment',
            amount: 20_000,
            currency: 'ARS',
            date: dates.partialDebtPayment,
            description: FINANCIAL_SMOKE_NAMES.partialDebtPayment,
            sourceAccountId: ids.bankAccount,
        },
        {
            _id: ids.paidDebtCollect,
            ...baseTransaction,
            type: 'personal_debt_collect',
            amount: 150,
            currency: 'USD',
            date: dates.paidDebtCollect,
            description: FINANCIAL_SMOKE_NAMES.paidDebtCollect,
            destinationAccountId: ids.bankAccount,
        },
        {
            _id: ids.installmentPurchase,
            ...baseTransaction,
            type: 'credit_card_expense',
            amount: 120_000,
            currency: 'ARS',
            date: dates.installmentPurchase,
            description: FINANCIAL_SMOKE_NAMES.installment,
            categoryId: expenseCategory._id,
            sourceAccountId: ids.creditCard,
            installmentPlanId: ids.installmentPlan,
        },
    ]
    await Promise.all(
        fixtureTransactions.map((transaction) =>
            transactions.replaceOne(
                { _id: transaction._id },
                transaction,
                { upsert: true }
            )
        )
    )

    const debts = db.collection('debts')
    await Promise.all([
        debts.replaceOne(
            { _id: ids.partialDebt },
            {
                _id: ids.partialDebt,
                userId: user._id,
                direction: 'payable',
                sourceType: 'manual',
                counterpartyNameSnapshot: FINANCIAL_SMOKE_NAMES.partialDebt,
                amount: 100_000,
                remainingAmount: 80_000,
                currency: 'ARS',
                status: 'partially_paid',
                notes: FINANCIAL_SMOKE_TAG,
                ...timestamps,
            },
            { upsert: true }
        ),
        debts.replaceOne(
            { _id: ids.paidDebt },
            {
                _id: ids.paidDebt,
                userId: user._id,
                direction: 'receivable',
                sourceType: 'manual',
                counterpartyNameSnapshot: FINANCIAL_SMOKE_NAMES.paidDebt,
                amount: 150,
                remainingAmount: 0,
                currency: 'USD',
                status: 'paid',
                notes: FINANCIAL_SMOKE_TAG,
                ...timestamps,
            },
            { upsert: true }
        ),
    ])

    const movements = db.collection('debtmovements')
    const fixtureMovements = [
        {
            _id: ids.partialDebtCreation,
            userId: user._id,
            debtId: ids.partialDebt,
            type: 'creation',
            amount: 100_000,
            currency: 'ARS',
            date: dates.historicalIncome,
            notes: FINANCIAL_SMOKE_TAG,
            createdAt: now,
        },
        {
            _id: ids.partialDebtMovement,
            userId: user._id,
            debtId: ids.partialDebt,
            type: 'payment',
            amount: 20_000,
            currency: 'ARS',
            accountId: ids.bankAccount,
            transactionId: ids.partialDebtPayment,
            date: dates.partialDebtPayment,
            notes: FINANCIAL_SMOKE_TAG,
            createdAt: now,
        },
        {
            _id: ids.paidDebtCreation,
            userId: user._id,
            debtId: ids.paidDebt,
            type: 'creation',
            amount: 150,
            currency: 'USD',
            date: dates.historicalExpenseUsd,
            notes: FINANCIAL_SMOKE_TAG,
            createdAt: now,
        },
        {
            _id: ids.paidDebtMovement,
            userId: user._id,
            debtId: ids.paidDebt,
            type: 'collect',
            amount: 150,
            currency: 'USD',
            accountId: ids.bankAccount,
            transactionId: ids.paidDebtCollect,
            date: dates.paidDebtCollect,
            notes: FINANCIAL_SMOKE_TAG,
            createdAt: now,
        },
    ]
    await Promise.all(
        fixtureMovements.map((movement) =>
            movements.replaceOne(
                { _id: movement._id },
                movement,
                { upsert: true }
            )
        )
    )

    return { created, current, historical }
}

async function seed() {
    const environment = resolveE2EEnvironment()
    const {
        MONGODB_URI,
        TEST_USER_EMAIL,
        TEST_USER_PASSWORD,
    } = environment.variables

    console.log(`🌱 Conectando a la base E2E ${environment.databaseName}...`)
    await mongoose.connect(MONGODB_URI)

    try {
        const { user, created: userCreated } = await ensureTestUser(
            TEST_USER_EMAIL,
            TEST_USER_PASSWORD
        )
        const categories = await ensureDefaultCategories(user._id)
        const cashCreated = await ensureAccount(user._id, 'Efectivo', {
            type: 'cash',
            currency: 'ARS',
            supportedCurrencies: ['ARS'],
            defaultPaymentMethods: ['cash'],
            initialBalance: 0,
            initialBalances: { ARS: 0, USD: 0 },
            color: '#10B981',
            isActive: true,
            includeInNetWorth: true,
            allowNegativeBalance: false,
        })
        const cardCreated = await ensureAccount(user._id, 'Tarjeta E2E', {
            type: 'credit_card',
            currency: 'ARS',
            supportedCurrencies: ['ARS', 'USD'],
            defaultPaymentMethods: ['credit_card'],
            initialBalance: 0,
            initialBalances: { ARS: 0, USD: 0 },
            color: '#6366F1',
            isActive: true,
            includeInNetWorth: false,
            allowNegativeBalance: true,
            creditCardConfig: {
                closingDay: 20,
                dueDay: 5,
                creditLimit: 1_000_000,
            },
        })
        const financialSmoke = await seedFinancialSmokeData(
            TEST_USER_EMAIL,
            TEST_USER_PASSWORD
        )

        console.log('✅ Seed E2E verificado:')
        console.log(`   Usuario: ${userCreated ? 'creado' : 'actualizado'}`)
        console.log(
            `   Categorías: ${categories.created} creadas, ${categories.updated} actualizadas`
        )
        console.log(
            `   Cuentas base: ${Number(cashCreated) + Number(cardCreated)} creadas`
        )
        console.log(
            `   Smoke financiero: usuario ${financialSmoke.created ? 'creado' : 'actualizado'}, ` +
            `períodos ${financialSmoke.historical} y ${financialSmoke.current}`
        )
    } finally {
        await mongoose.disconnect()
    }
}

seed().catch((error) => {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error(`❌ Seed E2E fallido: ${message}`)
    process.exit(1)
})
