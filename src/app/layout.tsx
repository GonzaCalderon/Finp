import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
    title: 'Finp',
    description: 'Gestión financiera personal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" suppressHydrationWarning>
        <body className="antialiased">
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={true}
        >
            {children}
            <Toaster />
        </ThemeProvider>
        </body>
        </html>
    )
}
