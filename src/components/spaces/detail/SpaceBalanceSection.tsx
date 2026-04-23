'use client'

import { ArrowRightLeft, Users } from 'lucide-react'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceInviteStatusBadge, SpaceRoleBadge, SpaceSectionHeading, SpaceSurface, SpaceTonePill } from '@/components/spaces/SpaceUi'
import type { Currency } from '@/lib/constants'
import type { SpaceBalanceItem } from '@/types'

function buildBalanceHeadline(balances: SpaceBalanceItem[], currentUserId: string) {
    const creditors = balances.filter((item) => item.balanceReporting > 0)
    const debtors = balances.filter((item) => item.balanceReporting < 0)
    const current = balances.find((item) => item.userId === currentUserId)

    if (current && current.balanceReporting > 0 && debtors.length > 0) {
        const debtor = debtors[0]
        return {
            title: `${debtor.displayName} te debe`,
            amount: Math.min(current.balanceReporting, Math.abs(debtor.balanceReporting)),
            positive: true,
        }
    }

    if (current && current.balanceReporting < 0 && creditors.length > 0) {
        const creditor = creditors[0]
        return {
            title: `Le debés a ${creditor.displayName}`,
            amount: Math.min(Math.abs(current.balanceReporting), creditor.balanceReporting),
            positive: false,
        }
    }

    if (creditors.length > 0 && debtors.length > 0) {
        return {
            title: `${debtors[0].displayName} debería saldar con ${creditors[0].displayName}`,
            amount: Math.min(creditors[0].balanceReporting, Math.abs(debtors[0].balanceReporting)),
            positive: true,
        }
    }

    return null
}

export function SpaceBalanceSection({
    balances,
    currency,
    hidden,
    currentUserId,
}: {
    balances: SpaceBalanceItem[]
    currency: Currency
    hidden: boolean
    currentUserId: string
}) {
    const headline = buildBalanceHeadline(balances, currentUserId)

    return (
        <SpaceSurface accent="var(--chart-2)">
            <SpaceSectionHeading
                eyebrow="Balance"
                title="Entre participantes"
                description="Quién adelantó de más, a quién le corresponde recuperar saldo y qué relación neta hoy domina el espacio."
            />

            {headline ? (
                <div className="mt-6 rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4 md:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                Saldo neto destacado
                            </div>
                            <p className="text-lg font-semibold tracking-tight">{headline.title}</p>
                        </div>

                        <SpaceTonePill positive={headline.positive}>
                            <SpaceAmountInline
                                amount={headline.amount}
                                currency={currency}
                                hidden={hidden}
                                className="font-semibold"
                            />
                        </SpaceTonePill>
                    </div>
                </div>
            ) : null}

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
                {balances.length > 0 ? (
                    balances.map((balance) => {
                        const isCurrent = balance.userId === currentUserId
                        const positive = balance.balanceReporting >= 0

                        return (
                            <div
                                key={balance.participantId}
                                className="rounded-[28px] border border-foreground/[0.07] bg-background/72 p-4 backdrop-blur-sm"
                                style={{
                                    background: isCurrent
                                        ? 'linear-gradient(180deg, color-mix(in srgb, var(--chart-1) 10%, transparent) 0%, color-mix(in srgb, var(--background) 88%, transparent) 100%)'
                                        : undefined,
                                }}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <SpaceInitialsAvatar name={balance.displayName} className="h-10 w-10" />
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-foreground">{balance.displayName}</p>
                                                {isCurrent ? (
                                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                                        Vos
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <SpaceRoleBadge role={balance.role} />
                                                <SpaceInviteStatusBadge status={balance.inviteStatus} />
                                            </div>
                                        </div>
                                    </div>

                                    <SpaceTonePill positive={positive}>
                                        {positive ? 'A favor' : 'Debe'}
                                    </SpaceTonePill>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Pagó</p>
                                        <SpaceAmountInline
                                            amount={balance.paidReporting}
                                            currency={currency}
                                            hidden={hidden}
                                            className="mt-1 text-base font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Le corresponde</p>
                                        <SpaceAmountInline
                                            amount={balance.shareReporting}
                                            currency={currency}
                                            hidden={hidden}
                                            className="mt-1 text-base font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Diferencia</p>
                                        <SpaceAmountInline
                                            amount={Math.abs(balance.balanceReporting)}
                                            currency={currency}
                                            hidden={hidden}
                                            color={positive ? 'var(--chart-3)' : 'var(--destructive)'}
                                            className="mt-1 text-base font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="rounded-[26px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground lg:col-span-2">
                        <div className="mb-3 flex justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                        Todavía no hay participantes con saldo para mostrar.
                    </div>
                )}
            </div>
        </SpaceSurface>
    )
}
