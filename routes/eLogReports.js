const express = require('express');
const router = express.Router();
const eLogOrder = require('../models/eLogOrderModel');
const eLogProduct = require('../models/eLogProductModel');
const EquipmentActivities = require('../models/equipmentActivitiesModel');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

router.get('/downloadPDF/:eLogOrderId/:eLogProductId/:equipmentActivitiesId/:language/:userId/:userRole', async (req, res) => {
    try {
        const { eLogOrderId, eLogProductId, equipmentActivitiesId, language, userId, userRole } = req.params;

        // Fetch eLogOrder
        const order = await eLogOrder.findById(eLogOrderId);
        if (!order) return res.status(404).json({ error: 'eLog Order not found' });

        // Fetch product from the eLogOrder
        const product = await eLogProduct.findById(eLogProductId);
        if (!product) return res.status(404).json({ error: 'eLog Product not found in eLogOrder' });

        // Fetch equipmentActivities
        const equipmentActivities = await EquipmentActivities.findById(equipmentActivitiesId).lean();
        if (!equipmentActivities) return res.status(404).json({ error: 'activity not found' });

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

        // Add comments from each equipmentActivities step to the comments table
        equipmentActivities.activities.forEach((step, stepIndex) => {
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
            [{ text: equipmentActivities.activity_name[languageCode], style: 'tableHeader', colSpan: 4, alignment: 'left', font: 'NotoSansDevanagari' }, {}, {}, {}],
            [
                { text: 'Step No', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Step', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'Performed By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' },
                { text: 'QA Verified By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' }
            ]
        ];

        for (const [stepIndex, step] of equipmentActivities.activities.entries()) {
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
        
            // Get the equipmentActivities text as an array of objects
            const activityText = step?.activity?.[languageCode] || step?.activity?.en
                ? replacePlaceholders(step.activity[languageCode] || step.activity.en, step.placeholders || {})
                : replacePlaceholders("No activity Present", step.placeholders || {});

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
        
            // Combine equipmentActivities text with comments
            const fullactivityText = [
                ...activityText, 
                ...commentsArray 
            ];
        
            tableBody.push([
                { text: `${stepIndex + 1}`, font: 'NotoSansDevanagari'},
                { text: fullactivityText, font: 'NotoSansDevanagari', id: `step-${stepIndex + 1}` },
                { text: `${executedInfo.executed_by || ''} ${executedInfo.executed_at ? new Date(executedInfo.executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' },
                { text: `${qaInfo.qa_executed_by || ''} ${qaInfo.qa_executed_at ? new Date(qaInfo.qa_executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' }
            ]);
        }

        // PDF generation setup
        const printer = new PdfPrinter({
            Roboto: {
              //normal: fs.readFileSync(path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf'))),
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
                            [{ text: 'ELog Order Name ' , style: 'tableHeader'}, { text: order.eLogOrder_name }, { text: 'ELog Order Number',  style: 'tableHeader' }, { text: order.id }],
                            [{ text: 'ELog Product Name ' ,  style: 'tableHeader'}, { text: product.eLog_product_name }, { text: 'Equipment Name',  style: 'tableHeader' }, { text: order.equipmentInfo.equipment_name }],
                            [{ text: 'Status' ,  style: 'tableHeader'}, { text: product.effective ? "Released" : "Not Released" }, { text: 'Version' ,  style: 'tableHeader'}, { text: product.version }]
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
                        widths: [50, '*', 100, 100],
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
            res.setHeader('Content-Disposition', `attachment; filename="ELogOrder-${order.id}_ELogProduct-${product.eLog_product_name}_EquipmentActivity-${equipmentActivities.id}.pdf"`);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        pdfDoc.end();
    } catch (err) {
        console.error('Error retrieving eLogOrder:', err);
        res.status(500).json({ error: 'Failed to retrieve eLogOrder or product' });
    }
});

router.get('/downloadPDFForOrder/:eLogOrderId/:language/:userId/:userRole', async (req, res) => {  
    try {
        const { eLogOrderId, language, userId, userRole } = req.params;

        // Fetch the eLogOrder
        const order = await eLogOrder.findById(eLogOrderId).lean();
        if (!order) return res.status(404).json({ error: 'eLog Order not found' });

        // Fetch all products in the eLogOrder
        const products = order.eLogProducts;
        if (!products || products.length === 0) {
            return res.status(404).json({ error: 'No eLog products found for this eLogOrder' });
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
                        [{ text: 'ELog Order Name ', style: 'tableHeader' }, { text: order.eLogOrder_name }, { text: 'ELog Order Number', style: 'tableHeader' }, { text: order._id }],
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

        content.push({ text: 'Comments',  style: 'tableHeader' , margin: [0, 0, 0, 10] });
        // Now, continue with the comments tables...
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const eLogProductResponse = await eLogProduct.findById(product);
            const equipmentActivities = await EquipmentActivities.findById(eLogProductResponse.equipment_activities_id).lean();
            if (!equipmentActivities) continue;
        
            // Add product details (name, number, status, version) along with comments in the same structure
            const productTable = [
                [{ text: 'ELog Product Name ', style: 'tableHeader' }, { text: eLogProductResponse.eLog_product_name }, { text: 'Equipment Name' ,  style: 'tableHeader'}, { text: order.equipmentInfo.equipment_name }],
                [{ text: 'Status', style: 'tableHeader' }, { text: eLogProductResponse.effective ? 'Released' : 'Not Released' }, { text: 'Version', style: 'tableHeader' }, { text: eLogProductResponse.version }]
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
            equipmentActivities.activities.forEach((step, stepIndex) => {
                step.comments.forEach(comment => {
                    hasComments = true;
                    commentsTable.push([
                        {
                            text: `${step.step}`,
                            link: `#product-${eLogProductResponse._id}-equipmentActivities-${equipmentActivities._id}-step-${stepIndex + 1}`,
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
            const eLogProductResponse = await eLogProduct.findById(product);
            const equipmentActivities = await EquipmentActivities.findById(eLogProductResponse.equipment_activities_id).lean();
            if (!equipmentActivities) continue;

            content.push({
                table: {
                    widths: [95, 145, 95, 145],
                    body: [
                        [{ text: 'ELog Product Name ', style: 'tableHeader' }, { text: eLogProductResponse.eLog_product_name },{ text: 'Equipment Name' ,  style: 'tableHeader'}, { text: order.equipmentInfo.equipment_name }],
                        [{ text: 'Status', style: 'tableHeader' }, { text: eLogProductResponse.effective ? "Released" : "Not Released" }, { text: 'Version', style: 'tableHeader' }, { text: eLogProductResponse.version }]
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

              // Add equipmentActivities steps table for the product (as in the original code)
              const tableBody = [
                [{ text: equipmentActivities.activity_name[languageCode],  style: 'tableHeader' , colSpan: 4, alignment: 'left', font: 'NotoSansDevanagari' }, {}, {}, {}],
                [
                    { text: 'Step No', style: 'tableHeader' , font: 'NotoSansDevanagari' },
                    { text: 'Step', style: 'tableHeader' , font: 'NotoSansDevanagari' },
                    { text: 'Performed By / Date', style: 'tableHeader' , font: 'NotoSansDevanagari' },
                    { text: 'QA Verified By / Date', style: 'tableHeader', font: 'NotoSansDevanagari' }
                ]
            ];

            // Add equipmentActivities steps (same logic as before)
            for (const [stepIndex, step] of equipmentActivities.activities.entries()) {
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
                
                const activityText = step?.activity?.[languageCode] || step?.activity?.en
                    ? replacePlaceholders(step.activity[languageCode] || step.activity.en, step.placeholders || {})
                    : replacePlaceholders("No activity Present", step.placeholders || {});

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

                // Combine equipmentActivities text with comments
                const fullactivityText = [
                    ...activityText,
                    ...commentsArray
                ];

                tableBody.push([
                    { text: `${stepIndex + 1}`, font: 'NotoSansDevanagari'},
                    { text: fullactivityText, font: 'NotoSansDevanagari', id: `product-${eLogProductResponse._id}-equipmentActivities-${equipmentActivities._id}-step-${stepIndex + 1}`},
                    { text: `${executedInfo.executed_by || ''} ${executedInfo.executed_at ? new Date(executedInfo.executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' },
                    { text: `${qaInfo.qa_executed_by || ''} ${qaInfo.qa_executed_at ? new Date(qaInfo.qa_executed_at).toLocaleString() : ''}`, font: 'NotoSansDevanagari' }
                ]);
            }

            // Add equipmentActivities steps table
            content.push({
                table: {
                    headerRows: 2,
                    widths: [50, '*', 100, 100],
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
            res.setHeader('Content-Disposition', `attachment; filename="ELogOrder-${order._id}_BatchReport.pdf"`);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        pdfDoc.end();
    } catch (err) {
        console.error('Error retrieving eLogOrder or eLogProducts:', err);
        res.status(500).json({ error: 'Failed to retrieve eLogOrder or eLogProducts' });
    }
});

module.exports = router;