import { Navbar } from '@/components/shared/Navbar'
import React from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col min-h-screen">
                {children}
            </main>
        </div>
    )
}