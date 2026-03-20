export const DEFAULT_CATEGORIES = [
    // Gastos
    { name: 'Supermercado', type: 'expense', color: '#22c55e', sortOrder: 0 },
    { name: 'Restaurantes y delivery', type: 'expense', color: '#f97316', sortOrder: 1 },
    { name: 'Transporte', type: 'expense', color: '#3b82f6', sortOrder: 2 },
    { name: 'Salud y farmacia', type: 'expense', color: '#ec4899', sortOrder: 3 },
    { name: 'Indumentaria', type: 'expense', color: '#8b5cf6', sortOrder: 4 },
    { name: 'Entretenimiento', type: 'expense', color: '#eab308', sortOrder: 5 },
    { name: 'Suscripciones', type: 'expense', color: '#14b8a6', sortOrder: 6 },
    { name: 'Servicios', type: 'expense', color: '#6b7280', sortOrder: 7 },
    { name: 'Educación', type: 'expense', color: '#0ea5e9', sortOrder: 8 },
    { name: 'Hogar', type: 'expense', color: '#a16207', sortOrder: 9 },
    { name: 'Viajes', type: 'expense', color: '#06b6d4', sortOrder: 10 },
    { name: 'Impuestos', type: 'expense', color: '#dc2626', sortOrder: 11 },
    { name: 'Pago de préstamos', type: 'expense', color: '#8B5CF6' },
    { name: 'Otros gastos', type: 'expense', color: '#9ca3af', sortOrder: 12 },

    // Ingresos
    { name: 'Sueldo', type: 'income', color: '#16a34a', sortOrder: 0 },
    { name: 'Bonos (Sueldo)', type: 'income', color: '#15803d', sortOrder: 1 },
    { name: 'Freelance', type: 'income', color: '#2563eb', sortOrder: 2 },
    { name: 'Alquileres', type: 'income', color: '#7c3aed', sortOrder: 3 },
    { name: 'Préstamos', type: 'income', color: '#8B5CF6' },
    { name: 'Otros ingresos', type: 'income', color: '#9ca3af', sortOrder: 4 },
] as const