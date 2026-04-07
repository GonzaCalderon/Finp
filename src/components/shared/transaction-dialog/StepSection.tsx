import type { ReactNode } from 'react'

export function StepSection({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="mx-auto w-full max-w-3xl space-y-5 sm:min-h-[480px]">
            <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{title}</h2>
                    <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    )
}
