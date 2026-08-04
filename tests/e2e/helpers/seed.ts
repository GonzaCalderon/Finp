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
import { FunctionalSuggestionDismissal } from '../../../src/lib/models/functional-suggestion-dismissal.model'
import { ScheduledCommitment } from '../../../src/lib/models/scheduled-commitment.model'
import { resolveE2EEnvironment } from './environment'
import {
    buildFinancialSmokePeriods,
    deriveFinancialSmokeEmail,
    FINANCIAL_SMOKE_IDS,
    FINANCIAL_SMOKE_NAMES,
    FINANCIAL_SMOKE_TAG,
    FINANCIAL_SMOKE_USER_NAME,
} from './financial-smoke'
import {
    buildProjectionSmokePeriod,
    deriveProjectionSmokeEmail,
    PROJECTION_SMOKE_IDS,
    PROJECTION_SMOKE_NAMES,
    PROJECTION_SMOKE_USER_NAME,
} from './projection-smoke'
import {
    SPACE_IMPACT_ACCOUNT_NAME,
    SPACE_IMPACT_FIXTURES,
} from './space-impact'

const TEST_NAME = 'Test User'
const P2_CANDIDATE_DESCRIPTION = 'Cobertura P2'
const P2_CANDIDATE_SUBJECT_KEY = 'create_commitment|ARS|cobertura p2'
const P2_HISTORY_ACCOUNT_NAME = 'Historial P2'

async function resetGeneralE2EFinancialData(userId: mongoose.Types.ObjectId) {
    const db = mongoose.connection.db
    if (!db) throw new Error('MongoDB no está conectado para reiniciar el usuario E2E.')

    await Promise.all([
        db.collection('transactions').deleteMany({ userId }),
        db.collection('installmentplans').deleteMany({ userId }),
        db.collection('spaceentrypersonalimpacts').deleteMany({ userId }),
        db.collection('spaceentries').deleteMany({ createdByUserId: userId }),
        db.collection('spaceparticipants').deleteMany({ userId }),
        db.collection('spaces').deleteMany({ ownerUserId: userId }),
        db.collection('notifications').deleteMany({ recipientUserId: userId }),
        ScheduledCommitment.deleteMany({ userId }),
        FunctionalSuggestionDismissal.deleteMany({ userId }),
    ])
}

async function seedSpaceImpactFixtures(userId: mongoose.Types.ObjectId) {
    const db = mongoose.connection.db
    if (!db) throw new Error('MongoDB no esta conectado para sembrar Espacios E2E.')

    const [account, category] = await Promise.all([
        Account.findOne({ userId, name: SPACE_IMPACT_ACCOUNT_NAME }),
        Category.findOne({ userId, type: 'expense', isArchived: false }),
    ])
    if (!account || !category) {
        throw new Error('No se pudo resolver cuenta o categoria para Espacios E2E.')
    }

    const now = new Date()
    // Mantener los movimientos dentro del período actual y antes del límite
    // temporal que usa la fuente canónica de saldos (`Date.now() + 1`).
    const transactionDate = new Date(now.getTime() - 60_000)
    const timestamps = { createdAt: now, updatedAt: now }

    for (const fixture of Object.values(SPACE_IMPACT_FIXTURES)) {
        const spaceId = new mongoose.Types.ObjectId(fixture.spaceId)
        const participantId = new mongoose.Types.ObjectId(fixture.participantId)
        const normalEntryId = new mongoose.Types.ObjectId(fixture.normalEntryId)
        const normalTransactionId = new mongoose.Types.ObjectId(fixture.normalTransactionId)
        const orphanEntryId = new mongoose.Types.ObjectId(fixture.orphanEntryId)
        const orphanTransactionId = new mongoose.Types.ObjectId(fixture.orphanTransactionId)

        await Promise.all([
            db.collection('spaces').replaceOne(
                { _id: spaceId },
                {
                    _id: spaceId,
                    ownerUserId: userId,
                    name: fixture.spaceName,
                    type: 'home',
                    mode: 'synchronized',
                    status: 'active',
                    currencies: ['ARS'],
                    reportingCurrency: 'ARS',
                    defaultSplitMode: 'none',
                    simplifyDebts: false,
                    debtMode: 'direct',
                    ...timestamps,
                },
                { upsert: true }
            ),
            db.collection('spaceparticipants').replaceOne(
                { _id: participantId },
                {
                    _id: participantId,
                    spaceId,
                    kind: 'finp_user',
                    userId,
                    displayName: 'Test User',
                    role: 'owner',
                    inviteStatus: 'accepted',
                    isActive: true,
                    ...timestamps,
                },
                { upsert: true }
            ),
            db.collection('spaceentries').replaceOne(
                { _id: normalEntryId },
                {
                    _id: normalEntryId,
                    spaceId,
                    createdByUserId: userId,
                    createdByParticipantId: participantId,
                    type: 'expense',
                    status: 'confirmed',
                    title: fixture.normalDescription,
                    amount: 7_000,
                    currency: 'ARS',
                    reportingAmount: 7_000,
                    date: transactionDate,
                    paidByParticipantId: participantId,
                    sharedWithParticipantIds: [participantId],
                    splitMode: 'none',
                    confirmationRequired: false,
                    confirmedByUserId: userId,
                    confirmedAt: now,
                    isVoided: false,
                    editCount: 0,
                    ...timestamps,
                },
                { upsert: true }
            ),
            db.collection('transactions').replaceOne(
                { _id: normalTransactionId },
                {
                    _id: normalTransactionId,
                    userId,
                    type: 'expense',
                    amount: 7_000,
                    currency: 'ARS',
                    date: transactionDate,
                    description: fixture.normalDescription,
                    categoryId: category._id,
                    sourceAccountId: account._id,
                    status: 'confirmed',
                    createdFrom: 'system',
                    spaceId,
                    spaceEntryId: normalEntryId,
                    spaceNameSnapshot: fixture.spaceName,
                    tags: ['e2e-space-impact'],
                    ...timestamps,
                },
                { upsert: true }
            ),
            db.collection('transactions').replaceOne(
                { _id: orphanTransactionId },
                {
                    _id: orphanTransactionId,
                    userId,
                    type: 'expense',
                    amount: 9_000,
                    currency: 'ARS',
                    date: transactionDate,
                    description: fixture.orphanDescription,
                    categoryId: category._id,
                    sourceAccountId: account._id,
                    status: 'confirmed',
                    createdFrom: 'system',
                    spaceId,
                    spaceEntryId: orphanEntryId,
                    spaceNameSnapshot: fixture.spaceName,
                    tags: ['e2e-space-impact-orphan'],
                    ...timestamps,
                },
                { upsert: true }
            ),
            db.collection('spaceentrypersonalimpacts').replaceOne(
                { _id: new mongoose.Types.ObjectId(fixture.normalImpactId) },
                {
                    _id: new mongoose.Types.ObjectId(fixture.normalImpactId),
                    spaceId,
                    entryId: normalEntryId,
                    userId,
                    participantId,
                    transactionId: normalTransactionId,
                    accountId: account._id,
                    categoryId: category._id,
                    impactKind: 'payer_full_amount',
                    amount: 7_000,
                    currency: 'ARS',
                    status: 'linked',
                    resolvedAt: now,
                    ...timestamps,
                },
                { upsert: true }
            ),
        ])
    }
}

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

async function seedP2RecurringCandidate(userId: mongoose.Types.ObjectId) {
    const db = mongoose.connection.db
    if (!db) throw new Error('MongoDB no está conectado para sembrar P2.')

    const [account, category] = await Promise.all([
        Account.findOne({ userId, name: P2_HISTORY_ACCOUNT_NAME }),
        Category.findOne({
            userId,
            type: 'expense',
            name: 'Servicios',
            isArchived: false,
        }),
    ])
    if (!account || !category) {
        throw new Error('No se pudo resolver cuenta o categoría para el candidato P2.')
    }

    const now = new Date()
    const transactions = db.collection('transactions')
    const rows = Array.from({ length: 4 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 3 + index, 12, 12)
        return {
            _id: new mongoose.Types.ObjectId(
                `72${String(index + 1).padStart(22, '0')}`
            ),
            userId,
            type: 'expense',
            amount: 16_000,
            currency: 'ARS',
            date,
            description: P2_CANDIDATE_DESCRIPTION,
            categoryId: category._id,
            sourceAccountId: account._id,
            status: 'confirmed',
            createdFrom: 'system',
            tags: ['e2e-p2-recurring-candidate'],
            createdAt: date,
            updatedAt: date,
        }
    })

    await Promise.all(rows.map((row) =>
        transactions.replaceOne({ _id: row._id }, row, { upsert: true })
    ))
    await Promise.all([
        FunctionalSuggestionDismissal.deleteMany({
            userId,
            subjectKey: P2_CANDIDATE_SUBJECT_KEY,
        }),
        ScheduledCommitment.deleteMany({
            userId,
            description: P2_CANDIDATE_DESCRIPTION,
        }),
    ])
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

async function seedProjectionSmokeData(email: string, password: string) {
    const { user, created } = await ensureTestUser(
        deriveProjectionSmokeEmail(email),
        password,
        PROJECTION_SMOKE_USER_NAME
    )
    user.set('preferences.monthStartDay', 1)
    user.set('preferences.consolidatedCurrency', 'ARS')
    user.set('preferences.operationalStartDate', undefined)
    user.set('preferences.projectionGrouping', 'type')
    user.set('preferences.projectionMode', 'monthly')
    user.set('preferences.projectionMonths', 6)
    user.set('preferences.projectionChartCurrency', 'ARS')
    await user.save()

    await ensureDefaultCategories(user._id)
    const expenseCategory = await Category.findOne({
        userId: user._id,
        type: 'expense',
        isArchived: false,
    })
    if (!expenseCategory) throw new Error('No se pudo resolver la categoria para Proyeccion E2E.')

    const db = mongoose.connection.db
    if (!db) throw new Error('No se pudo obtener la base E2E para Proyeccion.')

    await Promise.all([
        db.collection('transactions').deleteMany({ userId: user._id }),
        db.collection('installmentplans').deleteMany({ userId: user._id }),
        db.collection('scheduledcommitments').deleteMany({ userId: user._id }),
        db.collection('commitmentapplications').deleteMany({ userId: user._id }),
    ])

    const id = (value: string) => new mongoose.Types.ObjectId(value)
    const ids = Object.fromEntries(
        Object.entries(PROJECTION_SMOKE_IDS).map(([key, value]) => [key, id(value)])
    ) as Record<keyof typeof PROJECTION_SMOKE_IDS, mongoose.Types.ObjectId>
    const { current, dates } = buildProjectionSmokePeriod()
    const now = new Date()
    const timestamps = { createdAt: now, updatedAt: now }

    await Promise.all([
        db.collection('accounts').replaceOne(
            { _id: ids.bankAccount },
            {
                _id: ids.bankAccount,
                userId: user._id,
                name: PROJECTION_SMOKE_NAMES.bankAccount,
                type: 'bank',
                currency: 'ARS',
                supportedCurrencies: ['ARS'],
                initialBalance: 0,
                initialBalances: { ARS: 0, USD: 0 },
                color: '#0EA5E9',
                isActive: true,
                includeInNetWorth: true,
                allowNegativeBalance: false,
                ...timestamps,
            },
            { upsert: true }
        ),
        db.collection('accounts').replaceOne(
            { _id: ids.creditCard },
            {
                _id: ids.creditCard,
                userId: user._id,
                name: PROJECTION_SMOKE_NAMES.creditCard,
                type: 'credit_card',
                currency: 'ARS',
                supportedCurrencies: ['ARS', 'USD'],
                initialBalance: 0,
                initialBalances: { ARS: 0, USD: 0 },
                color: '#6366F1',
                isActive: true,
                includeInNetWorth: false,
                allowNegativeBalance: true,
                creditCardConfig: { closingDay: 20, dueDay: 5, creditLimit: 1_000_000 },
                ...timestamps,
            },
            { upsert: true }
        ),
    ])

    const plans = db.collection('installmentplans')
    await Promise.all([
        plans.replaceOne(
            { _id: ids.singlePlan },
            {
                _id: ids.singlePlan,
                userId: user._id,
                accountId: ids.creditCard,
                categoryId: expenseCategory._id,
                description: PROJECTION_SMOKE_NAMES.singlePlan,
                currency: 'ARS',
                totalAmount: 120_000,
                installmentCount: 1,
                installmentAmount: 120_000,
                purchaseDate: dates.singlePurchase,
                firstClosingMonth: current,
                ...timestamps,
            },
            { upsert: true }
        ),
        plans.replaceOne(
            { _id: ids.installmentPlan },
            {
                _id: ids.installmentPlan,
                userId: user._id,
                accountId: ids.creditCard,
                categoryId: expenseCategory._id,
                description: PROJECTION_SMOKE_NAMES.installmentPlan,
                currency: 'USD',
                totalAmount: 90,
                installmentCount: 3,
                installmentAmount: 30,
                purchaseDate: dates.installmentPurchase,
                firstClosingMonth: current,
                ...timestamps,
            },
            { upsert: true }
        ),
    ])

    const transactionBase = {
        userId: user._id,
        type: 'credit_card_expense',
        categoryId: expenseCategory._id,
        sourceAccountId: ids.creditCard,
        status: 'confirmed',
        createdFrom: 'system',
        ...timestamps,
    }
    const transactions = db.collection('transactions')
    await Promise.all([
        transactions.replaceOne(
            { _id: ids.singleParent },
            {
                _id: ids.singleParent,
                ...transactionBase,
                amount: 120_000,
                currency: 'ARS',
                date: dates.singlePurchase,
                description: PROJECTION_SMOKE_NAMES.singlePlan,
                installmentPlanId: ids.singlePlan,
            },
            { upsert: true }
        ),
        transactions.replaceOne(
            { _id: ids.installmentParent },
            {
                _id: ids.installmentParent,
                ...transactionBase,
                amount: 90,
                currency: 'USD',
                date: dates.installmentPurchase,
                description: PROJECTION_SMOKE_NAMES.installmentPlan,
                installmentPlanId: ids.installmentPlan,
            },
            { upsert: true }
        ),
        transactions.replaceOne(
            { _id: ids.historicalSingle },
            {
                _id: ids.historicalSingle,
                ...transactionBase,
                amount: 15,
                currency: 'USD',
                date: dates.historicalSingle,
                description: PROJECTION_SMOKE_NAMES.historicalSingle,
            },
            { upsert: true }
        ),
    ])

    await db.collection('scheduledcommitments').replaceOne(
        { _id: ids.commitment },
        {
            _id: ids.commitment,
            userId: user._id,
            description: PROJECTION_SMOKE_NAMES.commitment,
            amount: 70_000,
            currency: 'ARS',
            categoryId: expenseCategory._id,
            accountId: ids.bankAccount,
            recurrence: 'monthly',
            dayOfMonth: 10,
            applyMode: 'manual',
            isActive: true,
            lifecycleStatus: 'active',
            startDate: dates.commitmentStart,
            amountPolicy: 'fixed',
            amountSchedule: [],
            estimationMode: 'template',
            aliases: [],
            createdFrom: 'system',
            ...timestamps,
        },
        { upsert: true }
    )

    return { created, current }
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
        await resetGeneralE2EFinancialData(user._id)
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
        const p2HistoryCreated = await ensureAccount(user._id, P2_HISTORY_ACCOUNT_NAME, {
            type: 'cash',
            currency: 'ARS',
            supportedCurrencies: ['ARS'],
            defaultPaymentMethods: ['cash'],
            initialBalance: 100_000,
            initialBalances: { ARS: 100_000, USD: 0 },
            color: '#14B8A6',
            isActive: true,
            includeInNetWorth: false,
            allowNegativeBalance: false,
        })
        await seedP2RecurringCandidate(user._id)
        await seedSpaceImpactFixtures(user._id)
        const financialSmoke = await seedFinancialSmokeData(
            TEST_USER_EMAIL,
            TEST_USER_PASSWORD
        )
        const projectionSmoke = await seedProjectionSmokeData(
            TEST_USER_EMAIL,
            TEST_USER_PASSWORD
        )

        console.log('✅ Seed E2E verificado:')
        console.log(`   Usuario: ${userCreated ? 'creado' : 'actualizado'}`)
        console.log(
            `   Categorías: ${categories.created} creadas, ${categories.updated} actualizadas`
        )
        console.log(
            `   Cuentas base: ${Number(cashCreated) + Number(cardCreated) + Number(p2HistoryCreated)} creadas`
        )
        console.log('   P2: candidato mensual explicable verificado')
        console.log('   Espacios: impactos normal y huerfano preparados para desktop/mobile')
        console.log(
            `   Smoke financiero: usuario ${financialSmoke.created ? 'creado' : 'actualizado'}, ` +
            `períodos ${financialSmoke.historical} y ${financialSmoke.current}`
        )
        console.log(
            `   Proyección: usuario ${projectionSmoke.created ? 'creado' : 'actualizado'}, ` +
            `período ${projectionSmoke.current}`
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
