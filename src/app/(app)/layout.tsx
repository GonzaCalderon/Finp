import { Navbar } from '@/components/shared/Navbar'
import { AppStartupGate } from '@/components/shared/AppStartupGate'
import { AppBreadcrumb } from '@/components/shared/AppBreadcrumb'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { SessionGuard } from '@/components/shared/SessionGuard'
import { HideAmountsProvider } from '@/contexts/HideAmountsContext'
import { CategoriesProvider } from '@/contexts/CategoriesContext'
import { AccountsProvider } from '@/contexts/AccountsContext'
import { SpaceActionProvider } from '@/contexts/SpaceActionContext'
import { BreadcrumbActionProvider } from '@/contexts/BreadcrumbActionContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppStartupGate>
            <SpaceActionProvider>
            <HideAmountsProvider>
            <NotificationsProvider>
                <CategoriesProvider>
                    <AccountsProvider>
                        <BreadcrumbActionProvider>
                        <div className="flex min-h-screen">
                            <SessionGuard />
                            <Navbar />
                            <main className="flex-1 flex flex-col min-h-screen min-w-0">
                                <ScrollToTop />
                                <div
                                    className="px-6 py-3 border-b"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <AppBreadcrumb />
                                </div>

                                <div className="pb-24 md:pb-0">{children}</div>
                            </main>
                        </div>
                        </BreadcrumbActionProvider>
                    </AccountsProvider>
                </CategoriesProvider>
            </NotificationsProvider>
            </HideAmountsProvider>
            </SpaceActionProvider>
        </AppStartupGate>
    )
}
