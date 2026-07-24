import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('Tabs orientation', () => {
    it('stacks a horizontal tab list above its content', () => {
        render(
            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active">Activas</TabsTrigger>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                </TabsList>
                <TabsContent value="active">Contenido</TabsContent>
            </Tabs>
        )

        const root = screen.getByRole('tablist').parentElement
        expect(root).toHaveAttribute('data-orientation', 'horizontal')
        expect(root).toHaveClass('flex-col')
        expect(screen.getByRole('tablist')).toHaveClass(
            'group-data-[orientation=horizontal]/tabs:h-8'
        )
    })

    it('keeps vertical tabs and content side by side', () => {
        render(
            <Tabs defaultValue="active" orientation="vertical">
                <TabsList>
                    <TabsTrigger value="active">Activas</TabsTrigger>
                </TabsList>
                <TabsContent value="active">Contenido vertical</TabsContent>
            </Tabs>
        )

        expect(screen.getByRole('tablist').parentElement).toHaveClass('flex-row')
    })
})
