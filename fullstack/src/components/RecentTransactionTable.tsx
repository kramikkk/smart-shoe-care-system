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
import { Badge } from "./ui/badge"
import { ArrowRight, ArrowLeftRight } from "lucide-react"
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

  // Fetch recent transactions from API
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(`/api/transaction/list?deviceId=${selectedDevice}`)
        const data = await response.json()

        if (data.success) {
          // Get last 5 transactions and format dateTime
          const recent = data.transactions.slice(0, 5).map((tx: any) => ({
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
        }
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [selectedDevice])

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return <Badge className="bg-green-200 text-green-800 hover:bg-green-100">Success</Badge>
      case "pending":
        return <Badge className="bg-yellow-200 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-200 text-red-800 hover:bg-red-100">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col h-full">
        <Card className="flex flex-col h-full">
            <CardHeader className="shrink-0">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="text-purple-500" />
                  <CardTitle>Recent Transactions</CardTitle>
                </div>
                <CardAction>
                  <Link
                    href="/admin/dashboard/transactions"
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View All
                    <ArrowRight className="size-4" />
                  </Link>
                </CardAction>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">Loading transactions...</div>
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">No transactions yet</div>
                  </div>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Shoe Type</TableHead>
                        <TableHead>Care Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentTransactions.map((transaction) => (
                          <TableRow key={transaction.transactionId}>
                            <TableCell className="font-medium">{transaction.transactionId}</TableCell>
                            <TableCell>{transaction.dateTime}</TableCell>
                            <TableCell>{transaction.paymentMethod}</TableCell>
                            <TableCell>{transaction.serviceType}</TableCell>
                            <TableCell>{transaction.shoeType}</TableCell>
                            <TableCell>{transaction.careType}</TableCell>
                            <TableCell>
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "PHP",
                              }).format(transaction.amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(transaction.status)}</TableCell>

                          </TableRow>
                        ))}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
    </div>
  )
}

export default RecentTransactionTable