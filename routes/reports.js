const express = require('express');
const router = express.Router();
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Instruction = require('../models/instructionModel');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path'); 

router.get('/downloadPDF/:orderId/:productId/:instructionId/:language/:userId/:userRole', async (req, res) => {
    try {
        const { orderId, productId, instructionId, language, userId, userRole } = req.params;

        // Fetch order
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Fetch product from the order
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ error: 'Product not found in order' });

        // Fetch instruction
        const instruction = await Instruction.findById(instructionId).lean();
        if (!instruction) return res.status(404).json({ error: 'Instruction not found' });

        const languageCode = language || 'en';  // Default to 'en' if language not specified

        const commentsTable = [
            [{ text: 'Comments', style: 'tableHeader', colSpan: 4, alignment: 'left', font: 'NotoSansDevanagari' }, {}, {}, {}],
            [
                { text: 'Step Number', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Comments', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Commented By', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Commented At', style: 'tableHeader', font: 'NotoSansDevanagari' }
            ]
        ];

        // Add comments from each instruction step to the comments table
        instruction.instructions.forEach((step, stepIndex) => {
            step.comments.forEach(comment => {
                commentsTable.push([
                    {
                        text: `${step.step}`,
                        link: `#step-${stepIndex + 1}`, // Link to the step number
                        font: 'NotoSansDevanagari',
                        color: 'blue',
                        decoration: 'underline'
                    },
                    { text: comment.text, font: 'NotoSansDevanagari' },
                    { text: comment.user, font: 'NotoSansDevanagari' },
                    { text: new Date(comment.created_at).toLocaleString(), font: 'NotoSansDevanagari' }
                ]);
            });
        });

        // Prepare table body for PDF
        const tableBody = [
            [{ text: instruction.instruction_name[languageCode], style: 'tableHeader', colSpan: 4, alignment: 'left', font: 'NotoSansDevanagari' }, {}, {}, {}],
            [
                { text: 'Step No', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Step', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Performed By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'QA Verified By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' }
            ]
        ];

        for (const [stepIndex, step] of instruction.instructions.entries()) {
            const executedInfo = step.operator_execution || {};
            const qaInfo = step.qa_execution || {};
        
            const replacePlaceholders = (text, placeholders) => {
                const result = [];
                let lastIndex = 0;
                text = text.replace(/<img[^>]*>/g, '');            // Remove <img> tags
                text = text.replace(/<(tr|td|tbody|table|br|hr)[^>]*>/gi, ''); // Remove specified tags
                text = text.replace(/<\/?(tr|td|tbody|table|br|hr)>/gi, '');
                text = text.replace(/<input[^>]*value="([^"]*)"[^>]*>/gi, '$1'); // Keep input value only
                text = text.replace(/<[^>]+>/g, '');               // Remove remaining tags
                text.replace(/{([^}]+)}/g, (match, key, index) => {
                    if (index > lastIndex) {
                        result.push({ text: text.substring(lastIndex, index) });
                    }
        
                    const placeholder = placeholders[key];
                    if (placeholder) {
                        if (placeholder.type === 'hyperlink') {
                            result.push({
                                text: placeholder.displayText || "Link", // Use displayText if available
                                link: placeholder.value,
                                color: 'blue',
                                decoration: 'underline'
                            });
                        } else {
                            result.push({ text: placeholder.value || '' });
                        }
                    } else {
                        result.push({ text: match });
                    }
        
                    lastIndex = index + match.length;
                });
        
                if (lastIndex < text.length) {
                    result.push({ text: text.substring(lastIndex) });
                }
        
                return result;
            };
        
            // Get the instruction text as an array of objects
            const instructionText = step?.instruction?.[languageCode] || step?.instruction?.en
                ? replacePlaceholders(step.instruction[languageCode] || step.instruction.en, step.placeholders || {})
                : replacePlaceholders("No Instruction Present", step.placeholders || {});
        
            let commentsArray = [];
            if (step.comments && step.comments.length > 0) {
                commentsArray = step.comments.map(comment => {
                    const commentText = replacePlaceholders(comment.text, comment.placeholders || []);
                    return [
                        { text: `\n\nComment: `, bold: true },
                        ...commentText,
                        { text: `\nCommented By: ${comment.user}\nCommented At: ${new Date(comment.created_at).toLocaleString()}` }
                    ];
                }).flat(); 
            }
        
            // Combine instruction text with comments
            const fullInstructionText = [
                ...instructionText, 
                ...commentsArray 
            ];
        
            tableBody.push([
                { text: `${stepIndex + 1}`, font: 'NotoSansDevanagari'},
                { text: fullInstructionText, 
                    font: 'NotoSansDevanagari', 
                    id: `step-${stepIndex + 1}`,
                    noWrap: false,
                    alignment: 'left', 
                    margin: [0, 2, 0, 2]     
                 },
                { text: `${executedInfo.executed_by || ''} ${executedInfo.executed_at ? new Date(executedInfo.executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' },
                { text: `${qaInfo.qa_executed_by || ''} ${qaInfo.qa_executed_at ? new Date(qaInfo.qa_executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' }
            ]);
        }

        // PDF generation setup
        const printer = new PdfPrinter({
            Roboto: {
                normal: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf')),
                bold: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Medium.ttf')),
                italics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Italic.ttf')),
                bolditalics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-MediumItalic.ttf'))
            },
            NotoSansDevanagari: {
                normal: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Regular.ttf')),
                bold: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Regular.ttf'))
            }
        });

        const docDefinition = {
            content: [
                { text: 'Batch Report', style: 'header' },
                {
                    table: {
                        widths: [95, 145, 95, 145],
                        body: [
                            [{ text: 'Order Name' }, { text: order.order_name }, { text: 'Order Number' }, { text: order.id }],
                            [{ text: 'Product Name' }, { text: product.product_name }, { text: 'Product Number' }, { text: product.id }],
                            [{ text: 'Status' }, { text: product.effective ? "Released" : "Not Released" }, { text: 'Version' }, { text: product.version }]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => 'gray',
                        vLineColor: () => 'gray',
                        fillColor: (rowIndex, columnIndex) => (columnIndex % 2 !== 0) ? '#CCCCCC' : null
                    }
                },
                '\n',
                {
                    table: {
                        widths: [80, '*', 80, 120],
                        body: commentsTable
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => 'gray',
                        vLineColor: () => 'gray',
                        fillColor: (rowIndex, columnIndex) => (rowIndex === 0 || rowIndex === 1) ? '#CCCCCC' : null
                    },
                    margin: [0, 0, 0, 10]
                },
                '\n',
                {
                    table: {
                        headerRows: 2,
                        widths: [50, 230, 100, 100],
                        body: tableBody
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => 'gray',
                        vLineColor: () => 'gray',
                        fillColor: (rowIndex, columnIndex) => (rowIndex === 0 || rowIndex === 1) ? '#CCCCCC' : null
                    },
                    margin: [0, 0, 0, 10]
                }
            ],
            footer: (currentPage, pageCount) => ({
                text: `Page ${currentPage} of ${pageCount} | Report downloaded by: ${userId} (${userRole})`,
                alignment: 'center',
                fontSize: 10,
                margin: [0, 0, 0, 20]
            }),
            header: () => ({
                text: `${new Date().toLocaleDateString()}`,
                alignment: 'right',
                margin: [0, 20, 20, 0]
            }),
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: 'center'
                },
                tableHeader: {
                    bold: true,
                    fontSize: 13,
                    color: 'black'
                }
            }
        };

        // Create PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];

        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Disposition', `attachment; filename="Order-${order.id}_Product-${product.id}_Instruction-${instruction.id}.pdf"`);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        pdfDoc.end();
    } catch (err) {
        console.error('Error retrieving order:', err);
        res.status(500).json({ error: 'Failed to retrieve order or product' });
    }
});

router.get('/downloadPDFForOrder/:orderId/:language/:userId/:userRole', async (req, res) => {  
    try {
        const { orderId, language, userId, userRole } = req.params;

        // Fetch the order
        const order = await Order.findById(orderId).lean();
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Fetch all products in the order
        const products = order.products;
        if (!products || products.length === 0) {
            return res.status(404).json({ error: 'No products found for this order' });
        }

        const languageCode = language || 'en';  // Default to 'en' if language not specified

        const printer = new PdfPrinter({
            Roboto: {
                normal: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf')),
                bold: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Medium.ttf')),
                italics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Italic.ttf')),
                bolditalics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-MediumItalic.ttf'))
            },
            NotoSansDevanagari: {
                normal: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Regular.ttf')),
                bold: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Bold.ttf')),
                italics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Regular.ttf')), 
                bolditalics: fs.readFileSync(path.join(process.cwd(), 'public/fonts/NotoSansDevanagari-Bold.ttf')),
            }
        });

        const content = [
            { text: 'Batch Report', style: 'header' },
            {
                table: {
                    widths: [95, 145, 95, 145],
                    body: [
                        [{ text: 'Order Name', style: 'tableHeader' }, { text: order.order_name }, { text: 'Order Number', style: 'tableHeader' }, { text: order._id }],
                    ]
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => 'gray',
                    vLineColor: () => 'gray',
                    fillColor: (rowIndex, columnIndex) => (columnIndex % 2 !== 0) ? '#CCCCCC' : null
                },
                margin: [0, 0, 0, 20]
            }
        ];

        content.push({ text: 'Comments', style: 'header', margin: [0, 0, 0, 10] });
        // Now, continue with the comments tables...
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const productResponse = await Product.findById(product);
            const instruction = await Instruction.findById(productResponse.instruction_id).lean();
            if (!instruction) continue;
        
            // Add product details (name, number, status, version) along with comments in the same structure
            const productTable = [
                [{ text: 'Product Name', style: 'tableHeader' }, { text: productResponse.product_name }, { text: 'Product Number', style: 'tableHeader' }, { text: productResponse._id }],
                [{ text: 'Status', style: 'tableHeader' }, { text: productResponse.effective ? 'Released' : 'Not Released' }, { text: 'Version', style: 'tableHeader' }, { text: productResponse.version }]
            ];
        
            const commentsTable = [
                [
                    { text: 'Step Number', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'Comments', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'Commented By', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'Commented At', style: 'tableHeader', font: 'NotoSansDevanagari' }
                ]
            ];
        
            let hasComments = false;
        
            // Populate comments for the product
            instruction.instructions.forEach((step, stepIndex) => {
                step.comments.forEach(comment => {
                    hasComments = true;
                    commentsTable.push([
                        {
                            text: `${step.step}`,
                            link: `#product-${productResponse._id}-instruction-${instruction._id}-step-${stepIndex + 1}`,
                            font: 'NotoSansDevanagari',
                            color: 'blue',
                            decoration: 'underline'
                        },
                        { text: comment.text, font: 'NotoSansDevanagari' },
                        { text: comment.user, font: 'NotoSansDevanagari' },
                        { text: new Date(comment.created_at).toLocaleString(), font: 'NotoSansDevanagari' }
                    ]);
                });
            });
        
            // If no comments are available
            if (!hasComments) {
                commentsTable.push([
                    { text: 'No Comments Available', colSpan: 4, alignment: 'center', italics: true, margin: [0, 5, 0, 5], font: 'NotoSansDevanagari' },
                    {}, {}, {}
                ]);
            }
        
            // Combine product details and comments table into one
            content.push({
                table: {
                    widths: [95, 145, 95, 145],
                    body: [...productTable, ...commentsTable] // Merge tables
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => 'gray',
                    vLineColor: () => 'gray',
                    fillColor: (rowIndex, columnIndex) => (rowIndex === 0 || rowIndex === 1) ? '#CCCCCC' : null
                },
                margin: [0, 0, 0, 10]
            });
        }
        
        content.push({ text: '', pageBreak: 'before' });
        content.push({ text: 'Products', style: 'header', margin: [0, 0, 0, 10] });

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const productResponse = await Product.findById(product);
            const instruction = await Instruction.findById(productResponse.instruction_id).lean();
            if (!instruction) continue;

            content.push({
                table: {
                    widths: [95, 145, 95, 145],
                    body: [
                        [{ text: 'Product Name', style: 'tableHeader' }, { text: productResponse.product_name }, { text: 'Product Number', style: 'tableHeader' }, { text: productResponse._id }],
                        [{ text: 'Status', style: 'tableHeader' }, { text: productResponse.effective ? "Released" : "Not Released" }, { text: 'Version', style: 'tableHeader' }, { text: productResponse.version }]
                    ]
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => 'gray',
                    vLineColor: () => 'gray',
                    fillColor: (rowIndex, columnIndex) => (rowIndex === 0 || rowIndex === 1) ? '#CCCCCC' : null
                },
                margin: [0, 0, 0, 20]
            });

              // Add instruction steps table for the product (as in the original code)
              const tableBody = [
                [{ text: instruction.instruction_name[languageCode], style: 'tableHeader', colSpan: 4, alignment: 'left', font: 'NotoSansDevanagari' }, {}, {}, {}],
                [
                    { text: 'Step No', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'Step', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'Performed By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' },
                    { text: 'QA Verified By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' }
                ]
            ];

            // Add instruction steps (same logic as before)
            for (const [stepIndex, step] of instruction.instructions.entries()) {
                const executedInfo = step.operator_execution || {};
                const qaInfo = step.qa_execution || {};

                const replacePlaceholders = (text, placeholders) => {
                    const result = [];
                    let lastIndex = 0;
                    text = text.replace(/<img[^>]*>/g, '');            // Remove <img> tags
                    text = text.replace(/<(tr|td|tbody|table|br|hr)[^>]*>/gi, ''); // Remove specified tags
                    text = text.replace(/<\/?(tr|td|tbody|table|br|hr)>/gi, '');
                    text = text.replace(/<input[^>]*value="([^"]*)"[^>]*>/gi, '$1'); // Keep input value only
                    text = text.replace(/<[^>]+>/g, '');               // Remove remaining tags
                    text.replace(/{([^}]+)}/g, (match, key, index) => {
                        if (index > lastIndex) {
                            result.push({ text: text.substring(lastIndex, index) });
                        }
            
                        const placeholder = placeholders[key];
                        if (placeholder) {
                            if (placeholder.type === 'hyperlink') {
                                result.push({
                                    text: placeholder.displayText || "Link", // Use displayText if available
                                    link: placeholder.value,
                                    color: 'blue',
                                    decoration: 'underline'
                                });
                            } else {
                                result.push({ text: placeholder.value || '' });
                            }
                        } else {
                            result.push({ text: match });
                        }
            
                        lastIndex = index + match.length;
                    });
            
                    if (lastIndex < text.length) {
                        result.push({ text: text.substring(lastIndex) });
                    }
            
                    return result;
                };
                
                const instructionText = step?.instruction?.[languageCode] || step?.instruction?.en
                    ? replacePlaceholders(step.instruction[languageCode] || step.instruction.en, step.placeholders || {})
                    : replacePlaceholders("No Instruction Present", step.placeholders || {});

                let commentsArray = [];
                if (step.comments && step.comments.length > 0) {
                    commentsArray = step.comments.map(comment => {
                        const commentText = replacePlaceholders(comment.text, comment.placeholders || []);
                        return [
                            { text: `\n\nComment: `, bold: true },
                            ...commentText,
                            { text: `\nCommented By: ${comment.user}\nCommented At: ${new Date(comment.created_at).toLocaleString()}` }
                        ];
                    }).flat();
                }

                // Combine instruction text with comments
                const fullInstructionText = [
                    ...instructionText,
                    ...commentsArray
                ];

                tableBody.push([
                    { text: `${stepIndex + 1}`, font: 'NotoSansDevanagari'},
                    { text: fullInstructionText, 
                        font: 'NotoSansDevanagari', 
                        id: `product-${productResponse._id}-instruction-${instruction._id}-step-${stepIndex + 1}`,
                        noWrap: false,
                        alignment: 'left', 
                        margin: [0, 2, 0, 2]
                    },
                    { text: `${executedInfo.executed_by || ''} ${executedInfo.executed_at ? new Date(executedInfo.executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' },
                    { text: `${qaInfo.qa_executed_by || ''} ${qaInfo.qa_executed_at ? new Date(qaInfo.qa_executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' }
                ]);
            }

            // Add instruction steps table
            content.push({
                table: {
                    headerRows: 2,
                    widths: [50, 230, 100, 100],
                    body: tableBody
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => 'gray',
                    vLineColor: () => 'gray',
                    fillColor: (rowIndex, columnIndex) => (rowIndex === 0 || rowIndex === 1) ? '#CCCCCC' : null
                }
            });

            if (i < products.length - 1) {
                content.push({ text: '', pageBreak: 'after' });
            }
        }

        const docDefinition = {
            content: content,
            footer: (currentPage, pageCount) => ({
                text: `Page ${currentPage} of ${pageCount} | Report downloaded by: ${userId} (${userRole})`,
                alignment: 'center',
                fontSize: 10,
                margin: [0, 0, 0, 20]
            }),
            header: () => ({
                text: `${new Date().toLocaleDateString()}`,
                alignment: 'right',
                margin: [0, 20, 20, 0]
            }),
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: 'center'
                },
                subheader: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 0, 0, 5]
                },
                tableHeader: {
                    bold: true,
        fontSize: 13,
                    color: 'black'
                }
            }
        };

        // Create and send the PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];

        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Disposition', `attachment; filename="Order-${order._id}_BatchReport.pdf"`);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        pdfDoc.end();
    } catch (err) {
        console.error('Error retrieving order or products:', err);
        res.status(500).json({ error: 'Failed to retrieve order or products' });
    }
});

module.exports = router;