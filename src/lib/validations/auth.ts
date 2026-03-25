import { z } from 'zod'

export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'El email es requerido')
        .email('Email inválido')
        .transform((val) => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'La contraseña es requerida')
        .min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export const registerSchema = z
    .object({
        displayName: z
            .string()
            .min(1, 'El nombre es requerido')
            .transform((val) => val.trim())
            .pipe(
                z
                    .string()
                    .min(2, 'El nombre debe tener al menos 2 caracteres')
                    .max(60, 'El nombre no puede superar los 60 caracteres')
                    .regex(/\S/, 'El nombre no puede estar vacío')
            ),
        email: z
            .string()
            .min(1, 'El email es requerido')
            .email('Email inválido')
            .transform((val) => val.toLowerCase().trim()),
        password: z
            .string()
            .min(8, 'La contraseña debe tener al menos 8 caracteres')
            .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
            .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
        confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
    })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
