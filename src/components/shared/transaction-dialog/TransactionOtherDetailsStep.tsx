import { motion } from 'framer-motion'
import { staggerContainer } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { StepSection } from './StepSection'
import { IncomeFlow } from './flows/IncomeFlow'
import { TransferFlow } from './flows/TransferFlow'
import { ExchangeFlow } from './flows/ExchangeFlow'
import { CreditCardPaymentFlow } from './flows/CreditCardPaymentFlow'
import { AdjustmentFlow } from './flows/AdjustmentFlow'

type PaymentSummaryItem = { due: number; paid: number; pending: number; currency: string }
type PaymentSummaryByCurrency = Partial<Record<string, PaymentSummaryItem>>
type CardPaymentMode = 'full' | 'partial'
type CardPaymentSelection = 'ars' | 'usd' | 'ars_usd'

interface PaymentSummaryData {
    currency: string
    due: number
    paid: number
    pending: number
    byCurrency?: PaymentSummaryByCurrency
}

interface TransactionOtherDetailsStepProps {
    type: TransactionFormInput['type']
    showSource: boolean
    showDestination: boolean
    sourceAccountId: string | undefined
    destinationAccountId: string | undefined
    suggestedAccounts: IAccount[]
    destinationAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    destinationAccountIdError: string | undefined
    hasCrossCurrencyTransferConflict: boolean
    description: string
    descriptionError: string | undefined
    appliedRuleName: string | null
    hasCategoryRules: boolean
    // exchange
    exchangeDestinationAmount: number
    exchangeDestinationCurrency: TransactionFormInput['currency']
    exchangeRate: number
    currency: TransactionFormInput['currency']
    destinationAmountError: string | undefined
    exchangeRateError: string | undefined
    // card payment
    paymentSummary: PaymentSummaryData | null
    allowCardPaymentFullMode: boolean
    canUseDualCardPayment: boolean
    secondaryCardPaymentCurrency: TransactionFormInput['currency'] | undefined
    additionalCardPaymentEnabled: boolean
    secondaryCardPaymentAmount: number
    cardPaymentMode: CardPaymentMode
    cardPaymentSelection: CardPaymentSelection
    isEditing: boolean
    amount: number
    date: Date | undefined
    isDatePopoverOpen: boolean
    amountError: string | undefined
    dateError: string | undefined
    exchangeConfigurationError: string | null
    canSwapExchangeDirection: boolean
    showErrors: boolean
    transferSourceLabel: string | undefined
    transferDestinationLabel: string | undefined
    transferBalanceCurrency: TransactionFormInput['currency'] | undefined
    transferSourceBalance: number | null
    transferDestinationBalance: number | null
    transferSourceResultingBalance: number | null
    transferDestinationResultingBalance: number | null
    transferBalanceError: string | null
    allowedCurrencies: TransactionFormInput['currency'][]
    adjustmentSign: '+' | '-'
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    // callbacks
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onDescriptionChange: (value: string) => void
    onCardPaymentModeChange: (mode: CardPaymentMode) => void
    onCardPaymentSelectionChange: (selection: CardPaymentSelection) => void
    onPartialCardPaymentAmountChange: (currency: TransactionFormInput['currency'], amount: number) => void
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onSwitchToExchange: () => void
    onDestinationAmountChange: (amount: number) => void
    onExchangeRateChange: (rate: number) => void
    onSwapExchangeDirection: () => void
    onAdjustmentSignChange: (sign: '+' | '-') => void
}

export function TransactionOtherDetailsStep(props: TransactionOtherDetailsStepProps) {
    const { type } = props

    return (
        <StepSection>
            <motion.div
                className="space-y-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {type === 'income' && (
                    <IncomeFlow
                        destinationAccountId={props.destinationAccountId}
                        destinationAccounts={props.destinationAccounts}
                        destinationAccountIdError={props.destinationAccountIdError}
                        date={props.date}
                        dateError={props.dateError}
                        isDatePopoverOpen={props.isDatePopoverOpen}
                        amount={props.amount}
                        amountError={props.amountError}
                        currency={props.currency}
                        allowedCurrencies={props.allowedCurrencies}
                        description={props.description}
                        descriptionError={props.descriptionError}
                        appliedRuleName={props.appliedRuleName}
                        hasCategoryRules={props.hasCategoryRules}
                        isEditing={props.isEditing}
                        showErrors={props.showErrors}
                        fmtCurrency={props.fmtCurrency}
                        onDestinationAccountChange={props.onDestinationAccountChange}
                        onDateChange={props.onDateChange}
                        onDatePopoverOpenChange={props.onDatePopoverOpenChange}
                        onAmountChange={props.onAmountChange}
                        onCurrencyChange={props.onCurrencyChange}
                        onDescriptionChange={props.onDescriptionChange}
                    />
                )}

                {type === 'transfer' && (
                    <TransferFlow
                        sourceAccountId={props.sourceAccountId}
                        destinationAccountId={props.destinationAccountId}
                        suggestedAccounts={props.suggestedAccounts}
                        destinationAccounts={props.destinationAccounts}
                        sourceAccountIdError={props.sourceAccountIdError}
                        destinationAccountIdError={props.destinationAccountIdError}
                        hasCrossCurrencyTransferConflict={props.hasCrossCurrencyTransferConflict}
                        date={props.date}
                        dateError={props.dateError}
                        isDatePopoverOpen={props.isDatePopoverOpen}
                        amount={props.amount}
                        amountError={props.amountError}
                        currency={props.currency}
                        allowedCurrencies={props.allowedCurrencies}
                        transferSourceLabel={props.transferSourceLabel}
                        transferDestinationLabel={props.transferDestinationLabel}
                        transferBalanceCurrency={props.transferBalanceCurrency}
                        transferSourceBalance={props.transferSourceBalance}
                        transferDestinationBalance={props.transferDestinationBalance}
                        transferSourceResultingBalance={props.transferSourceResultingBalance}
                        transferDestinationResultingBalance={props.transferDestinationResultingBalance}
                        transferBalanceError={props.transferBalanceError}
                        isEditing={props.isEditing}
                        showErrors={props.showErrors}
                        fmtCurrency={props.fmtCurrency}
                        onSourceAccountChange={props.onSourceAccountChange}
                        onDestinationAccountChange={props.onDestinationAccountChange}
                        onDateChange={props.onDateChange}
                        onDatePopoverOpenChange={props.onDatePopoverOpenChange}
                        onAmountChange={props.onAmountChange}
                        onCurrencyChange={props.onCurrencyChange}
                        onSwitchToExchange={props.onSwitchToExchange}
                    />
                )}

                {type === 'exchange' && (
                    <ExchangeFlow
                        sourceAccountId={props.sourceAccountId}
                        destinationAccountId={props.destinationAccountId}
                        suggestedAccounts={props.suggestedAccounts}
                        destinationAccounts={props.destinationAccounts}
                        sourceAccountIdError={props.sourceAccountIdError}
                        destinationAccountIdError={props.destinationAccountIdError}
                        date={props.date}
                        dateError={props.dateError}
                        isDatePopoverOpen={props.isDatePopoverOpen}
                        amount={props.amount}
                        amountError={props.amountError}
                        currency={props.currency}
                        exchangeDestinationAmount={props.exchangeDestinationAmount}
                        exchangeDestinationCurrency={props.exchangeDestinationCurrency}
                        exchangeRate={props.exchangeRate}
                        exchangeRateError={props.exchangeRateError}
                        destinationAmountError={props.destinationAmountError}
                        exchangeConfigurationError={props.exchangeConfigurationError}
                        canSwapExchangeDirection={props.canSwapExchangeDirection}
                        showErrors={props.showErrors}
                        fmtCurrency={props.fmtCurrency}
                        onSourceAccountChange={props.onSourceAccountChange}
                        onDestinationAccountChange={props.onDestinationAccountChange}
                        onDateChange={props.onDateChange}
                        onDatePopoverOpenChange={props.onDatePopoverOpenChange}
                        onAmountChange={props.onAmountChange}
                        onDestinationAmountChange={props.onDestinationAmountChange}
                        onExchangeRateChange={props.onExchangeRateChange}
                        onSwapExchangeDirection={props.onSwapExchangeDirection}
                    />
                )}

                {type === 'credit_card_payment' && (
                    <CreditCardPaymentFlow
                        sourceAccountId={props.sourceAccountId}
                        destinationAccountId={props.destinationAccountId}
                        suggestedAccounts={props.suggestedAccounts}
                        destinationAccounts={props.destinationAccounts}
                        sourceAccountIdError={props.sourceAccountIdError}
                        destinationAccountIdError={props.destinationAccountIdError}
                        date={props.date}
                        dateError={props.dateError}
                        isDatePopoverOpen={props.isDatePopoverOpen}
                        amount={props.amount}
                        amountError={props.amountError}
                        currency={props.currency}
                        allowedCurrencies={props.allowedCurrencies}
                        paymentSummary={props.paymentSummary}
                        allowCardPaymentFullMode={props.allowCardPaymentFullMode}
                        canUseDualCardPayment={props.canUseDualCardPayment}
                        secondaryCardPaymentCurrency={props.secondaryCardPaymentCurrency}
                        additionalCardPaymentEnabled={props.additionalCardPaymentEnabled}
                        secondaryCardPaymentAmount={props.secondaryCardPaymentAmount}
                        cardPaymentMode={props.cardPaymentMode}
                        cardPaymentSelection={props.cardPaymentSelection}
                        showErrors={props.showErrors}
                        fmtCurrency={props.fmtCurrency}
                        onSourceAccountChange={props.onSourceAccountChange}
                        onDestinationAccountChange={props.onDestinationAccountChange}
                        onDateChange={props.onDateChange}
                        onDatePopoverOpenChange={props.onDatePopoverOpenChange}
                        onAmountChange={props.onAmountChange}
                        onCurrencyChange={props.onCurrencyChange}
                        onCardPaymentModeChange={props.onCardPaymentModeChange}
                        onCardPaymentSelectionChange={props.onCardPaymentSelectionChange}
                        onPartialCardPaymentAmountChange={props.onPartialCardPaymentAmountChange}
                    />
                )}

                {type === 'adjustment' && (
                    <AdjustmentFlow
                        sourceAccountId={props.sourceAccountId}
                        suggestedAccounts={props.suggestedAccounts}
                        sourceAccountIdError={props.sourceAccountIdError}
                        date={props.date}
                        dateError={props.dateError}
                        isDatePopoverOpen={props.isDatePopoverOpen}
                        amount={props.amount}
                        amountError={props.amountError}
                        currency={props.currency}
                        allowedCurrencies={props.allowedCurrencies}
                        adjustmentSign={props.adjustmentSign}
                        showErrors={props.showErrors}
                        fmtCurrency={props.fmtCurrency}
                        onSourceAccountChange={props.onSourceAccountChange}
                        onDateChange={props.onDateChange}
                        onDatePopoverOpenChange={props.onDatePopoverOpenChange}
                        onAmountChange={props.onAmountChange}
                        onCurrencyChange={props.onCurrencyChange}
                        onAdjustmentSignChange={props.onAdjustmentSignChange}
                    />
                )}
            </motion.div>
        </StepSection>
    )
}
