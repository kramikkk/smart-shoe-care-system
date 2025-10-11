"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type Transaction = {
  transactionId: string
  dateTime: string
  paymentMethod: "Cash" | "Online"
  serviceType: "Cleaning" | "Drying" | "Sterilizing" | "Package"
  amount: number
  status: "Pending" | "Success" | "Failed"
}

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

export const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "transactionId",
    header: "Transaction ID",
  },
  {
    accessorKey: "dateTime",
    header: "Date & Time",
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment Method",
  },
  {
    accessorKey: "serviceType",
    header: "Service Type",
  },
  {
    accessorKey: "amount",
        header: () => <div>Amount</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "PHP",
      }).format(amount)
 
      return <div>{formatted}</div>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return getStatusBadge(status)
    },
  },
]