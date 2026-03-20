import { Navbar } from '@/components/shared/Navbar'
import { AppBreadcrumb } from '@/components/shared/AppBreadcrumb'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { HideAmountsProvider } from '@/contexts/HideAmountsContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <HideAmountsProvider>
            <div className="flex min-h-screen">
                <Navbar />
                <main className="flex-1 flex flex-col min-h-screen min-w-0">
                    <ScrollToTop />
                    <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <AppBreadcrumb />
                    </div>
                    <div className="pb-24 md:pb-0">
                        {children}
                    </div>
                </main>
            </div>
        </HideAmountsProvider>
    )
}