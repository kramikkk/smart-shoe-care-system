"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, CloudCheck, Coins, Footprints, Search, Receipt, ArrowLeftRight, FileClock, X } from "lucide-react"
import { TransactionDataTable } from "@/components/TransactionDataTable"
import { columns } from "@/components/TransactionColumns"
import { transactions } from "@/data/TransactionData"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

export default function TransactionPage() {

  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [shoeTypeFilter, setShoeTypeFilter] = useState<string>("all")
  const [careTypeFilter, setCareTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const filteredData = useMemo(() => {
    return transactions.filter((tx) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        search === "" ||
        tx.transactionId.toLowerCase().includes(searchLower) ||
        tx.serviceType.toLowerCase().includes(searchLower) ||
        tx.paymentMethod.toLowerCase().includes(searchLower) ||
        tx.status.toLowerCase().includes(searchLower) ||
        tx.dateTime.toLowerCase().includes(searchLower) ||
        tx.amount.toString().includes(searchLower)

      const matchesPayment =
        paymentFilter === "all" || tx.paymentMethod === paymentFilter

      const matchesService =
        serviceFilter === "all" || tx.serviceType === serviceFilter

      const matchesShoeType =
        shoeTypeFilter === "all" || tx.shoeType === shoeTypeFilter

      const matchesCareType =
        careTypeFilter === "all" || tx.careType === careTypeFilter

      const matchesStatus =
        statusFilter === "all" || tx.status === statusFilter

      // Date filtering
      const matchesDate = (() => {
        if (!dateFrom && !dateTo) return true
        
        const txDate = new Date(tx.dateTime)
        
        if (dateFrom && dateTo) {
          const from = new Date(dateFrom.setHours(0, 0, 0, 0))
          const to = new Date(dateTo.setHours(23, 59, 59, 999))
          return txDate >= from && txDate <= to
        }
        
        if (dateFrom) {
          const from = new Date(dateFrom.setHours(0, 0, 0, 0))
          return txDate >= from
        }
        
        if (dateTo) {
          const to = new Date(dateTo.setHours(23, 59, 59, 999))
          return txDate <= to
        }
        
        return true
      })()

      return matchesSearch && matchesPayment && matchesService && matchesShoeType && matchesCareType && matchesStatus && matchesDate
    })
  }, [search, paymentFilter, serviceFilter, shoeTypeFilter, careTypeFilter, statusFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  return (
    <div className="w-full">
      <Card className="pb-2">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileClock className="size-4 sm:size-5 text-purple-500" />
                <CardTitle className="text-lg sm:text-xl">Transaction History</CardTitle>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Showing {filteredData.length} transaction{filteredData.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            {/* Search + Filters */}
            <div className="flex flex-col gap-3">
              {/* Top Row - Search Bar + Date Range + Clear Button */}
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <Input
                    placeholder="Search by ID, service, amount..."
                    className="pl-10 pr-10 h-10 sm:h-11 border-2 text-sm sm:text-base"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Date Range + Clear Button Group */}
                <div className="flex flex-col gap-2 lg:flex-row lg:flex-shrink-0">
                  {/* Date Range Container */}
                  <div className="flex gap-2">
                    {/* From Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`h-10 sm:h-11 flex-1 lg:w-[140px] lg:flex-initial justify-start text-left font-normal border-2 text-sm ${!dateFrom && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{dateFrom ? format(dateFrom, "MMM dd") : "From"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {/* To Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`h-10 sm:h-11 flex-1 lg:w-[140px] lg:flex-initial justify-start text-left font-normal border-2 text-sm ${!dateTo && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{dateTo ? format(dateTo, "MMM dd") : "To"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          autoFocus
                          disabled={(date) => dateFrom ? date < dateFrom : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Clear Filters Button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPaymentFilter("all")
                      setServiceFilter("all")
                      setShoeTypeFilter("all")
                      setCareTypeFilter("all")
                      setStatusFilter("all")
                      setDateFrom(undefined)
                      setDateTo(undefined)
                    }}
                    disabled={paymentFilter === "all" && serviceFilter === "all" && shoeTypeFilter === "all" && careTypeFilter === "all" && statusFilter === "all" && !dateFrom && !dateTo}
                    className="h-10 sm:h-11 px-3 sm:px-4 border-2 gap-2 w-full lg:w-auto text-sm"
                  >
                    <X className="size-4" />
                    <span>Clear</span>
                  </Button>
                </div>
              </div>

              {/* Bottom Row - Filter Selects (Full Width) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {/* Payment Method Filter */}
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-10 sm:h-11 border-2 w-full text-sm">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Payment</SelectItem>
                    <SelectItem value="Cash">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-green-500"></div>
                        Cash
                      </div>
                    </SelectItem>
                    <SelectItem value="Online">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-blue-500"></div>
                        Online
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Service Filter */}
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="h-10 sm:h-11 border-2 w-full text-sm">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Service</SelectItem>
                    <SelectItem value="Cleaning">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-blue-500"></div>
                        Cleaning
                      </div>
                    </SelectItem>
                    <SelectItem value="Drying">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-orange-500"></div>
                        Drying
                      </div>
                    </SelectItem>
                    <SelectItem value="Sterilizing">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-purple-500"></div>
                        Sterilizing
                      </div>
                    </SelectItem>
                    <SelectItem value="Package">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-pink-500"></div>
                        Package
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 sm:h-11 border-2 w-full text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    <SelectItem value="Success">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-green-500"></div>
                        Success
                      </div>
                    </SelectItem>
                    <SelectItem value="Pending">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-yellow-500"></div>
                        Pending
                      </div>
                    </SelectItem>
                    <SelectItem value="Failed">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-red-500"></div>
                        Failed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Shoe Type Filter */}
                <Select value={shoeTypeFilter} onValueChange={setShoeTypeFilter}>
                  <SelectTrigger className="h-10 sm:h-11 border-2 w-full text-sm">
                    <SelectValue placeholder="Shoe Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Shoe Type</SelectItem>
                    <SelectItem value="Canvas">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-amber-500"></div>
                        Canvas
                      </div>
                    </SelectItem>
                    <SelectItem value="Rubber">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-slate-500"></div>
                        Rubber
                      </div>
                    </SelectItem>
                    <SelectItem value="Mesh">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-cyan-500"></div>
                        Mesh
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Care Type Filter */}
                <div className="col-span-2 sm:col-span-2 md:col-span-1">
                  <Select value={careTypeFilter} onValueChange={setCareTypeFilter}>
                    <SelectTrigger className="h-10 sm:h-11 border-2 w-full text-sm">
                      <SelectValue placeholder="Care Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Care Type</SelectItem>
                      <SelectItem value="Gentle">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-green-500"></div>
                          Gentle
                        </div>
                      </SelectItem>
                      <SelectItem value="Normal">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-blue-500"></div>
                          Normal
                        </div>
                      </SelectItem>
                      <SelectItem value="Strong">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-red-500"></div>
                          Strong
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
