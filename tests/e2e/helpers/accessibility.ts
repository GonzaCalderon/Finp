import { AxeBuilder } from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Helper de accesibilidad para los recorridos de Espacios
 * (docs/decisiones/0014-axe-core-playwright-en-recorridos-de-espacios.md).
 *
 * Complementa, no reemplaza, las aserciones dirigidas: axe no ve foco en el
 * primer error, anuncio del paso, orden real de tabulación ni `safe area`.
 * Sólo detecta lo que nadie pensó en afirmar — nombre accesible ausente,
 * `aria-*` inválido, contraste — sobre el DOM real ya renderizado por
 * Playwright, iguales reglas que usan las extensiones de navegador de axe.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

/** Reglas excluidas con el motivo documentado; nunca inline en un spec. */
const EXCLUDED_RULES: { id: string; reason: string }[] = []

const FAILING_IMPACTS = new Set(['serious', 'critical'])

/**
 * Corre axe sobre la página actual y falla el test ante una violación de
 * impacto `serious` o `critical`. Las de impacto `moderate` o `minor` se
 * adjuntan como evidencia del test sin bloquear la corrida.
 */
export async function assertAccessibleSurface(
    page: Page,
    testInfo: TestInfo,
    name: string
) {
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .disableRules(EXCLUDED_RULES.map((rule) => rule.id))
        .analyze()

    const blocking = results.violations.filter((violation) =>
        FAILING_IMPACTS.has(violation.impact ?? 'minor')
    )
    const reportable = results.violations.filter(
        (violation) => !FAILING_IMPACTS.has(violation.impact ?? 'minor')
    )

    if (reportable.length > 0) {
        await testInfo.attach(`${testInfo.project.name}-${name}-a11y-moderate`, {
            body: JSON.stringify(reportable, null, 2),
            contentType: 'application/json',
        })
    }

    if (blocking.length > 0) {
        await testInfo.attach(`${testInfo.project.name}-${name}-a11y-violations`, {
            body: JSON.stringify(blocking, null, 2),
            contentType: 'application/json',
        })
    }

    expect(
        blocking,
        blocking
            .map((violation) =>
                `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} nodo(s)`
            )
            .join('\n')
    ).toEqual([])
}
