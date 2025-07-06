
'use server';
/**
 * @fileOverview A flow for generating various types of emails.
 *
 * - sendPaymentReceiptEmail - Generates and "sends" a payment receipt email.
 * - sendInvoiceEmail - Generates and "sends" an invoice email.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const EmailOutputSchema = z.object({
  to: z.string().email().describe("The recipient's email address."),
  subject: z.string().describe('The subject line of the email.'),
  body: z.string().describe('The HTML body of the email.'),
});
type EmailOutput = z.infer<typeof EmailOutputSchema>;


// --- PAYMENT RECEIPT FLOW ---

const PaymentReceiptInputSchema = z.object({
  studentName: z.string().describe('The full name of the student.'),
  studentEmail: z.string().email().describe('The email address of the student.'),
  amount: z.number().describe('The amount of the payment made.'),
  transactionId: z.string().describe('The UPI or bank transaction reference ID.'),
  paymentDate: z.string().describe('The date of the payment in ISO format.'),
  totalFees: z.number().describe('The total fees for the semester/year.'),
  totalPaid: z.number().describe('The total amount paid so far, confirmed by admin.'),
  balance: z.number().describe('The remaining fee balance.'),
});
type PaymentReceiptInput = z.infer<typeof PaymentReceiptInputSchema>;


const paymentReceiptPrompt = ai.definePrompt({
    name: 'generatePaymentReceiptEmailPrompt',
    input: { schema: PaymentReceiptInputSchema },
    output: { schema: EmailOutputSchema },
    prompt: `You are an email generation assistant for a college named "EduSphere Institute of Technology".
Your task is to generate a professional HTML email to confirm a student's fee payment submission.
The payment has been submitted by the student and is PENDING VERIFICATION by the accounts department. This is a confirmation of submission, not a final receipt of payment confirmation.

Use the following information:
Student Name: {{{studentName}}}
Student Email: {{{studentEmail}}}
Amount Submitted: {{{amount}}}
Transaction ID: {{{transactionId}}}
Submission Date: {{{paymentDate}}}

Fee Summary (before this payment is verified):
Total Fees: {{{totalFees}}}
Total Amount Paid (verified so far): {{{totalPaid}}}
Remaining Balance (before this payment is verified): {{{balance}}}

Generate the email with the following structure:
1. A polite greeting to the student.
2. A clear statement that their payment submission of ₹{{{amount}}} with Transaction ID {{{transactionId}}} has been received and is pending verification.
3. A summary table of their fee status before this payment is applied.
4. A concluding remark and contact information for the accounts department (accounts@edusphere.edu.in).

The output must be a valid JSON object matching the EmailOutput schema.
The 'body' field must be well-formed HTML. Use basic inline styles for a professional look.
The subject line should be "EduSphere Fee Payment Submission Received".
`,
});

const generatePaymentReceiptFlow = ai.defineFlow(
  {
    name: 'generatePaymentReceiptEmailFlow',
    inputSchema: PaymentReceiptInputSchema,
    outputSchema: EmailOutputSchema,
  },
  async (input) => {
    const { output } = await paymentReceiptPrompt(input);
    if (!output) {
      throw new Error('Failed to generate email content.');
    }
    console.log("--- SIMULATING EMAIL SEND (Payment Receipt) ---");
    console.log(`To: ${output.to}`);
    console.log(`Subject: ${output.subject}`);
    console.log("Body (HTML):\n", output.body);
    console.log("--- END SIMULATION ---");

    return output;
  }
);

export async function sendPaymentReceiptEmail(input: PaymentReceiptInput): Promise<EmailOutput> {
  return generatePaymentReceiptFlow(input);
}


// --- INVOICE EMAIL FLOW ---

const InvoiceEmailInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  studentEmail: z.string().email().describe('The email address of the student.'),
  invoiceNumber: z.string().describe('The invoice number.'),
  issueDate: z.string().describe('The date the invoice was issued.'),
  dueDate: z.string().describe('The due date for the payment.'),
  totalAmount: z.number().describe('The total amount of the invoice.'),
  items: z.array(z.object({
      description: z.string(),
      amount: z.number()
  })).describe('An array of items included in the invoice.')
});
type InvoiceEmailInput = z.infer<typeof InvoiceEmailInputSchema>;


const invoiceEmailPrompt = ai.definePrompt({
    name: 'generateInvoiceEmailPrompt',
    input: { schema: InvoiceEmailInputSchema },
    output: { schema: EmailOutputSchema },
    prompt: `You are an email generation assistant for a college named "EduSphere Institute of Technology".
Your task is to generate a professional HTML email containing a fee invoice.

Use the following information:
Student Name: {{{studentName}}}
Student Email: {{{studentEmail}}}
Invoice Number: {{{invoiceNumber}}}
Issue Date: {{{issueDate}}}
Due Date: {{{dueDate}}}
Total Amount: {{{totalAmount}}}

Invoice Items:
{{#each items}}
- {{{description}}}: ₹{{{amount}}}
{{/each}}

Generate the email with the following structure:
1. A polite greeting to the student.
2. A clear statement that their invoice is attached or detailed below.
3. A summary of the invoice details in a structured format (table preferred).
4. Instructions on how to pay the fees, pointing them to the fees portal.
5. A concluding remark and contact information for the accounts department (accounts@edusphere.edu.in).

The output must be a valid JSON object matching the EmailOutput schema.
The 'body' field must be well-formed HTML. Use basic inline styles for a professional look.
The subject line should be "Invoice from EduSphere Institute of Technology - #{{{invoiceNumber}}}".
`,
});

const generateInvoiceEmailFlow = ai.defineFlow(
  {
    name: 'generateInvoiceEmailFlow',
    inputSchema: InvoiceEmailInputSchema,
    outputSchema: EmailOutputSchema,
  },
  async (input) => {
    const { output } = await invoiceEmailPrompt(input);
    if (!output) {
      throw new Error('Failed to generate invoice email content.');
    }
    // Simulate sending email
    console.log("--- SIMULATING EMAIL SEND (Invoice) ---");
    console.log(`To: ${output.to}`);
    console.log(`Subject: ${output.subject}`);
    console.log("Body (HTML):\n", output.body);
    console.log("--- END SIMULATION ---");

    return output;
  }
);


export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<EmailOutput> {
  return generateInvoiceEmailFlow(input);
}
