
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  studentName: string;
  studentId: string;
  items: InvoiceItem[];
  totalAmount: number;
}

interface InvoiceDisplayProps {
  invoiceData: InvoiceData;
}

export const InvoiceDisplay = React.forwardRef<HTMLDivElement, InvoiceDisplayProps>(
  ({ invoiceData }, ref) => {
    return (
      <div ref={ref} className="p-6 border rounded-lg bg-white text-black shadow-lg font-sans max-w-2xl mx-auto print:shadow-none print:border-none print:p-0">
        <header className="flex justify-between items-start mb-8 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">EduSphere Institute of Technology</h1>
            <p className="text-gray-500">123 Education Lane, Knowledge City</p>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase text-gray-400">Invoice</h2>
            <p className="text-sm text-gray-500"># {invoiceData.invoiceNumber}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="font-semibold text-gray-500 mb-1">Bill To:</h3>
            <p className="font-bold">{invoiceData.studentName}</p>
            <p className="text-gray-600">Student ID: {invoiceData.studentId}</p>
          </div>
          <div className="text-right">
            <p><span className="font-semibold text-gray-500">Issue Date:</span> {invoiceData.issueDate}</p>
            <p><span className="font-semibold text-gray-500">Due Date:</span> {invoiceData.dueDate}</p>
            <div className="mt-2"><span className="font-semibold text-gray-500">Status:</span> <Badge variant={invoiceData.status === 'Paid' ? 'default' : 'destructive'} className={invoiceData.status === 'Paid' ? 'bg-green-600' : ''}>{invoiceData.status}</Badge></div>
          </div>
        </section>

        <section>
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[70%]">Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceData.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">₹{item.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <footer className="mt-8 flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Amount</span>
              <span>₹{invoiceData.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </footer>

        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Thank you for your payment!</p>
          <p>For any queries regarding this invoice, please contact the accounts department.</p>
        </div>
      </div>
    );
  }
);
InvoiceDisplay.displayName = "InvoiceDisplay";
