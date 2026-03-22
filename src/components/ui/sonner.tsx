"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
    CircleCheckIcon,
    InfoIcon,
    TriangleAlertIcon,
    OctagonXIcon,
    Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            position="bottom-center"
            offset="16px"
            mobileOffset={{ bottom: "92px", left: "16px", right: "16px" }}
            icons={{
                success: <CircleCheckIcon className="h-4 w-4" />,
                info: <InfoIcon className="h-4 w-4" />,
                warning: <TriangleAlertIcon className="h-4 w-4" />,
                error: <OctagonXIcon className="h-4 w-4" />,
                loading: <Loader2Icon className="h-4 w-4 animate-spin" />,
            }}
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: "cn-toast",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }