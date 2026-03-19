import { z } from 'zod'

export const loginSchema = z.object({
    email: z.string().min(1, 'El email es requerido').email('Email inválido'),
    password: z.string().min(1, 'La contraseña es requerida'),
})

export const registerSchema = z.object({
    displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().min(1, 'El email es requerido').email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>