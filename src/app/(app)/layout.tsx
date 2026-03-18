import { Navbar } from '@/components/shared/Navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col md:overflow-auto">
                {children}
            </main>
        </div>
    )
}