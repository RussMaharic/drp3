import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { StoreProvider } from "@/contexts/store-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Drpshipper - The Supplier-to-Shopify Product Sync Engine",
  description: "Manage your catalog, control quality, and scale your reach.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  )
}
