'use client'

import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SpaceInitialsAvatar } from '@/components/spaces/SpaceUi'
import {
    SpaceDialogField,
    SpaceDialogPanel,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceCategory, ISpaceParticipant, SpaceQuoteDto } from '@/types'

/**
 * Paso «Datos»: monto, moneda, fecha, descripción, pagador y categoría del
 * Espacio. Es lo mínimo que el reparto necesita para existir.
 *
 * El nombre accesible de cada control es su `label` asociado por `htmlFor`; no
 * se agrega `aria-labelledby` que apunte al propio control, porque eso mete el
 * valor elegido dentro del nombre (`espacios.md` §11).
 */
export function SpaceEntryDataStep({
    amount,
    currency,
    date,
    title,
    paidByParticipantId,
    spaceCategoryId,
    exchangeRate,
    reportingCurrency,
    spaceCurrencies,
    payerParticipants,
    spaceCategories,
    datePickerOpen,
    fieldErrors,
    activeQuote,
    automaticQuoteSelected,
    onAmountChange,
    onCurrencyChange,
    onDateChange,
    onDatePickerOpenChange,
    onTitleChange,
    onPaidByChange,
    onSpaceCategoryChange,
    onExchangeRateChange,
}: {
    amount: number
    currency: string
    date: Date | undefined
    title: string
    paidByParticipantId?: string
    spaceCategoryId?: string
    exchangeRate?: number
    reportingCurrency: string
    spaceCurrencies: string[]
    payerParticipants: ISpaceParticipant[]
    spaceCategories: ISpaceCategory[]
    datePickerOpen: boolean
    fieldErrors: Record<string, string>
    activeQuote?: SpaceQuoteDto
    automaticQuoteSelected: boolean
    onAmountChange: (value: number) => void
    onCurrencyChange: (currency: string) => void
    onDateChange: (date: Date) => void
    onDatePickerOpenChange: (open: boolean) => void
    onTitleChange: (value: string) => void
    onPaidByChange: (participantId: string) => void
    onSpaceCategoryChange: (categoryId: string | undefined) => void
    onExchangeRateChange: (rate: number | undefined) => void
}) {
    return (
        <SpaceDialogPanel>
            <div className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.55fr_0.7fr]">
                    <FormattedAmountInput
                        id="entry-amount"
                        label="Monto"
                        value={amount || undefined}
                        currency={currency}
                        error={fieldErrors.amount}
                        labelClassName="text-sm font-medium text-foreground"
                        onValueChangeAction={onAmountChange}
                    />

                    <CurrencySelector
                        value={currency}
                        options={spaceCurrencies}
                        onValueChange={onCurrencyChange}
                        error={fieldErrors.currency}
                    />

                    <DatePickerField
                        label="Fecha"
                        value={date}
                        isOpen={datePickerOpen}
                        onOpenChange={onDatePickerOpenChange}
                        onChange={(next) => {
                            if (next) onDateChange(next)
                        }}
                        error={fieldErrors.date}
                        showErrors={Boolean(fieldErrors.date)}
                    />
                </div>

                <SpaceDialogField id="entry-title" label="Descripción" error={fieldErrors.title}>
                    <Input
                        id="entry-title"
                        value={title}
                        onChange={(event) => onTitleChange(event.target.value)}
                        placeholder="Ej. Almuerzo equipo en Santiago"
                        className={fieldErrors.title ? 'border-destructive focus-visible:ring-destructive/25' : ''}
                    />
                </SpaceDialogField>

                <div className="grid gap-4 lg:grid-cols-2">
                    <SpaceDialogField id="entry-paid-by" label="Pagó" error={fieldErrors.paidByParticipantId}>
                        <Select value={paidByParticipantId} onValueChange={onPaidByChange}>
                            <SelectTrigger id="entry-paid-by" className="w-full">
                                <SelectValue placeholder="Elegí un participante" />
                            </SelectTrigger>
                            <SelectContent>
                                {payerParticipants.map((participant) => (
                                    <SelectItem
                                        key={extractId(participant._id)}
                                        value={extractId(participant._id) ?? ''}
                                    >
                                        <span className="flex items-center gap-2">
                                            <SpaceInitialsAvatar
                                                name={participant.displayName}
                                                className="h-6 w-6 text-[10px]"
                                            />
                                            <span>
                                                {participant.displayName}
                                                {!participant.isActive ? ' · inactivo' : ''}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SpaceDialogField>

                    <SpaceDialogField id="entry-space-category" label="Categoría del espacio">
                        <Select
                            value={spaceCategoryId ?? 'none'}
                            onValueChange={(value) => onSpaceCategoryChange(value === 'none' ? undefined : value)}
                        >
                            <SelectTrigger id="entry-space-category" className="w-full">
                                <SelectValue placeholder="Sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin categoría</SelectItem>
                                {spaceCategories.map((category) => (
                                    <SelectItem
                                        key={extractId(category._id)}
                                        value={extractId(category._id) ?? ''}
                                    >
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SpaceDialogField>
                </div>

                {currency !== reportingCurrency ? (
                    <>
                        <FormattedAmountInput
                            id="space-exchange-rate"
                            label={`Cotización a ${reportingCurrency}`}
                            value={exchangeRate}
                            currency={reportingCurrency}
                            helperText="Necesaria para reflejar el movimiento correctamente en la moneda de reporte."
                            error={fieldErrors.exchangeRate}
                            placeholder={`Valor de 1 ${currency}`}
                            onValueChangeAction={(rate) => onExchangeRateChange(rate || undefined)}
                        />
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                            {automaticQuoteSelected && activeQuote
                                ? `Referencia automática · ${activeQuote.source === 'dolarapi_official' ? 'DolarAPI oficial' : 'Frankfurter'} · ${activeQuote.status === 'current' ? 'actualizada' : 'desactualizada'}`
                                : 'Cotización manual: Finp guardará este valor, su autor y el momento de confirmación.'}
                        </p>
                    </>
                ) : null}
            </div>
        </SpaceDialogPanel>
    )
}
