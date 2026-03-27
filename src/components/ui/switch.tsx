"use client"

import { motion } from "framer-motion"

interface SwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
    'aria-label'?: string
}

/**
 * Toggle animado con spring. Usa var(--sky) / var(--muted).
 * Implementación propia para garantizar animación suave y consistencia visual con Finp.
 */
export function Switch({ checked, onCheckedChange, disabled, className, 'aria-label': ariaLabel }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onCheckedChange(!checked)}
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 36,
                height: 20,
                borderRadius: 999,
                padding: 2,
                backgroundColor: checked ? 'var(--sky)' : 'var(--muted)',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background-color 0.18s ease',
                flexShrink: 0,
                outline: 'none',
            }}
        >
            <motion.span
                animate={{ x: checked ? 16 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.5 }}
                style={{
                    display: 'block',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.1)',
                    flexShrink: 0,
                }}
            />
        </button>
    )
}
