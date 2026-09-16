/**
 * Contrato de pasos del alta guiada de un movimiento de Espacio
 * (`espacios.md` §10 «Nuevo gasto» y §11).
 *
 * El diálogo monta un solo paso por vez: los anteriores no quedan ocultos en el
 * DOM. Este archivo concentra qué pasos existen, en qué orden y cómo se
 * traducen al número que el borrador persiste, para que el contenedor no
 * decida nada de eso inline.
 */

import type { SpaceFormData } from '@/lib/validations'

export type SpaceEntryStepId = 'data' | 'split' | 'extras' | 'review'

export type SpaceEntryStep = {
    id: SpaceEntryStepId
    /** Nombre corto del paso, el que ve el usuario en el stepper. */
    label: string
    /** Encabezado del paso dentro del cuerpo; recibe el foco al cambiar. */
    title: string
    /** Qué decide este paso, en una línea. */
    description: string
}

/**
 * Número de paso que persiste el borrador. Es canónico y no depende de cuántos
 * pasos tenga el Espacio: un Espacio `solo` no tiene reparto, pero `extras`
 * sigue siendo 3. Así el borrador guardado no cambia de significado si el modo
 * del Espacio cambia entre sesiones.
 */
export const SPACE_ENTRY_STEP_NUMBER: Record<SpaceEntryStepId, 1 | 2 | 3 | 4> = {
    data: 1,
    split: 2,
    extras: 3,
    review: 4,
}

const ALL_STEPS: Record<SpaceEntryStepId, SpaceEntryStep> = {
    data: {
        id: 'data',
        label: 'Datos',
        title: 'Qué gasto registrás',
        description: 'Monto, moneda, fecha y quién lo pagó.',
    },
    split: {
        id: 'split',
        label: 'Reparto',
        title: 'Quiénes participan',
        description: 'Elegí a quiénes alcanza el gasto y cómo se divide.',
    },
    extras: {
        id: 'extras',
        label: 'Extras',
        title: 'Comprobantes y tu Finp',
        description: 'Adjuntos, notas y qué efecto tiene en tu Finp personal.',
    },
    review: {
        id: 'review',
        label: 'Revisión',
        title: 'Qué cambia al confirmar',
        description: 'Revisá el monto exacto, el reparto y el impacto antes de guardar.',
    },
}

/**
 * Un Espacio `solo` no reparte nada: sin este filtro el paso «Reparto» se monta
 * vacío y pide «Continuar» sobre una pantalla en blanco.
 */
export function buildSpaceEntrySteps(spaceMode: SpaceFormData['mode']): SpaceEntryStep[] {
    const steps: SpaceEntryStep[] = [ALL_STEPS.data]
    if (spaceMode !== 'solo') steps.push(ALL_STEPS.split)
    steps.push(ALL_STEPS.extras, ALL_STEPS.review)
    return steps
}

/**
 * Traduce el número persistido del borrador al paso que este Espacio sí tiene.
 * Un borrador viejo con `2` en un Espacio que dejó de repartir cae en el
 * siguiente paso disponible en vez de quedarse fuera de rango.
 */
export function stepIndexFromNumber(steps: SpaceEntryStep[], value: number): number {
    const exact = steps.findIndex((step) => SPACE_ENTRY_STEP_NUMBER[step.id] === value)
    if (exact >= 0) return exact
    const next = steps.findIndex((step) => SPACE_ENTRY_STEP_NUMBER[step.id] > value)
    if (next >= 0) return next
    return steps.length - 1
}

/**
 * Cómo impacta el movimiento en el Finp personal del pagador. Las tres son
 * excluyentes (`espacios.md` §10): el servidor nunca acepta cuenta personal y
 * vínculo a la vez.
 */
export type SpaceEntryPersonalIntent = 'space_only' | 'create_transaction' | 'link_existing'
