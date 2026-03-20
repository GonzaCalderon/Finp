import { Navbar } from '@/components/shared/Navbar'
import { AppBreadcrumb } from '@/components/shared/AppBreadcrumb'
import { ScrollToTop } from '@/components/shared/ScrollToTop'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col min-h-screen">
                <ScrollToTop />
                <div
                    className="px-6 py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}
                >
                    <AppBreadcrumb />
                </div>
                {children}
            </main>
        </div>
    )
}