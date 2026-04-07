import type { ReactNode } from 'react'

export function StepSection({
    children,
}: {
    eyebrow?: string
    title?: string
    subtitle?: string
    children: ReactNode
}) {
    return (
        <section className="mx-auto flex w-full max-w-[68rem] flex-col justify-center">
            {children}
        </section>
    )
}
