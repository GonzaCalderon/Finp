import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/validations/auth'

// ─── loginSchema ──────────────────────────────────────────────────────────────
describe('loginSchema', () => {
    it('es válido con email y contraseña correctos', () => {
        const result = loginSchema.safeParse({
            email: 'usuario@finp.dev',
            password: 'MiClave123',
        })
        expect(result.success).toBe(true)
    })

    it('rechaza email inválido', () => {
        const result = loginSchema.safeParse({
            email: 'no-es-email',
            password: 'MiClave123',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('email')
        }
    })

    it('rechaza email vacío', () => {
        const result = loginSchema.safeParse({ email: '', password: 'MiClave123' })
        expect(result.success).toBe(false)
    })

    it('rechaza contraseña vacía', () => {
        const result = loginSchema.safeParse({ email: 'usuario@finp.dev', password: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('password')
        }
    })

    it('rechaza cuando faltan ambos campos', () => {
        const result = loginSchema.safeParse({})
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
        }
    })
})

// ─── registerSchema ───────────────────────────────────────────────────────────
describe('registerSchema', () => {
    it('es válido con todos los campos correctos', () => {
        const result = registerSchema.safeParse({
            displayName: 'Juan García',
            email: 'juan@finp.dev',
            password: 'Segura123!',
        })
        expect(result.success).toBe(true)
    })

    it('rechaza displayName con menos de 2 caracteres', () => {
        const result = registerSchema.safeParse({
            displayName: 'J',
            email: 'juan@finp.dev',
            password: 'Segura123!',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('displayName')
        }
    })

    it('acepta displayName de exactamente 2 caracteres', () => {
        const result = registerSchema.safeParse({
            displayName: 'JJ',
            email: 'juan@finp.dev',
            password: 'Segura123!',
        })
        expect(result.success).toBe(true)
    })

    it('rechaza contraseña con menos de 8 caracteres', () => {
        const result = registerSchema.safeParse({
            displayName: 'Juan García',
            email: 'juan@finp.dev',
            password: 'Corta1',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('password')
        }
    })

    it('acepta contraseña de exactamente 8 caracteres', () => {
        const result = registerSchema.safeParse({
            displayName: 'Juan García',
            email: 'juan@finp.dev',
            password: '12345678',
        })
        expect(result.success).toBe(true)
    })

    it('rechaza email inválido en registro', () => {
        const result = registerSchema.safeParse({
            displayName: 'Juan García',
            email: 'no-es-email',
            password: 'Segura123!',
        })
        expect(result.success).toBe(false)
    })
})
