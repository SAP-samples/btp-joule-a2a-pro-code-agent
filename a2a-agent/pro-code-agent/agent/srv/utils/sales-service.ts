const getExecutionTime = () => 100 + Math.floor(Math.random() * 300);

const fetchPaymentTerms = async (): Promise<{ [key: string]: string }> => {
    await new Promise((resolve) => setTimeout(resolve, getExecutionTime()));
    return {
        "Net 30": "Payment is due 30 days after the invoice date.",
        "Net 60": "Payment is due 60 days after the invoice date.",
        "Net 90": "Payment is due 90 days after the invoice date.",
        EOM: "End of Month. Payment is due by the end of the calendar month in which the invoice was issued.",
        COD: "Cash on Delivery. Payment is due upon the receipt of goods.",
        PIA: "Payment in Advance. The customer must pay before the goods or services are delivered.",
        CBS: "Cash before Shipment. Payment is due before the goods are shipped.",
        CWO: "Cash with Order. Payment is due at the time the order is placed."
    };
};

const fetchDiscounts = async (): Promise<{ discounts: { value: number; label: string; description: string }[] }> => {
    await new Promise((resolve) => setTimeout(resolve, getExecutionTime()));
    return {
        discounts: [
            { value: 0.0, label: "0%", description: "No down payment - only for established enterprise clients" },
            { value: 0.1, label: "10%", description: "Small deposit - for ongoing projects or trusted partners" },
            { value: 0.2, label: "20%", description: "Standard for B2B services or software projects" }
        ]
    };
};

const invokeSalesQuotationCreation = async (): Promise<{ success: boolean }> => {
    await new Promise((resolve) => setTimeout(resolve, getExecutionTime()));
    // call s4 system to create sales quotation
    return { success: true };
};

const salesData = () => [
    {
        __row_idx__: "1",
        customerName: "Altinova",
        salesInquiryID: "100",
        paymentTerm: "Net 30",
        discount: "10%",
        conversionRate: "85",
        paymentDelayDays: "90",
        dealRating: "85",
        product: "Computer",
        currency: "EUR",
        amount: "1200"
    },
    {
        __row_idx__: "2",
        customerName: "Global tech",
        salesInquiryID: "101",
        paymentTerm: "Net 90",
        discount: "20%",
        conversionRate: "90",
        paymentDelayDays: "90",
        dealRating: "90",
        product: "Laptop",
        currency: "USD",
        amount: "999.99"
    },
    {
        __row_idx__: "3",
        customerName: "Tech Forward",
        salesInquiryID: "102",
        paymentTerm: "COD",
        discount: "30%",
        conversionRate: "95",
        paymentDelayDays: "0",
        dealRating: "95",
        product: "Wireless Router",
        currency: "EUR",
        amount: "89.99"
    },
    {
        __row_idx__: "4",
        customerName: "Global tech",
        salesInquiryID: "103",
        paymentTerm: "PIA",
        discount: "20%",
        conversionRate: "98",
        paymentDelayDays: "0",
        dealRating: "98",
        product: "Mackbook",
        currency: "USD",
        amount: "750"
    },
    {
        __row_idx__: "5",
        customerName: "Data Dynamics",
        salesInquiryID: "104",
        paymentTerm: "Net 30",
        discount: "10%",
        conversionRate: "95",
        paymentDelayDays: "80",
        dealRating: "95",
        product: "Server Rack",
        currency: "USD",
        amount: "1200"
    },
    {
        __row_idx__: "6",
        customerName: "Enterprise Solutions",
        salesInquiryID: "105",
        paymentTerm: "Net 90",
        discount: "10%",
        conversionRate: "90",
        paymentDelayDays: "90",
        dealRating: "91",
        product: "Desktop Computer",
        currency: "USD",
        amount: "750.5"
    },
    {
        __row_idx__: "7",
        customerName: "Consumer Electronics",
        salesInquiryID: "106",
        paymentTerm: "Net 30",
        discount: "10%",
        conversionRate: "97",
        paymentDelayDays: "10",
        dealRating: "98",
        product: "Smartphone",
        currency: "EUR",
        amount: "499.9"
    },
    {
        __row_idx__: "8",
        customerName: "Acme Corp",
        salesInquiryID: "107",
        paymentTerm: "Net30",
        discount: "20%",
        conversionRate: "96",
        paymentDelayDays: "80",
        dealRating: "95",
        product: "Laptop",
        currency: "USD",
        amount: "999.99"
    }
];

// Types
interface SalesDataType {
    __row_idx__: string;
    customerName: string;
    salesInquiryID: string;
    paymentTerm: string;
    discount: string;
    conversionRate: string;
    paymentDelayDays: string;
    dealRating: string;
    product: string;
    currency: string;
    amount: string;
}

interface TargetColumn {
    name: string;
    prediction_placeholder: string;
    task_type?: "regression" | "classification";
}

interface PredictionConfig {
    target_columns: TargetColumn[];
}

interface SalesQuotationOption {
    customerName: string;
    salesInquiryID: string;
    paymentTerm: string;
    discount: string;
    product?: string;
    currency?: string;
    amount?: string;
}

//RPT call Regression
const RPT_CALL_REGRESSION = async (
    prediction_config: PredictionConfig,
    index_column: string,
    rows: SalesDataType[]
): Promise<string> => {
    const { RptClient } = require("@sap-ai-sdk/rpt");
    const rptClient = new RptClient();

    const schema = [
        { name: "__row_idx__", dtype: "string" },
        { name: "customerName", dtype: "string" },
        { name: "salesInquiryID", dtype: "string" },
        { name: "paymentTerm", dtype: "string" },
        { name: "discount", dtype: "string" },
        { name: "conversionRate", dtype: "numeric" },
        { name: "paymentDelayDays", dtype: "numeric" },
        { name: "dealRating", dtype: "numeric" },
        { name: "product", dtype: "string" },
        { name: "currency", dtype: "string" },
        { name: "amount", dtype: "string" }
    ] as const;

    const historicalData = salesData();

    const targets = prediction_config.target_columns.map((col) => ({
        ...col,
        task_type: col.task_type || ("regression" as const)
    }));

    const rptResponse = await rptClient.predictWithSchema(schema, {
        prediction_config: { target_columns: targets },
        index_column,
        rows: [...rows, ...historicalData]
    });

    return JSON.stringify(rptResponse);
};

//RPT call classification
const RPT_CALL_CLASSIFICATION = async (
    prediction_config: PredictionConfig,
    index_column: string,
    rows: SalesDataType[]
): Promise<string> => {
    const { RptClient } = require("@sap-ai-sdk/rpt");
    const rptClient = new RptClient();

    const schema = [
        { name: "__row_idx__", dtype: "string" },
        { name: "customerName", dtype: "string" },
        { name: "salesInquiryID", dtype: "string" },
        { name: "paymentTerm", dtype: "string" },
        { name: "discount", dtype: "string" },
        { name: "conversionRate", dtype: "numeric" },
        { name: "paymentDelayDays", dtype: "numeric" },
        { name: "dealRating", dtype: "numeric" },
        { name: "product", dtype: "string" },
        { name: "currency", dtype: "string" },
        { name: "amount", dtype: "string" }
    ] as const;

    const historicalData = salesData();

    const targets = prediction_config.target_columns.map((col) => ({
        ...col,
        task_type: col.task_type || ("classification" as const)
    }));

    const rptResponse = await rptClient.predictWithSchema(schema, {
        prediction_config: { target_columns: targets },
        index_column,
        rows: [...rows, ...historicalData]
    });

    return JSON.stringify(rptResponse);
};

//
const predictSalesQuotationScores = async (
    options: SalesQuotationOption[],
    taskType: "regression" | "classification" = "classification"
): Promise<string> => {
    const rows: SalesDataType[] = options.map((option, idx) => ({
        __row_idx__: `query_${idx + 1}`,
        customerName: option.customerName,
        salesInquiryID: option.salesInquiryID,
        paymentTerm: option.paymentTerm,
        discount: option.discount,
        conversionRate: "[PREDICT]",
        paymentDelayDays: "[PREDICT]",
        dealRating: "[PREDICT]",
        product: option.product || "unknown",
        currency: option.currency || "USD",
        amount: option.amount || "0"
    }));

    const predictionConfig = {
        target_columns: [
            { name: "conversionRate", prediction_placeholder: "[PREDICT]" },
            { name: "paymentDelayDays", prediction_placeholder: "[PREDICT]" },
            { name: "dealRating", prediction_placeholder: "[PREDICT]" }
        ]
    };

    if (taskType === "classification") {
        return await RPT_CALL_CLASSIFICATION(predictionConfig, "__row_idx__", rows);
    } else {
        return await RPT_CALL_REGRESSION(predictionConfig, "__row_idx__", rows);
    }
};

export {
    fetchPaymentTerms,
    fetchDiscounts,
    invokeSalesQuotationCreation,
    salesData,
    RPT_CALL_REGRESSION,
    RPT_CALL_CLASSIFICATION,
    predictSalesQuotationScores
};
