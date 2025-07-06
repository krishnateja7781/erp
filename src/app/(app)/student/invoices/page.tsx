
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Eye, Download, FileText, Loader2, Mail } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { InvoiceDisplay, type InvoiceData } from '@/components/student/invoice-display';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { getStudentInvoices, sendInvoiceByEmail } from '@/actions/fee-actions';

export default function StudentInvoicesPage() {
  const [invoices, setInvoices] = React.useState<InvoiceData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceData | null>(null);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    const loadInvoices = async () => {
        setIsLoading(true);
        const storedUserString = localStorage.getItem('loggedInUser');
        if (!storedUserString) {
            toast({ variant: "destructive", title: "Error", description: "Could not identify student." });
            setIsLoading(false);
            return;
        }
        const user = JSON.parse(storedUserString);

        try {
            const fetchedInvoices = await getStudentInvoices(user.id);
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Failed to fetch invoices:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load your invoices." });
        } finally {
            setIsLoading(false);
        }
    };
    loadInvoices();
  }, [toast]);


  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
      case 'pending': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Pending</Badge>;
      case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !selectedInvoice) {
        toast({ variant: "destructive", title: "Error", description: "Invoice content is not available for download." });
        return;
    }
    toast({ title: "Info", description: "Generating PDF..." });
    try {
        const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = imgProps.width;
        const imgHeight = imgProps.height;
        const ratio = Math.min((pdfWidth - 40) / imgWidth, (pdfHeight - 40) / imgHeight);
        const newImgWidth = imgWidth * ratio;
        const newImgHeight = imgHeight * ratio;
        const xOffset = (pdfWidth - newImgWidth) / 2;
        const yOffset = (pdfHeight - newImgHeight) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, newImgWidth, newImgHeight);
        pdf.save(`invoice_${selectedInvoice.invoiceNumber}.pdf`);
        toast({ title: "Success", description: "Invoice downloaded as PDF." });
    } catch (e) {
        console.error("PDF Generation Error:", e);
        toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF."});
    }
  };
  
  const handleSendEmail = async () => {
    if (!selectedInvoice) return;
    setIsSendingEmail(true);
    const result = await sendInvoiceByEmail(selectedInvoice);
    if(result.success) {
      toast({ title: 'Email Sent', description: result.message });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSendingEmail(false);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading invoices...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Invoices</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>A record of all your past and present fee invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length > 0 ? invoices.map((invoice) => (
                <TableRow key={invoice.invoiceNumber}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.issueDate}</TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>₹{invoice.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-8">No invoices found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0">
            <DialogHeader className="p-4 sm:p-6 border-b">
                <DialogTitle className="flex items-center gap-2"><FileText /> Invoice: {selectedInvoice?.invoiceNumber}</DialogTitle>
                <DialogDescription>
                    Student: {selectedInvoice?.studentName} ({selectedInvoice?.studentId})
                </DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
                <>
                    <div className="flex-grow overflow-y-auto bg-white p-4 sm:p-6">
                        <InvoiceDisplay ref={invoiceRef} invoiceData={selectedInvoice} />
                    </div>
                    <DialogFooter className="p-4 sm:p-6 border-t flex-shrink-0">
                        <Button variant="secondary" onClick={handleSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4" />}
                            Send to Email
                        </Button>
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                        <Button onClick={handleDownloadPdf}>
                            <Download className="mr-2 h-4 w-4" /> Download as PDF
                        </Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
