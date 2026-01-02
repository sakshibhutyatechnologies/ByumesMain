const MasterEquipmentActivities = require("../models/masterEquipmentActivitiesModel");
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
        const activity = await MasterEquipmentActivities.findById(req.params.id);
        if (!activity) return res.status(404).json({ error: "Activity not found" });

        // --- 1. PREPARE SIGNATURE DATA ---
        const signatureRows = [];

        signatureRows.push([
            { text: 'Role', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Name', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Date', style: 'tableHeader', fillColor: '#eeeeee' },
            { text: 'Status', style: 'tableHeader', fillColor: '#eeeeee' }
        ]);

        // Creator
        const creatorName = activity.created_by
            ? await getUserName(activity.created_by)
            : "Unknown (created before tracking)";

        signatureRows.push([
            'Creator',
            creatorName,
            activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : '-',
            { text: 'INITIATED', bold: true, color: 'green' }
        ]);

        // Reviewers
        for (const r of activity.reviewers) {
            const rName = await getUserName(r.user_id);

            let dateDisplay = '-';
            if (r.has_reviewed) {
                dateDisplay = r.reviewed_at
                    ? new Date(r.reviewed_at).toLocaleDateString()
                    : "Previously Reviewed";
            }

            signatureRows.push([
                'Reviewer',
                rName,
                dateDisplay,
                r.has_reviewed ? { text: 'REVIEWED', bold: true, color: 'blue' } : { text: 'PENDING', italics: true, color: 'gray' }
            ]);
        }

        // Approvers
        for (const a of activity.approvers) {
            const aName = await getUserName(a.user_id);

            let dateDisplay = '-';
            if (a.has_approved) {
                dateDisplay = a.approved_at
                    ? new Date(a.approved_at).toLocaleDateString()
                    : "Previously Approved";
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
                { text: 'Activity Step', style: 'tableHeader', fillColor: '#cccccc' },
                { text: 'Performed By', style: 'tableHeader', fillColor: '#cccccc' },
                { text: 'Verified By', style: 'tableHeader', fillColor: '#cccccc' }
            ]
        ];

        if (activity.activities && activity.activities.length > 0) {
            activity.activities.forEach((step) => {
                const stepContent = cleanText(step.activity?.en || step.activity || "");
                stepsTableBody.push([
                    { text: step.step.toString(), alignment: 'center' },
                    { text: stepContent, alignment: 'left' },
                    { text: '', margin: [0, 15] },
                    { text: '', margin: [0, 15] }
                ]);
            });
        } else {
            stepsTableBody.push([{ text: "No detailed steps found.", colSpan: 4, alignment: 'center' }, {}, {}, {}]);
        }

        // --- 3. GENERATE PDF ---
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
                { text: 'Equipment Activity Certificate', style: 'header', alignment: 'center', margin: [0, 0, 0, 5] },
                { text: `Status: ${activity.status.toUpperCase()}`, style: 'subheader', alignment: 'center', color: activity.status === 'Approved' ? 'green' : 'orange' },
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
                            [{ text: 'Product Name', bold: true }, activity.product_name || 'N/A'],
                            [{ text: 'Activity Name', bold: true }, activity.activity_name?.en || 'N/A'],
                            [{ text: 'Version', bold: true }, (activity.version || 1).toString()],
                            [{ text: 'Document ID', bold: true }, activity._id.toString()]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 20]
                },
                { text: 'Equipment Activities', style: 'sectionHeader' },
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
        res.setHeader('Content-Disposition', `attachment; filename="${activity.product_name}_Approved.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).json({ error: "Failed to generate PDF. Check server logs." });
    }
};
