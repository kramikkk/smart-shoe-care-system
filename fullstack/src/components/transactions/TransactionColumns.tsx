"use client"

import { ColumnDef } from "@tanstack/react-table"

export type Transaction = {
  id: string
  dateTime: string
  paymentMethod: "Cash" | "Online"
  serviceType: "Cleaning" | "Drying" | "Sterilizing" | "Package"
  shoeType: "Canvas" | "Rubber" | "Mesh"
  careType: "Gentle" | "Normal" | "Strong" | "Auto"
  amount: number
  deviceId?: string | null
}

export const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "id",
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
      const amount = row.getValue<number>("amount")
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "PHP",
      }).format(amount)

      return <div>{formatted}</div>
    },
  },
]
