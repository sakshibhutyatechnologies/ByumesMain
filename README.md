14 FEB 2025 - mongoDB-Threshold-issue-fix
4 Feb 2025
# Bhutya API Documentation

This document describes the various API endpoints available in the Bhutya API.

## Endpoints Overview

### **OrderAPI.js**

#### `GET /getOrderDetails/:orderId`
- **Description**: Fetches detailed information about a specific order using the `orderId`.

### **ProductAPI.js**

#### `GET /getProductDetails/:productId`
- **Description**: Retrieves product details, including name, version, and description, using the `productId`.

### **InstructionAPI.js**

#### `GET /getInstructionDetails/:instructionId/:language`
- **Description**: Fetches and formats instructions in the specified `language` for a given `instructionId`.

#### `GET /getComments/:instructionId`
- **Description**: Retrieves comments associated with a specific instruction, including details such as the author and timestamp.

### **UserAPI.js**

#### `GET /validateUser/:userId/:userRole`
- **Description**: Validates user credentials and role to ensure they have the necessary permissions for the requested action.

### **PDFGeneratorAPI.js**

#### `GET /generatePDFContent/:orderId/:productId/:instructionId`
- **Description**: Prepares structured and formatted data (e.g., tables for comments and steps) for PDF generation.

#### `GET /downloadPDF/:orderId/:productId/:instructionId/:language/:userId/:userRole`
- **Description**: Combines order, product, and instruction data, formats them into a PDF, and provides a downloadable file.
