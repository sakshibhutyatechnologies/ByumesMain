const MasterInstruction = require("../models/masterInstructionModel");
const { User } = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const PdfPrinter = require('pdfmake');

const getUserName = async (userId) => {
    if (!userId) return "Unknown";
    const user = await User.findById(userId).select('full_name');
    return user ? user.full_name : "Unknown User";
};

const cleanText = (text) => {
    if (!text) return "";
    return text.replace(/<[^>]+>/g, '').trim();
};

exports.downloadApprovalPdf = async (req, res) => {
    try {
        const instruction = await MasterInstruction.findById(req.params.id);
        if (!instruction) return res.status(404).json({ error: "Instruction not found" });

        // --- 1. PREPARE SIGNATURE DATA ---
        const signatureRows = [];

        signatureRows.push([
            { text: 'Role', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Name', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Date', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Status', style: 'tableHeader', fillColor: '#eeeeee' }
        ]);

        // Creator
        console.log('DEBUG: created_by =', instruction.created_by); // Debug log
        const creatorName = instruction.created_by
            ? await getUserName(instruction.created_by)
            : "Unknown (created before tracking)";

        signatureRows.push([
            'Creator',
            creatorName,
            instruction.createdAt ? new Date(instruction.createdAt).toLocaleDateString() : '-',
            { text: 'INITIATED', bold: true, color: 'green' }
        ]);

        // Reviewers
        for (const r of instruction.reviewers) {
            const rName = await getUserName(r.user_id);

            // --- ROBUST DATE HANDLING ---
            // If reviewed_at is missing (old data), check has_reviewed. If true, show "Pre-System" or updatedAt
            let dateDisplay = '-';
            if (r.has_reviewed) {
                dateDisplay = r.reviewed_at
                    ? new Date(r.reviewed_at).toLocaleDateString()
                    : "Previously Reviewed"; // Fallback for old data
            }

            signatureRows.push([
                'Reviewer',
                rName,
                dateDisplay,
                r.has_reviewed ? { text: 'REVIEWED', bold: true, color: 'blue' } : { text: 'PENDING', italics: true, color: 'gray' }
            ]);
        }

        // Approvers
        for (const a of instruction.approvers) {
            const aName = await getUserName(a.user_id);

            // --- ROBUST DATE HANDLING ---
            let dateDisplay = '-';
            if (a.has_approved) {
                dateDisplay = a.approved_at
                    ? new Date(a.approved_at).toLocaleDateString()
                    : "Previously Approved"; // Fallback for old data
            }

            signatureRows.push([
                'Approver',
                aName,
                dateDisplay,
                a.has_approved ? { text: 'APPROVED', bold: true, color: 'green' } : { text: 'PENDING', italics: true, color: 'gray' }
            ]);
        }

        // --- 2. PREPARE STEPS DATA ---
        const stepsTableBody = [
            [
                { text: 'Step No', style: 'tableHeader', fillColor: '#cccccc' },
                { text: 'Instruction Step', style: 'tableHeader', fillColor: '#cccccc' },
                { text: 'Performed By', style: 'tableHeader', fillColor: '#cccccc' },
                { text: 'Verified By', style: 'tableHeader', fillColor: '#cccccc' }
            ]
        ];

        if (instruction.instructions && instruction.instructions.length > 0) {
            instruction.instructions.forEach((step, index) => {
                const stepContent = cleanText(step.instruction?.en || step.instruction || "");
                stepsTableBody.push([
                    { text: (index + 1).toString(), alignment: 'center' },
                    { text: stepContent, alignment: 'left' },
                    { text: '', margin: [0, 15] },
                    { text: '', margin: [0, 15] }
                ]);
            });
        } else {
            stepsTableBody.push([{ text: "No detailed steps found.", colSpan: 4, alignment: 'center' }, {}, {}, {}]);
        }

        // --- 3. GENERATE PDF ---
        // CHECK IF FONTS EXIST TO PREVENT CRASH
        const fontPath = path.join(process.cwd(), 'public/fonts');
        const robotoRegular = path.join(fontPath, 'Roboto-Regular.ttf');

        if (!fs.existsSync(robotoRegular)) {
            console.error("CRITICAL ERROR: Font files missing at " + fontPath);
            return res.status(500).json({ error: "Server Configuration Error: Fonts missing." });
        }

        const printer = new PdfPrinter({
            Roboto: {
                normal: fs.readFileSync(path.join(fontPath, 'Roboto-Regular.ttf')),
                bold: fs.readFileSync(path.join(fontPath, 'Roboto-Medium.ttf')),
                italics: fs.readFileSync(path.join(fontPath, 'Roboto-Italic.ttf')),
                bolditalics: fs.readFileSync(path.join(fontPath, 'Roboto-MediumItalic.ttf'))
            }
        });

        const docDefinition = {
            content: [
                { text: 'Manufacturing Instruction Certificate', style: 'header', alignment: 'center', margin: [0, 0, 0, 5] },
                { text: `Status: ${instruction.status.toUpperCase()}`, style: 'subheader', alignment: 'center', color: instruction.status === 'Approved' ? 'green' : 'orange' },
                { text: '\n' },
                { text: 'Approval Signatures', style: 'sectionHeader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['20%', '40%', '20%', '20%'],
                        body: signatureRows
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 20]
                },
                { text: 'Document Details', style: 'sectionHeader' },
                {
                    table: {
                        widths: ['25%', '75%'],
                        body: [
                            [{ text: 'Product Name', bold: true }, instruction.product_name || 'N/A'],
                            [{ text: 'Version', bold: true }, (instruction.version || 1).toString()],
                            [{ text: 'Document ID', bold: true }, instruction._id.toString()]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 20]
                },
                { text: 'Manufacturing Instructions', style: 'sectionHeader' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['10%', '50%', '20%', '20%'],
                        body: stepsTableBody
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 2 : 1,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 2 : 1,
                        hLineColor: (i, node) => (i === 0 || i === node.table.body.length) ? 'black' : 'gray',
                        vLineColor: (i, node) => (i === 0 || i === node.table.widths.length) ? 'black' : 'gray',
                    }
                },
                { text: '\n' },
                { text: 'End of Document', alignment: 'center', style: 'small' },
                { text: `Generated electronically on ${new Date().toLocaleString()}`, alignment: 'center', style: 'small' }
            ],
            styles: {
                header: { fontSize: 22, bold: true },
                subheader: { fontSize: 14, bold: true },
                sectionHeader: { fontSize: 14, bold: true, decoration: 'underline', margin: [0, 10, 0, 5] },
                tableHeader: { bold: true, fontSize: 11, color: 'black', margin: [0, 4, 0, 4] },
                small: { fontSize: 8, color: 'gray', italics: true }
            }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${instruction.product_name}_Approved.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).json({ error: "Failed to generate PDF. Check server logs." });
    }
};