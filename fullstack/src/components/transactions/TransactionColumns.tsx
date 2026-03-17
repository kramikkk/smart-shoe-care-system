"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

export type Transaction = {
  transactionId: string
  dateTime: string
  paymentMethod: "Cash" | "Online"
  serviceType: "Cleaning" | "Drying" | "Sterilizing" | "Package"
  shoeType: "Canvas" | "Rubber" | "Mesh"
  careType: "Gentle" | "Normal" | "Strong" | "Auto"
  amount: number
  status: "Pending" | "Success" | "Failed"
  deviceId?: string | null
}

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
    accessorKey: "shoeType",
    header: "Shoe Type",
  },
  {
    accessorKey: "careType",
    header: "Care Type",
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