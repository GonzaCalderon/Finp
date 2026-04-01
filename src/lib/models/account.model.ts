import mongoose, { Schema } from 'mongoose'
import type { IAccount } from '@/types'
import { ACCOUNT_TYPES, CURRENCIES } from '@/lib/constants'
import { normalizeDefaultPaymentMethods, normalizeSupportedCurrencies } from '@/lib/utils/accounts'

const AccountSchema = new Schema<IAccount>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: Object.values(ACCOUNT_TYPES), required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        supportedCurrencies: [{ type: String, enum: Object.values(CURRENCIES) }],
        defaultPaymentMethods: [{ type: String, enum: ['cash', 'debit', 'credit_card'] }],
        institution: { type: String },
        description: { type: String },
        color: { type: String },
        isActive: { type: Boolean, default: true },
        includeInNetWorth: { type: Boolean, default: true },
        initialBalance: { type: Number, default: 0 },
        initialBalances: {
            ARS: { type: Number, default: 0 },
            USD: { type: Number, default: 0 },
        },
        allowNegativeBalance: { type: Boolean, default: true },
        creditCardConfig: {
            closingDay: { type: Number },
            dueDay: { type: Number },
            creditLimit: { type: Number },
        },
        debtConfig: {
            creditorName: { type: String },
            originalAmount: { type: Number },
        },
    },
    { timestamps: true }
)

AccountSchema.pre('validate', function applyCurrencyCapabilities(next) {
    this.supportedCurrencies = normalizeSupportedCurrencies(this.supportedCurrencies, this.currency, this.type)
    this.defaultPaymentMethods = normalizeDefaultPaymentMethods(this.defaultPaymentMethods, this.type)
    this.currency = this.supportedCurrencies[0] ?? this.currency ?? 'ARS'
    if (!this.initialBalances) {
        this.initialBalances = { ARS: 0, USD: 0 }
    }
    const primaryCurrency = this.supportedCurrencies[0] ?? 'ARS'
    if ((this.initialBalance ?? 0) !== 0 && !(this.initialBalances as Record<string, number | undefined>)?.[primaryCurrency]) {
        ;(this.initialBalances as Record<string, number | undefined>)[primaryCurrency] = this.initialBalance ?? 0
    }
    this.initialBalance = (this.initialBalances as Record<string, number | undefined>)?.[primaryCurrency] ?? 0
    next()
})

AccountSchema.index({ userId: 1, isActive: 1 })
AccountSchema.index({ userId: 1, type: 1 })

export const Account = mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema)
