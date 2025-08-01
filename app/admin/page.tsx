"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Search, Filter, Download, Package, User, Calendar, DollarSign, RefreshCw, Store, LogOut, MapPin } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TokenManager } from "@/lib/token-manager"

interface AdminOrder {
  id: string
  orderNumber: number
  name: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    province?: string
    zip?: string
    country?: string
    phone?: string
  }
  billingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    province?: string
    zip?: string
    country?: string
    phone?: string
  }
  status: "pending" | "fulfilled" | "cancelled" | "partial"
  financialStatus: string
  amount: number
  currency: string
  date: string
  storeName: string
  margin: number
  lineItems: Array<{
    id: number
    name: string
    quantity: number
    price: number
  }>
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<AdminOrder[]>([])
  const [stores, setStores] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [productFilter, setProductFilter] = useState("all")
  const [storeFilter, setStoreFilter] = useState("all")
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  // Helper function to calculate total items in an order
  const calculateTotalItems = (lineItems: Array<{quantity: number}>) => {
    if (!lineItems || lineItems.length === 0) return 0
    return lineItems.reduce((total, item) => total + (item.quantity || 0), 0)
  }

  const formatAddress = (address: any) => {
    if (!address) return 'No address available'
    
    const parts = []
    if (address.address1) parts.push(address.address1)
    if (address.address2) parts.push(address.address2)
    if (address.city) parts.push(address.city)
    if (address.state || address.province) parts.push(address.state || address.province)
    if (address.zip) parts.push(address.zip)
    if (address.country) parts.push(address.country)
    
    return parts.length > 0 ? parts.join(', ') : 'No address available'
  }

  const formatFullAddress = (address: any) => {
    if (!address) return 'No address available'
    
    const lines = []
    if (address.address1) lines.push(address.address1)
    if (address.address2) lines.push(address.address2)
    
    const cityStateZip = []
    if (address.city) cityStateZip.push(address.city)
    if (address.state || address.province) cityStateZip.push(address.state || address.province)
    if (address.zip) cityStateZip.push(address.zip)
    if (cityStateZip.length > 0) lines.push(cityStateZip.join(', '))
    
    if (address.country) lines.push(address.country)
    
    return lines.length > 0 ? lines.join('\n') : 'No address available'
  }

  const getAddressType = (order: AdminOrder) => {
    if (order.shippingAddress) return 'Shipping Address'
    if (order.billingAddress) return 'Billing Address'
    return 'No Address'
  }

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllStoresAndOrders()
    }
  }, [isAuthenticated])

  const checkAuthentication = () => {
    try {
      const adminUser = localStorage.getItem('adminUser')
      if (adminUser) {
        setIsAuthenticated(true)
      } else {
        router.push('/login/admin')
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/login/admin')
    } finally {
      setAuthLoading(false)
    }
  }



  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, productFilter, storeFilter])

  const fetchAllStoresAndOrders = async () => {
    try {
      setLoading(true)
      
      // Get all connected stores
      const connectedStores = await TokenManager.getAllStores()
      const storeNames = connectedStores.map(store => store.shop)
      setStores(storeNames)

      // Fetch orders from all stores
      const allOrders: AdminOrder[] = []
      
      for (const store of connectedStores) {
        try {
          // Try GraphQL first, fallback to REST if needed
          let response = await fetch(`/api/shopify-orders-graphql?shop=${store.shop}`)
          
          if (!response.ok) {
            console.log(`GraphQL failed for ${store.shop}, trying REST API...`)
            response = await fetch(`/api/shopify-orders?shop=${store.shop}`)
          }
          
          if (response.ok) {
            const data = await response.json()
            const storeOrders = data.orders?.map((order: any) => ({
              ...order,
              customerPhone: order.customerPhone || null,
              shippingAddress: order.shippingAddress || null,
              billingAddress: order.billingAddress || null,
              storeName: store.shop,
              margin: calculateMargin(order.amount), // Calculate margin based on order amount
            })) || []
            
            allOrders.push(...storeOrders)
          }
        } catch (error) {
          console.error(`Error fetching orders for ${store.shop}:`, error)
        }
      }

      // Sort orders by date (newest first)
      allOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setOrders(allOrders)
      
      // Extract unique products from all orders
      const allProducts = new Set<string>()
      allOrders.forEach(order => {
        order.lineItems?.forEach(item => {
          if (item.name) {
            allProducts.add(item.name)
          }
        })
      })
      setProducts(Array.from(allProducts).sort())
      
    } catch (error) {
      console.error('Error fetching stores and orders:', error)
      toast({
        title: "Error",
        description: "Failed to fetch orders from stores.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateMargin = (orderAmount: number): number => {
    // Simple margin calculation - 15% of order amount
    // In a real app, this would be based on actual product costs
    return orderAmount * 0.15
  }

  const filterOrders = () => {
    let filtered = orders

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toString().includes(searchTerm)
      )
    }

    // Filter by status
    if (productFilter !== "all") {
      filtered = filtered.filter(order => 
        order.lineItems?.some(item => 
          item.name?.toLowerCase().includes(productFilter.toLowerCase())
        )
      )
    }

    // Filter by store
    if (storeFilter !== "all") {
      filtered = filtered.filter(order => order.storeName === storeFilter)
    }

    setFilteredOrders(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "partial":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportOrders = () => {
    const csvContent = [
      ["Order #", "Customer", "Status", "Amount", "Store", "Margin", "Date"].join(","),
      ...filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.status,
        order.amount,
        order.storeName,
        order.margin.toFixed(2),
        order.date
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "admin_orders.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // If not authenticated, redirect will happen in useEffect
  if (!isAuthenticated) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Orders</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage orders from all connected stores
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchAllStoresAndOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportOrders} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredOrders.reduce((sum, order) => sum + order.amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(filteredOrders.reduce((sum, order) => sum + order.margin, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Connected Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product} value={product}>
                    {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store} value={store}>
                    {store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              setProductFilter("all")
              setStoreFilter("all")
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.lineItems && order.lineItems.length > 0 ? (
                          order.lineItems.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-gray-900">{item.name}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No items</div>
                        )}
                        {order.lineItems && order.lineItems.length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{order.lineItems.length - 2} more items
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[300px]">
                        {order.shippingAddress || order.billingAddress ? (
                          <div className="flex items-start space-x-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-900 font-medium leading-tight">
                                {(order.shippingAddress || order.billingAddress)?.address1}
                              </div>
                              {(order.shippingAddress || order.billingAddress)?.address2 && (
                                <div className="text-gray-600 text-xs leading-tight">
                                  {(order.shippingAddress || order.billingAddress)?.address2}
                                </div>
                              )}
                              <div className="text-gray-600 text-xs leading-tight">
                                {[
                                  (order.shippingAddress || order.billingAddress)?.city,
                                  (order.shippingAddress || order.billingAddress)?.state || (order.shippingAddress || order.billingAddress)?.province,
                                  (order.shippingAddress || order.billingAddress)?.zip
                                ].filter(Boolean).join(', ')}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {(order.shippingAddress || order.billingAddress)?.country}
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => setSelectedAddress(order.shippingAddress || order.billingAddress)}
                                >
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    {getAddressType(order)}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Complete address details for order #{order.orderNumber}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {selectedAddress && (
                                    <div className="space-y-4">
                                      {/* Customer Name */}
                                      {(selectedAddress.firstName || selectedAddress.lastName) && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="font-medium text-sm text-gray-500 mb-1">Customer Name</div>
                                          <div className="text-sm font-medium">
                                            {`${selectedAddress.firstName || ''} ${selectedAddress.lastName || ''}`.trim()}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Phone Number */}
                                      {selectedAddress.phone && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="font-medium text-sm text-gray-500 mb-1">Phone Number</div>
                                          <div className="text-sm">{selectedAddress.phone}</div>
                                        </div>
                                      )}
                                      
                                      {/* Full Address */}
                                      <div className="bg-gray-50 p-3 rounded-lg">
                                        <div className="font-medium text-sm text-gray-500 mb-2">Complete Address</div>
                                        <div className="text-sm whitespace-pre-line leading-relaxed">
                                          {formatFullAddress(selectedAddress)}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <span className="text-gray-400">No address</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(order.amount, order.currency)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Store className="h-4 w-4 mr-2 text-gray-400" />
                        {order.storeName}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {calculateTotalItems(order.lineItems)} item{calculateTotalItems(order.lineItems) !== 1 ? 's' : ''}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 