
'use client'; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, AlertCircle, Clock, Info, Download, Loader2, QrCode, Hourglass, ShieldCheck, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import Image from "next/image";
import { submitPaymentConfirmation } from "@/actions/fee-actions";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";


type PaymentHistoryEntry = {
    date: string;
    amount: number;
    reference: string;
    status: string;
};

type FeesData = {
    totalFees: number;
    amountPaid: number;
    dueDate: string | null;
    paymentHistory: PaymentHistoryEntry[];
};

type UserData = {
    id: string; // student document ID from Firestore
    name: string;
    email: string;
    collegeId: string;
};


// --- Utility Functions ---
const isValidDate = (dateString: string | null | undefined): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

const calculateRemainingBalance = (total?: number | null, paid?: number | null): number => {
    const numTotal = (typeof total === 'number' && !isNaN(total) && total >= 0) ? total : 0;
    const numPaid = (typeof paid === 'number' && !isNaN(paid) && paid >= 0) ? paid : 0;
    return Math.max(0, numTotal - numPaid);
};

const StatusIcon = ({ status }: { status: string | null | undefined }) => {
  switch (status?.toLowerCase()) {
    case "success": return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "pending confirmation":
    case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-600" />;
    default: return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

// --- Amount Entry Dialog ---
const createAmountEntrySchema = (maxAmount: number) => z.object({
    amount: z.coerce
        .number({ invalid_type_error: "Please enter a valid number." })
        .positive({ message: "Amount must be greater than zero." })
        .max(maxAmount, { message: `Amount cannot exceed the remaining balance of ₹${maxAmount.toLocaleString()}` }),
});

function AmountEntryDialog({
    isOpen,
    onOpenChange,
    remainingBalance,
    onProceed,
    studentName,
    studentCollegeId
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    remainingBalance: number;
    onProceed: (amount: number) => void;
    studentName: string;
    studentCollegeId: string;
}) {
    const amountEntrySchema = createAmountEntrySchema(remainingBalance);
    const form = useForm<z.infer<typeof amountEntrySchema>>({
        resolver: zodResolver(amountEntrySchema),
        defaultValues: { amount: undefined },
    });

    function onSubmit(values: z.infer<typeof amountEntrySchema>) {
        onProceed(values.amount);
    }
    
    // Reset form when dialog opens
    React.useEffect(() => {
        if(isOpen) {
            form.reset({ amount: undefined });
        }
    }, [isOpen, form]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Make a Payment</DialogTitle>
                    <DialogDescription>Enter the amount you wish to pay towards your fees.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="text-sm">
                        <p><span className="font-medium text-muted-foreground">Student Name:</span> {studentName}</p>
                        <p><span className="font-medium text-muted-foreground">College ID:</span> {studentCollegeId}</p>
                        <p className="font-bold text-lg mt-2">Remaining Balance: <span className="text-destructive">₹{remainingBalance.toLocaleString()}</span></p>
                    </div>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} id="amount-entry-form" className="space-y-4">
                             <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount to Pay *</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">₹</span>
                                                <Input
                                                  type="number"
                                                  placeholder="0.00"
                                                  className="pl-7"
                                                  {...field}
                                                  value={field.value ?? ''}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                             />
                        </form>
                    </Form>
                </div>
                <DialogFooter>
                     <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                     <Button type="submit" form="amount-entry-form">Proceed to Pay</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


// --- Payment Dialog Component ---
type PaymentStatus = 'AwaitingPayment' | 'Verifying' | 'Success' | 'Error';

function PaymentDialog({ 
    isOpen, 
    onOpenChange, 
    paymentDetails, 
    studentDetails,
    onPaymentConfirmed 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    paymentDetails: { amount: number };
    studentDetails: UserData;
    onPaymentConfirmed: () => void;
}) {
    const { toast } = useToast();
    const [status, setStatus] = React.useState<PaymentStatus>('AwaitingPayment');
    const [timeLeft, setTimeLeft] = React.useState(120); // 2 minutes in seconds
    const transactionIdRef = React.useRef<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = React.useState('');

    // Use a ref to hold the latest status, to avoid stale closures in setTimeout
    const statusRef = React.useRef(status);
    React.useEffect(() => {
        statusRef.current = status;
    }, [status]);
    
    const handlePaymentVerification = React.useCallback(async () => {
        if (!transactionIdRef.current) return;
        
        setStatus('Verifying');
        
        try {
            const result = await submitPaymentConfirmation({
                studentDocId: studentDetails.id,
                studentName: studentDetails.name,
                studentEmail: studentDetails.email,
                amount: paymentDetails.amount,
                reference: transactionIdRef.current,
            });

            if (result.success) {
                setStatus('Success');
                toast({ title: "Payment Submitted", description: result.message });
                onPaymentConfirmed();
                setTimeout(() => onOpenChange(false), 3000);
            } else {
                setStatus('Error');
                toast({ variant: "destructive", title: "Submission Failed", description: result.error });
            }
        } catch (e: any) {
            setStatus('Error');
            toast({ variant: "destructive", title: "Error", description: e.message || "An unexpected error occurred." });
        }
    }, [studentDetails, paymentDetails.amount, toast, onPaymentConfirmed, onOpenChange]);


    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        let paymentSimulationTimeout: NodeJS.Timeout;

        if (isOpen && paymentDetails.amount > 0) {
            // Reset state on open
            setStatus('AwaitingPayment');
            setTimeLeft(120);
            setQrCodeUrl('');
            
            // Generate a unique transaction ID and QR Code for this session
            const newTransactionId = `TXN${studentDetails.collegeId}${Date.now()}`;
            transactionIdRef.current = newTransactionId;
            const upiData = `upi://pay?pa=6301770806@ibl&pn=EduSphere%20Institute&am=${paymentDetails.amount}&tid=${newTransactionId}`;
            setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiData)}`);
            
            // Start countdown timer
            timer = setInterval(() => {
                setTimeLeft(prevTime => {
                    if (prevTime <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
            
            // Simulate automatic payment detection after a delay
            paymentSimulationTimeout = setTimeout(() => {
                // Use the ref to check the most current status
                if (statusRef.current === 'AwaitingPayment') {
                    handlePaymentVerification();
                }
            }, 12000);

            return () => {
                clearInterval(timer);
                clearTimeout(paymentSimulationTimeout);
            };
        }
    }, [isOpen, studentDetails, paymentDetails.amount, handlePaymentVerification]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const renderContent = () => {
        switch (status) {
            case 'AwaitingPayment':
                if (timeLeft === 0) {
                    return <><AlertCircle className="h-16 w-16 text-destructive" /><p className="mt-4 text-lg">Session Expired</p><p className="text-sm text-muted-foreground">Please close and try again.</p></>;
                }
                return (
                    <>
                      {qrCodeUrl ? (
                        <Image src={qrCodeUrl} alt="UPI QR Code to scan for payment" width={250} height={250} data-ai-hint="upi payment qr code" unoptimized />
                      ) : (
                        <div className="w-[250px] h-[250px] bg-muted flex items-center justify-center rounded-md">
                           <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                      <p className="text-sm font-semibold">UPI ID: <span className="font-mono text-primary">6301770806@ibl</span></p>
                      <p className="text-sm text-muted-foreground mt-2">Scan with any UPI app to pay. This session will expire.</p>
                      <p className="text-lg font-bold text-destructive">
                          <Hourglass className="inline-block mr-2 h-5 w-5" />
                          {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                      </p>
                    </>
                );
            case 'Verifying':
                return <><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="mt-4 text-lg">Verifying your payment...</p></>;
            case 'Success':
                return <><CheckCircle className="h-16 w-16 text-green-500" /><p className="mt-4 text-lg">Payment Submitted for Verification!</p><p className="text-sm text-muted-foreground">This dialog will close shortly.</p></>;
            case 'Error':
                 return <><AlertCircle className="h-16 w-16 text-destructive" /><p className="mt-4 text-lg">Payment Failed</p><p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p></>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-primary"/> Secure Payment Gateway</DialogTitle>
                    <DialogDescription>
                        Complete your payment of ₹{paymentDetails.amount.toLocaleString()} for student ID {studentDetails.collegeId}.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center gap-4 py-8 min-h-[350px]">
                    {renderContent()}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page Component ---
export default function StudentFeesPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<UserData | null>(null);
  const [currentFeesData, setCurrentFeesData] = React.useState<FeesData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAmountEntryOpen, setIsAmountEntryOpen] = React.useState(false);
  const [isPaymentGatewayOpen, setIsPaymentGatewayOpen] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState(0);
  const paymentHistoryRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (storedUserString) {
        const user = JSON.parse(storedUserString);
        setCurrentUser(user);
    } else {
        setIsLoading(false);
        toast({variant: "destructive", title: "Authentication Error", description: "Please log in to view your fees."})
    }
  }, [toast]);
  
  React.useEffect(() => {
    if (!currentUser?.id) return;
    
    const feeDocRef = doc(db, "fees", currentUser.id);
    const unsubscribe = onSnapshot(feeDocRef, (docSnap) => {
        if(docSnap.exists()){
            const data = docSnap.data();
            setCurrentFeesData({
                totalFees: data.totalFees || 0,
                amountPaid: data.amountPaid || 0,
                dueDate: data.dueDate ? data.dueDate.toDate().toISOString() : null,
                paymentHistory: (data.paymentHistory || []).map((p: any) => ({
                    ...p,
                    date: p.date.toDate().toISOString(),
                })).sort((a: PaymentHistoryEntry, b: PaymentHistoryEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            });
        } else {
             toast({variant: "destructive", title: "Fee Record Error", description: "Fee details not available for your account. Please contact administration."});
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching fees data:", error);
        toast({variant: "destructive", title: "Error", description: "Could not fetch your fee information."});
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, toast]);


  const remainingBalance = calculateRemainingBalance(currentFeesData?.totalFees, currentFeesData?.amountPaid);
  const isDueDateValid = isValidDate(currentFeesData?.dueDate);
  const isOverdue = isDueDateValid && currentFeesData?.dueDate && new Date() > new Date(currentFeesData.dueDate) && remainingBalance > 0;

  const handleOpenAmountDialog = () => {
      if (remainingBalance > 0) {
        setIsAmountEntryOpen(true);
      } else {
           toast({ title: "No Payment Due", description: "Your fee balance is clear.", duration: 3000 });
      }
  };

  const handleProceedToPayment = (amount: number) => {
    setPaymentAmount(amount);
    setIsAmountEntryOpen(false);
    setIsPaymentGatewayOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!paymentHistoryRef.current) {
      toast({ variant: "destructive", title: "Error", description: "Could not find payment history to download." });
      return;
    }
    toast({ title: "Info", description: "Generating PDF..." });

    const canvas = await html2canvas(paymentHistoryRef.current, { scale: 2, backgroundColor: null, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = imgProps.width;
    const imgHeight = imgProps.height;
    
    const ratio = pdfWidth / imgWidth;
    const finalImgHeight = imgHeight * ratio;
    
    let position = 15; // Start with some margin
    if (finalImgHeight < (pdfHeight - 30)) { // Check if it fits with margins
       position = (pdfHeight - finalImgHeight) / 2;
    }
    
    // Add a title to the PDF
    pdf.setFontSize(18);
    pdf.text("Fee Payment History", pdfWidth / 2, 15, { align: 'center' });

    pdf.addImage(imgData, 'PNG', 10, position + 10, pdfWidth - 20, finalImgHeight - 20); // Add with padding
    if (currentUser) {
        pdf.save(`fee-payment-history-${currentUser.id}.pdf`);
    }
    toast({ title: "Success", description: "Payment history downloaded." });
  };
  
   const handleRefreshData = () => {
        // Data refreshes automatically with onSnapshot, so this can be a no-op or just for user feedback.
        toast({title: "Info", description: "Data is live and up-to-date."});
   };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><span>Loading Fee Details...</span></div>;
  }
  
  if (!currentFeesData || !currentUser) {
     return <div className="text-center text-muted-foreground py-10">Fee details not available for your account. Please contact administration.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Fees</h1>
      <Card>
        <CardHeader>
          <CardTitle>Fees Summary</CardTitle>
          <CardDescription>Overview of your current fee status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
           <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Fees</p>
               <p className="text-2xl font-semibold">₹{currentFeesData.totalFees.toLocaleString()}</p>
            </div>
             <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Amount Paid</p>
               <p className="text-2xl font-semibold text-green-600">₹{currentFeesData.amountPaid.toLocaleString()}</p>
            </div>
             <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Remaining Balance</p>
                <p className={`text-2xl font-semibold ${remainingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    ₹{remainingBalance.toLocaleString()}
                </p>
                 {remainingBalance > 0 && isDueDateValid && currentFeesData.dueDate && (
                    <p className="text-xs text-muted-foreground">Due Date: {new Date(currentFeesData.dueDate).toLocaleDateString()}</p>
                )}
                {isOverdue && <Badge variant="destructive" className="mt-1">Overdue</Badge>}
             </div>
        </CardContent>
         {remainingBalance > 0 && (
             <CardContent className="pt-0">
                  <Button onClick={handleOpenAmountDialog} disabled={remainingBalance <= 0}>
                     <CreditCard className="mr-2 h-4 w-4" /> Pay Now
                 </Button>
             </CardContent>
         )}
         {remainingBalance <= 0 && (
             <CardContent className="pt-0 text-sm text-green-600 font-medium">
                 Fees fully paid. No balance due.
             </CardContent>
         )}
      </Card>

       <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>Record of your past fee payments.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4"/> Download PDF
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div ref={paymentHistoryRef} className="p-4 bg-background">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Amount Paid</TableHead><TableHead>Reference ID</TableHead><TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentFeesData.paymentHistory.length > 0 ? currentFeesData.paymentHistory.map((payment, index) => (
                    <TableRow key={payment.reference || index}>
                      <TableCell>{isValidDate(payment.date) ? new Date(payment.date).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell className="font-medium">₹{payment.amount?.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.reference || <span className="italic">[N/A]</span>}</TableCell>
                      <TableCell className="text-right">
                         <div className="flex items-center justify-end gap-2">
                             <StatusIcon status={payment.status} />
                              <span className={
                                 payment.status?.toLowerCase() === 'success' ? 'text-green-600' :
                                 payment.status?.toLowerCase().startsWith('pending') ? 'text-yellow-600' :
                                 payment.status?.toLowerCase() === 'failed' ? 'text-red-600' : 'text-muted-foreground'
                             }>{payment.status || 'Unknown'}</span>
                         </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                     <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No payment history found.
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <AmountEntryDialog
        isOpen={isAmountEntryOpen}
        onOpenChange={setIsAmountEntryOpen}
        remainingBalance={remainingBalance}
        onProceed={handleProceedToPayment}
        studentName={currentUser.name}
        studentCollegeId={currentUser.collegeId}
      />

      {currentUser && (
        <PaymentDialog 
            isOpen={isPaymentGatewayOpen}
            onOpenChange={setIsPaymentGatewayOpen}
            paymentDetails={{amount: paymentAmount}}
            studentDetails={currentUser}
            onPaymentConfirmed={handleRefreshData}
        />
      )}
    </div>
  );
}
