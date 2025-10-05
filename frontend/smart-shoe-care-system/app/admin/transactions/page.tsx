"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, CloudCheck, Coins, Footprints, Search, Receipt, ArrowLeftRight, FileClock } from "lucide-react"
import { TransactionDataTable } from "@/components/TransactionDataTable"
import { columns } from "@/components/TransactionColumns"
import { transactions } from "@/data/TransactionData"

export default function TransactionPage() {
  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const filteredData = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.transactionId.toLowerCase().includes(search.toLowerCase()) ||
        tx.serviceType.toLowerCase().includes(search.toLowerCase())

      const matchesPayment =
        paymentFilter === "all" || tx.paymentMethod === paymentFilter

      const matchesService =
        serviceFilter === "all" || tx.serviceType === serviceFilter

      const matchesStatus =
        statusFilter === "all" || tx.status === statusFilter

      return matchesSearch && matchesPayment && matchesService && matchesStatus
    })
  }, [search, paymentFilter, serviceFilter, statusFilter])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  return (
    <div>
      <Card className="pb-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileClock className="size-5 text-purple-500" />
                <CardTitle>Transaction History</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Showing {filteredData.length} transaction{filteredData.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <Input
                  placeholder="Search by ID or Service"
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Payment Method Filter */}
              <div className="flex items-center gap-2">
                <Coins/>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Payment Method</SelectLabel>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              </div>

              {/* Service Filter */}
              <div className="flex items-center gap-2">
                <Footprints/>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Service Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Service</SelectLabel>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                    <SelectItem value="Drying">Drying</SelectItem>
                    <SelectItem value="Sterilizing">Sterilizing</SelectItem>
                    <SelectItem value="Package">Package</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <CloudCheck/>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Success">Success</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              </div>
              
              {/* Date Filter (keep your Calendar if needed) */}
              <div className="flex items-center gap-2">
                <CalendarIcon/>
                <Select>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Select Timeframe</SelectLabel>
                      <SelectItem value="allTime">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="thisHalfYear">This Half-Year</SelectItem>
                      <SelectItem value="thisYear">This Year</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <TransactionDataTable columns={columns} data={filteredData} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
