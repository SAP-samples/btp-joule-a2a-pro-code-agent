import * as z from "zod";

const SalesQuotationCreationResponse = z.object({
    success: z.boolean().describe("Indicates whether the sales quotation was created successfully")
});

// Defining tool input schemas

const PaymentTerms = z.object({
    customerName: z.string().describe("Name of the customer who made the order inquiry."),
    salesInquiryID: z.string().describe("The sales inquiry id for which the payment terms are requested.")
});

const PossibleDiscounts = z.object({
    customerName: z.string().describe("Name of the customer who made the order inquiry.")
});

const GetAllCombinations = z.object({
    paymentTerms: z.array(z.string().describe("All possible payment terms for this customer")),
    discounts: z.array(z.string().describe("All possible discount rates for this customer"))
});

const SalesQuotation = z.object({});

const AskExpert = z.object({
    questions: z.string().describe("The information needed from the expert (formulated as a question/questions).")
});
type AskExpertType = z.infer<typeof AskExpert>;

const ScoringSalesQuotationOptions = z.object({
    customerName: z.string().describe("Name of the customer who made the order inquiry."),
    salesInquiryID: z
        .string()
        .describe("The order ID for which the payment terms and discounts combinations are requested."),
    paymentTermsAndDiscountsCombinations: z.array(
        z.object({
            paymentTerm: z.string().describe("The payment term option for this combination."),
            discount: z.string().describe("The discount option for this combination.")
        })
    ),
    taskType: z
        .enum(["regression", "classification"])
        .optional()
        .describe(
            'Use "regression" for numeric predictions (scores, rates, delays) or "classifiction for categorical predictions (yes/no, risk levels). Defaults to classification.'
        )
});

export {
    AskExpertType,
    AskExpert,
    GetAllCombinations,
    SalesQuotation,
    SalesQuotationCreationResponse,
    PaymentTerms,
    PossibleDiscounts,
    ScoringSalesQuotationOptions
};
