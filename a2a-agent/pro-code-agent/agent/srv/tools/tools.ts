import { tool } from "@langchain/core/tools";
import {
    fetchDiscounts,
    fetchPaymentTerms,
    invokeSalesQuotationCreation,
    predictSalesQuotationScores
} from "../utils/sales-service";
import {
    AskExpert,
    AskExpertType,
    GetAllCombinations,
    PaymentTerms,
    PossibleDiscounts,
    SalesQuotation,
    ScoringSalesQuotationOptions
} from "../utils/types";
import { interrupt } from "@langchain/langgraph";

const getPaymentTerms = tool(
    async () => {
        console.log("getPaymentTerms tool called!");
        const paymentTerms = await fetchPaymentTerms();
        return paymentTerms;
    },
    {
        name: "get_payment_terms",
        description: "Get the available payment terms from the system.",
        schema: PaymentTerms
    }
);

const getPossibleDiscounts = tool(
    async () => {
        console.log("getPossibleDiscounts tool called!");
        const discounts = await fetchDiscounts();
        return discounts;
    },
    {
        name: "get_possible_discounts",
        description: "Get the possible discount rates and their descriptions.",
        schema: PossibleDiscounts
    }
);

const getAllCombinations = tool(
    async (input: any) => {
        console.log("getAllCombinations tool called!");
        const { paymentTerms, discounts }: { paymentTerms: string[]; discounts: string[] } = input;
        const combinations = [];
        for (const term of paymentTerms) {
            for (const discount of discounts) {
                combinations.push({ paymentTerm: term, discount: discount });
            }
        }
        return JSON.stringify(combinations);
    },
    {
        name: "get_all_combinations",
        description: "Get all combinations of payment terms and discounts.",
        schema: GetAllCombinations
    }
);

const createSalesQuotation = tool(
    async () => {
        console.log("createSalesQuotation tool called!");
        const createdSalesQuotation = await invokeSalesQuotationCreation();
        return createdSalesQuotation;
    },
    {
        name: "create_sales_quotation",
        description: "Create a sales quotation in the system.",
        schema: SalesQuotation
    }
);

const askExpert = tool(
    async (input: any) => {
        const { questions }: AskExpertType = input;
        const answers = interrupt(questions);
        return { answers };
    },
    {
        name: "ask_expert",
        description:
            "Call this tool whenever you need additional information to e.g. call the other tools (if you miss the information to call them)",
        schema: AskExpert
    }
);

const predictSalesQuotationScoresTool = tool(
    async (input: any) => {
        console.log("predictSalesQuotationScores tool called !");
        const { customerName, salesInquiryID, paymentTermsAndDiscountsCombinations, taskType } = input;

        const options = paymentTermsAndDiscountsCombinations.map((combo: any) => ({
            customerName,
            salesInquiryID,
            paymentTerm: combo.paymentTerm,
            discount: combo.discount
        }));

        const result = await predictSalesQuotationScores(options, taskType);
        return result;
    },
    {
        name: "predict_sales_quotation_scores",
        description:
            "Predict scores for sales quotation option using RPT. Use regression for numeric predictoins (conversion rates, delays, ratings) or classification for categorical predictions. Defaults to classification.",
        schema: ScoringSalesQuotationOptions
    }
);
export const tools = [
    askExpert,
    getPaymentTerms,
    getPossibleDiscounts,
    createSalesQuotation,
    getAllCombinations,
    predictSalesQuotationScoresTool
];
