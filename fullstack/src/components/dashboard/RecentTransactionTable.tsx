'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ArrowLeftRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useDeviceFilter } from "@/contexts/DeviceFilterContext"

type Transaction = {
  transactionId: string
  dateTime: string
  paymentMethod: string
  serviceType: string
  shoeType: string
  careType: string
  amount: number
  status: string
}

const RecentTransactionTable = () => {
  const { selectedDevice } = useDeviceFilter()
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch recent transactions from API
  useEffect(() => {
    const fetchTransactions = async () => {
      setError(null)
      try {
        const response = await fetch(`/api/transaction/list?deviceId=${selectedDevice}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        const data = await response.json()

        if (data.success) {
          // Get last 7 transactions and format dateTime
          const recent = data.transactions.slice(0, 7).map((tx: any) => ({
            ...tx,
            dateTime: new Date(tx.dateTime).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).replace(',', ''),
          }))
          setRecentTransactions(recent)
        } else {
          console.error('Failed to fetch transactions:', data.error)
          setError('Failed to load transactions')
        }
      } catch (error) {
        console.error('Error fetching transactions:', error)
        setError('Failed to load transactions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [selectedDevice])

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">Success</Badge>
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">Pending</Badge>
      case "failed":
        return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col h-full">
        <Card className="flex flex-col h-full glass-card border-none">
            <CardHeader className="shrink-0">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="text-purple-500" />
                  <CardTitle>Recent <span className="text-primary">Transactions</span></CardTitle>
                </div>
                <CardAction>
                  <Link
                    href="/client/dashboard/transactions"
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View All
                    <ArrowRight className="size-4" />
                  </Link>
                </CardAction>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden">
                {error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-destructive text-sm">{error}</div>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">No transactions yet</div>
                  </div>
                ) : (
                <div className="overflow-x-auto h-full">
                  <Table>
                      <TableHeader>
                          <TableRow>
                          <TableHead className="whitespace-nowrap">Transaction ID</TableHead>
                          <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                          <TableHead className="whitespace-nowrap">Method</TableHead>
                          <TableHead className="whitespace-nowrap">Service</TableHead>
                          <TableHead className="whitespace-nowrap hidden lg:table-cell">Shoe Type</TableHead>
                          <TableHead className="whitespace-nowrap hidden xl:table-cell">Care Type</TableHead>
                          <TableHead className="whitespace-nowrap">Amount</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {recentTransactions.map((transaction) => (
                            <TableRow key={transaction.transactionId}>
                              <TableCell className="font-medium whitespace-nowrap">{transaction.transactionId}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm">{transaction.dateTime}</TableCell>
                              <TableCell className="whitespace-nowrap">{transaction.paymentMethod}</TableCell>
                              <TableCell className="whitespace-nowrap">{transaction.serviceType}</TableCell>
                              <TableCell className="whitespace-nowrap hidden lg:table-cell">{transaction.shoeType}</TableCell>
                              <TableCell className="whitespace-nowrap hidden xl:table-cell">{transaction.careType}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "PHP",
                                }).format(transaction.amount)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{getStatusBadge(transaction.status)}</TableCell>

                            </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                </div>
                )}
            </CardContent>
        </Card>
    </div>
  )
}

export default RecentTransactionTable
