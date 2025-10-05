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

      return matchesSearch && matchesPayment && matchesService && matchesStatus && matchesDate
    })
  }, [search, paymentFilter, serviceFilter, statusFilter, dateFrom, dateTo])

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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
                {/* Filters */}
                <div className="flex flex-wrap gap-3 flex-1 items-end">
                {/* Search Bar */}
                <div className="flex flex-col gap-1.5 w-full lg:w-240">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Search className="size-3.5"/>
                    Search Bar
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                      placeholder="Search transactions..."
                      className="pl-10 pr-10 h-10 border-2"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Payment Method Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Coins className="size-3.5"/>
                    Payment
                  </label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger className="h-10 border-2">
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
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
                </div>

                {/* Service Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Footprints className="size-3.5"/>
                    Service
                  </label>
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="h-10 border-2">
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
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
                </div>

                {/* Status Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CloudCheck className="size-3.5"/>
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 border-2">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
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
                </div>
                
                {/* Date Range Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5"/>
                    Date Range
                  </label>
                  <div className="flex gap-2">
                    {/* From Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`h-10 flex-1 justify-start text-left font-normal border-2 ${!dateFrom && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "MMM dd") : "Start date"}
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
                          className={`h-10 flex-1 justify-start text-left font-normal border-2 ${!dateTo && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "MMM dd") : "End date"}
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
                </div>

                {/* Clear Filters Button */}
                <button
                  onClick={() => {
                    setPaymentFilter("all")
                    setServiceFilter("all")
                    setStatusFilter("all")
                    setDateFrom(undefined)
                    setDateTo(undefined)
                  }}
                  disabled={paymentFilter === "all" && serviceFilter === "all" && statusFilter === "all" && !dateFrom && !dateTo}
                  className="h-10 px-4 rounded-md border-2 border-muted-foreground/20 bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                  Clear Filters
                </button>
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
