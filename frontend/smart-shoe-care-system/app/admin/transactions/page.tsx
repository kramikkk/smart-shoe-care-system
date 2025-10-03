import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {   
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue, } from "@/components/ui/select"
import { CalendarIcon, Search } from "lucide-react"
import { TransactionDataTable } from "@/components/TransactionDataTable"
import { Transaction, columns } from "@/components/TransactionColumns"
import { transactions } from "@/data/TransactionData"
import { TransactionPagination } from "@/components/TransactionPagination"

async function getData(): Promise<Transaction[]> {
  // Fetch data from your API here.
  return transactions
}

export default async function TransactionPage() {
  const data = await getData()
  return (
    <div>
      <Card className="pb-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Showing 150 Transactions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input
              placeholder="Search"
              className="pl-10"
              />
              </div>
              <div className="flex items-center gap-2">
              <CalendarIcon/>
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value="allTime">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="thiMonth">This Month</SelectItem>
                    <SelectItem value="thisHalfYear">This Half-Year</SelectItem>
                    <SelectItem value="thisYear">This Year</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              </div>
            </div>
              <TransactionDataTable columns={columns} data={data} />
              
          </div>
        </CardContent>
      </Card>
    </div>
  )
}