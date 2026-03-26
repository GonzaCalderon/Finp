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
// El registerSchema real requiere: displayName (min 2), email, password (min 8,
// con al menos una letra y un número), confirmPassword (debe coincidir).
describe('registerSchema', () => {
    // Datos base válidos reutilizables en los tests
    const datosValidos = {
        displayName: 'Juan García',
        email: 'juan@finp.dev',
        password: 'Segura123!',
        confirmPassword: 'Segura123!',
    }

    it('es válido con todos los campos correctos', () => {
        const result = registerSchema.safeParse(datosValidos)
        expect(result.success).toBe(true)
    })

    it('rechaza displayName con menos de 2 caracteres', () => {
        const result = registerSchema.safeParse({ ...datosValidos, displayName: 'J' })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('displayName')
        }
    })

    it('acepta displayName de exactamente 2 caracteres', () => {
        const result = registerSchema.safeParse({ ...datosValidos, displayName: 'JJ' })
        expect(result.success).toBe(true)
    })

    it('rechaza contraseña con menos de 8 caracteres', () => {
        const result = registerSchema.safeParse({
            ...datosValidos,
            password: 'Clave1',
            confirmPassword: 'Clave1',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('password')
        }
    })

    it('acepta contraseña de exactamente 8 caracteres con letra y número', () => {
        // El schema real requiere al menos una letra y un número (no solo min 8)
        const result = registerSchema.safeParse({
            ...datosValidos,
            password: 'Clave123',
            confirmPassword: 'Clave123',
        })
        expect(result.success).toBe(true)
    })

    it('rechaza contraseña sin letras (solo números)', () => {
        const result = registerSchema.safeParse({
            ...datosValidos,
            password: '12345678',
            confirmPassword: '12345678',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('password')
        }
    })

    it('rechaza contraseña sin números (solo letras)', () => {
        const result = registerSchema.safeParse({
            ...datosValidos,
            password: 'SoloLetras',
            confirmPassword: 'SoloLetras',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('password')
        }
    })

    it('rechaza cuando las contraseñas no coinciden', () => {
        const result = registerSchema.safeParse({
            ...datosValidos,
            password: 'Segura123!',
            confirmPassword: 'Diferente456!',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'))
            expect(paths).toContain('confirmPassword')
        }
    })

    it('rechaza email inválido en registro', () => {
        const result = registerSchema.safeParse({ ...datosValidos, email: 'no-es-email' })
        expect(result.success).toBe(false)
    })

    it('rechaza cuando faltan campos obligatorios', () => {
        const result = registerSchema.safeParse({})
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThanOrEqual(3)
        }
    })
})
