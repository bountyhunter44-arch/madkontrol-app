/**
 * Financial Limits Policy Boxes
 * Payment and credit limit compliance rules
 */

const financialLimitsBoxes = [
    {
        id: 'payment_validation',
        name: 'Betalingsvalidering',
        domain: 'financial',
        ruleFamily: 'payment_control',
        tags: ['payment', 'validation', 'financial'],
        rules: [
            {
                id: 'payment_amount_positive',
                message: 'Betalingsbeløb skal være positivt',
                severity: 'critical',
                evaluate: (input) => {
                    const amount = input.amount || input.paymentAmount;
                    
                    if (amount === null || amount === undefined) {
                        return {
                            passed: false,
                            message: 'Beløb ikke angivet',
                            value: null,
                            threshold: 0
                        };
                    }
                    
                    const passed = amount > 0;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Beløb OK: ${amount}` 
                            : `Ugyldigt beløb: ${amount} (skal være > 0)`,
                        value: amount,
                        threshold: 0
                    };
                }
            },
            {
                id: 'payment_amount_reasonable',
                message: 'Betalingsbeløb skal være rimeligt',
                severity: 'high',
                evaluate: (input) => {
                    const amount = input.amount || input.paymentAmount;
                    const maxAmount = input.maxAmount || 1000000; // Default 1M
                    
                    if (amount === null || amount === undefined) {
                        return {
                            passed: false,
                            message: 'Beløb ikke angivet',
                            value: null,
                            threshold: maxAmount
                        };
                    }
                    
                    const passed = amount <= maxAmount;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Beløb inden for grænse: ${amount}` 
                            : `Beløb for højt: ${amount} (max: ${maxAmount})`,
                        value: amount,
                        threshold: maxAmount
                    };
                }
            }
        ]
    },

    {
        id: 'credit_limit_control',
        name: 'Kreditgrænse Kontrol',
        domain: 'financial',
        ruleFamily: 'credit_control',
        tags: ['credit', 'limit', 'financial'],
        rules: [
            {
                id: 'credit_limit_not_exceeded',
                message: 'Kreditgrænse må ikke overskrides',
                severity: 'critical',
                evaluate: (input) => {
                    const currentCredit = input.currentCredit || input.usedCredit || 0;
                    const creditLimit = input.creditLimit || input.maxCredit;
                    const newAmount = input.amount || input.newPurchase || 0;
                    
                    if (creditLimit === null || creditLimit === undefined) {
                        return {
                            passed: false,
                            message: 'Kreditgrænse ikke defineret',
                            value: null,
                            threshold: null
                        };
                    }
                    
                    const totalCredit = currentCredit + newAmount;
                    const passed = totalCredit <= creditLimit;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Kredit OK: ${totalCredit} / ${creditLimit}` 
                            : `Kreditgrænse overskredet: ${totalCredit} > ${creditLimit}`,
                        value: totalCredit,
                        threshold: creditLimit
                    };
                }
            },
            {
                id: 'credit_utilization_warning',
                message: 'Advarsel ved høj kreditanvendelse (>80%)',
                severity: 'medium',
                evaluate: (input) => {
                    const currentCredit = input.currentCredit || input.usedCredit || 0;
                    const creditLimit = input.creditLimit || input.maxCredit;
                    const newAmount = input.amount || input.newPurchase || 0;
                    
                    if (creditLimit === null || creditLimit === undefined || creditLimit === 0) {
                        return {
                            passed: true,
                            message: 'Ingen kreditgrænse defineret'
                        };
                    }
                    
                    const totalCredit = currentCredit + newAmount;
                    const utilizationPercent = (totalCredit / creditLimit) * 100;
                    const passed = utilizationPercent <= 80;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Kreditanvendelse OK: ${utilizationPercent.toFixed(1)}%` 
                            : `Høj kreditanvendelse: ${utilizationPercent.toFixed(1)}% (advarsel ved >80%)`,
                        value: utilizationPercent,
                        threshold: 80
                    };
                }
            }
        ]
    },

    {
        id: 'invoice_validation',
        name: 'Fakturavalidering',
        domain: 'financial',
        ruleFamily: 'invoice_control',
        tags: ['invoice', 'validation', 'financial'],
        rules: [
            {
                id: 'invoice_has_recipient',
                message: 'Faktura skal have modtager',
                severity: 'critical',
                evaluate: (input) => {
                    const recipient = input.recipient || input.customerId || input.customerName;
                    
                    const passed = Boolean(recipient);
                    
                    return {
                        passed,
                        message: passed 
                            ? 'Modtager OK' 
                            : 'Faktura mangler modtager',
                        value: recipient,
                        threshold: 'required'
                    };
                }
            },
            {
                id: 'invoice_has_due_date',
                message: 'Faktura skal have forfaldsdato',
                severity: 'high',
                evaluate: (input) => {
                    const dueDate = input.dueDate || input.paymentDue;
                    
                    const passed = Boolean(dueDate);
                    
                    return {
                        passed,
                        message: passed 
                            ? 'Forfaldsdato OK' 
                            : 'Faktura mangler forfaldsdato',
                        value: dueDate,
                        threshold: 'required'
                    };
                }
            },
            {
                id: 'invoice_due_date_future',
                message: 'Forfaldsdato skal være i fremtiden',
                severity: 'medium',
                evaluate: (input) => {
                    const dueDate = input.dueDate || input.paymentDue;
                    
                    if (!dueDate) {
                        return {
                            passed: false,
                            message: 'Forfaldsdato ikke angivet',
                            value: null,
                            threshold: 'future'
                        };
                    }
                    
                    const dueDateObj = new Date(dueDate);
                    const now = new Date();
                    const passed = dueDateObj > now;
                    
                    return {
                        passed,
                        message: passed 
                            ? 'Forfaldsdato i fremtiden' 
                            : 'Forfaldsdato er i fortiden',
                        value: dueDate,
                        threshold: now.toISOString()
                    };
                }
            }
        ]
    }
];

export default financialLimitsBoxes;
