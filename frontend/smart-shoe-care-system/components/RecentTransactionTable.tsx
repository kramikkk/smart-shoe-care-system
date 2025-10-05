import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { transactions } from "@/data/TransactionData"
import { Badge } from "./ui/badge"
import { Receipt, ArrowRight, ArrowLeftRight } from "lucide-react"
import Link from "next/link"

const RecentTransactionTable = () => {
  const recentTransactions = transactions.slice(-5).reverse()

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
    <div>
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="text-purple-500" />
                  <CardTitle>Recent Transactions</CardTitle>
                </div>
                <CardAction>
                  <Link 
                    href="/admin/transactions" 
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View All
                    <ArrowRight className="size-4" />
                  </Link>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Service Type</TableHead>
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
            </CardContent>
        </Card>
    </div>
  )
}

export default RecentTransactionTable