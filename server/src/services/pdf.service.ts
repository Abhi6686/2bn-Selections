import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

async function getLogoBase64(): Promise<{ base64: string; format: "PNG" | "JPEG" } | null> {
  const candidates = [
    path.resolve(currentDirectory, "../assets/logo.png"),
    path.resolve(currentDirectory, "../assets/logo.jpg"),
    path.resolve(currentDirectory, "../../src/assets/logo.png"),
    path.resolve(currentDirectory, "../../src/assets/logo.jpg"),
    path.resolve(process.cwd(), "src/assets/logo.png"),
    path.resolve(process.cwd(), "src/assets/logo.jpg"),
    path.resolve(process.cwd(), "public/logo.png"),
    path.resolve(process.cwd(), "public/logo.jpg"),
    path.resolve(process.cwd(), "../public/logo.png"),
    path.resolve(process.cwd(), "../public/logo.jpg"),
  ];

  for (const p of candidates) {
    try {
      const buffer = await fs.readFile(p);
      const isPng = path.extname(p).toLowerCase() === ".png";
      return {
        base64: `data:image/${isPng ? "png" : "jpeg"};base64,${buffer.toString("base64")}`,
        format: isPng ? "PNG" : "JPEG"
      };
    } catch {}
  }
  return null;
}


export async function generateChangeOrderPdf(input: {
  project: { name: string; clientName: string; _id: { toString(): string } };
  changeOrder: {
    number: number;
    title: string;
    lines: Array<{
      category: string;
      description: string;
      previousAmount: number;
      newAmount: number;
      delta: number;
    }>;
    totalDelta: number;
    notes?: string;
    projectId: { toString(): string };
    approvals?: Array<{
      email?: string;
      signatureType?: string;
      typedName?: string;
      signatureImagePath?: string;
      decidedAt?: Date;
      ipAddress?: string;
    }>;
  };
  approvalLink?: string;
}): Promise<string> {
  const { project, changeOrder, approvalLink } = input;
  const document = new jsPDF();

  // 1. Draw Emerald Header Banner
  document.setFillColor(15, 62, 32); // #0F3E20 (Emerald Green)
  document.rect(0, 0, 210, 38, "F");

  // 2. Title & Subtitle inside Banner
  const logoData = await getLogoBase64();
  if (logoData) {
    document.addImage(logoData.base64, logoData.format, 14, 5, 35, 14);
  } else {
    document.setFont("helvetica", "bold");
    document.setFontSize(22);
    document.setTextColor(197, 160, 40); // #C5A028 (Gold)
    document.text("2bn Selections", 14, 16);
  }

  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.setTextColor(255, 255, 255);
  document.text("Change Order Specifications & Approvals", 14, 26);

  // 3. QR Code inside white background block (top right)
  if (approvalLink) {
    try {
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(approvalLink, { margin: 1 });
      
      // Draw white background card for QR Code
      document.setFillColor(255, 255, 255);
      document.rect(166, 3, 32, 32, "F");
      document.addImage(qrDataUrl, "PNG", 168, 5, 28, 28);
    } catch (err) {
      console.error("Failed to generate QR Code for PDF:", err);
    }
  }

  // 4. Project Details Section
  document.setTextColor(40, 40, 40);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("PROJECT DETAILS", 14, 50);

  // Gold accent line
  document.setDrawColor(197, 160, 40); // Gold
  document.setLineWidth(0.5);
  document.line(14, 52, 70, 52);

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(`Project Name: ${project.name}`, 14, 58);
  document.text(`Client Name:   ${project.clientName}`, 14, 64);
  document.text(`Date:          ${new Date().toLocaleDateString()}`, 14, 70);

  document.setFont("helvetica", "bold");
  document.text(`Change Order:  #${changeOrder.number} — ${changeOrder.title}`, 14, 76);

  // 5. Table of Lines
  (autoTable as any)(document, {
    startY: 84,
    head: [["Category", "Description", "Previous", "New", "Delta"]],
    body: changeOrder.lines.map((line) => [
      line.category,
      line.description,
      `$${line.previousAmount.toFixed(2)}`,
      `$${line.newAmount.toFixed(2)}`,
      `$${line.delta.toFixed(2)}`,
    ]),
    headStyles: {
      fillColor: [15, 62, 32], // Emerald #0F3E20
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 245],
    },
    styles: {
      lineColor: [197, 160, 40], // Gold border lines
      lineWidth: 0.1,
    },
  });

  const finalY = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 120;

  // 6. Total Delta Box
  document.setFillColor(245, 245, 240);
  document.rect(14, finalY + 5, 182, 12, "F");
  
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.setTextColor(15, 62, 32); // Emerald
  document.text(`TOTAL DELTA: $${changeOrder.totalDelta.toFixed(2)}`, 18, finalY + 13);

  // Notes
  let notesY = finalY + 28;
  if (changeOrder.notes) {
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.setTextColor(80, 80, 80);
    document.text(`Notes: ${changeOrder.notes}`, 14, notesY);
    notesY += 12;
  }

  // 7. Signature Block
  let sigY = notesY + 10;
  document.setFont("helvetica", "bold");
  document.setTextColor(15, 62, 32); // Emerald
  document.text("CLIENT APPROVALS & SIGNATURES", 14, sigY);
  
  document.setDrawColor(197, 160, 40); // Gold
  document.setLineWidth(0.5);
  document.line(14, sigY + 2, 90, sigY + 2);

  sigY += 12;

  if (changeOrder.approvals && changeOrder.approvals.length > 0) {
    for (const app of changeOrder.approvals) {
      document.setFont("helvetica", "normal");
      document.setFontSize(10);
      document.setTextColor(40, 40, 40);
      document.text(`Approved by: ${app.email}`, 14, sigY);
      document.text(`Date: ${app.decidedAt ? new Date(app.decidedAt).toLocaleString() : new Date().toLocaleString()}`, 14, sigY + 6);
      if (app.ipAddress) {
        document.text(`IP: ${app.ipAddress}`, 14, sigY + 12);
      }

      if (app.signatureType === "drawn" && app.signatureImagePath) {
        try {
          const sigBuffer = await fs.readFile(app.signatureImagePath);
          const sigBase64 = `data:image/png;base64,${sigBuffer.toString("base64")}`;
          document.addImage(sigBase64, "PNG", 120, sigY - 6, 60, 18);
          
          document.setDrawColor(180, 180, 180);
          document.setLineWidth(0.25);
          document.line(120, sigY + 14, 180, sigY + 14);
          
          document.setFont("helvetica", "normal");
          document.setFontSize(8);
          document.setTextColor(100, 100, 100);
          document.text("Authorized Signature (Drawn)", 120, sigY + 18);
        } catch (err) {
          console.error("Failed to read signature image for PDF:", err);
          document.text("[Signature Image Load Error]", 120, sigY + 5);
        }
      } else if (app.signatureType === "typed" && app.typedName) {
        document.setFont("times", "italic");
        document.setFontSize(16);
        document.setTextColor(15, 62, 32); // Emerald cursive
        document.text(app.typedName, 120, sigY + 4);

        document.setDrawColor(180, 180, 180);
        document.setLineWidth(0.25);
        document.line(120, sigY + 9, 180, sigY + 9);
        
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(100, 100, 100);
        document.text("Authorized Signature (Typed)", 120, sigY + 13);
      } else if (app.signatureType === "both" && app.signatureImagePath && app.typedName) {
        document.setFont("times", "italic");
        document.setFontSize(14);
        document.setTextColor(15, 62, 32);
        document.text(app.typedName, 120, sigY - 2);

        try {
          const sigBuffer = await fs.readFile(app.signatureImagePath);
          const sigBase64 = `data:image/png;base64,${sigBuffer.toString("base64")}`;
          document.addImage(sigBase64, "PNG", 120, sigY + 2, 60, 15);
        } catch (err) {
          console.error("Failed to read signature image for PDF:", err);
        }

        document.setDrawColor(180, 180, 180);
        document.setLineWidth(0.25);
        document.line(120, sigY + 18, 180, sigY + 18);
        
        document.setFont("helvetica", "normal");
        document.setFontSize(8);
        document.setTextColor(100, 100, 100);
        document.text("Authorized Signature (Drawn & Typed)", 120, sigY + 22);
      }

      sigY += 28;
    }
  } else {
    document.setFont("helvetica", "italic");
    document.setFontSize(10);
    document.setTextColor(120, 120, 120);
    document.text("Pending digital signature and approval.", 14, sigY);
  }

  await fs.mkdir(path.join(env.uploadsDir, "pdfs"), { recursive: true });
  const fileName = `co-${changeOrder.projectId}-${changeOrder.number}.pdf`;
  const filePath = path.join(env.uploadsDir, "pdfs", fileName);
  const buffer = Buffer.from(document.output("arraybuffer"));
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function generateProposalPdf(input: {
  project: { name: string; clientName: string; address?: string; _id: { toString(): string }; rooms?: any[] };

  selections: Array<{
    categoryKey: string;
    product?: string;
    manufacturer?: string;
    model?: string;
    level?: string;
    finish?: string;
    quantity: number;
    priceUsed?: number;
    discountPercent?: number;
    discountFlat?: number;
  }>;
  signatureType: "drawn" | "typed";
  typedName?: string;
  signatureImagePath?: string;
  version: number;
}): Promise<string> {
  const { project, selections, signatureType, typedName, signatureImagePath, version } = input;
  const document = new jsPDF();

  // 1. Draw Emerald Header Banner
  document.setFillColor(15, 62, 32); // #0F3E20 (Emerald Green)
  document.rect(0, 0, 210, 38, "F");

  // 2. Title & Subtitle inside Banner
  const logoData = await getLogoBase64();
  if (logoData) {
    document.addImage(logoData.base64, logoData.format, 14, 5, 35, 14);
  } else {
    document.setFont("helvetica", "bold");
    document.setFontSize(22);
    document.setTextColor(197, 160, 40); // #C5A028 (Gold)
    document.text("2bn Selections", 14, 16);
  }

  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.setTextColor(255, 255, 255);
  document.text("Selections Proposal & Contract Approval", 14, 26);

  // 3. Project Details Section
  document.setTextColor(40, 40, 40);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("PROJECT DETAILS", 14, 50);

  // Gold accent line
  document.setDrawColor(197, 160, 40); // Gold
  document.setLineWidth(0.5);
  document.line(14, 52, 70, 52);

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(`Project Name: ${project.name}`, 14, 58);
  document.text(`Client Name:   ${project.clientName}`, 14, 64);
  document.text(`Site Address:  ${project.address || "TBD"}`, 14, 70);
  document.text(`Proposal Version: #${version}`, 14, 76);
  document.text(`Date:          ${new Date().toLocaleDateString()}`, 14, 82);

  // 4. Table of Selections Grouped by Room
  let subtotal = 0;
  let totalDiscount = 0;

  // Let's check if the project has configured rooms
  const rooms = (project as any).rooms || [];
  const selectionsByCat = new Map<string, typeof selections[0]>();
  selections.forEach(sel => {
    selectionsByCat.set(sel.categoryKey, sel);
  });

  if (rooms.length > 0) {
    let currentY = 90;
    for (const room of rooms) {
      if (!room.slots || room.slots.length === 0) continue;

      // Group selections for this room
      const roomSelections = room.slots.map((slot: any) => {
        const sel = selectionsByCat.get(slot.categoryKey);
        return {
          categoryKey: slot.categoryKey,
          slotLabel: slot.slotLabel,
          manufacturer: sel?.manufacturer,
          model: sel?.model,
          product: sel?.product,
          level: sel?.level,
          finish: sel?.finish,
          quantity: sel?.quantity ?? 1,
          priceUsed: sel?.priceUsed ?? 0,
          discountPercent: sel?.discountPercent,
          discountFlat: sel?.discountFlat,
        };
      });

      let roomSubtotal = 0;
      const roomTableBody = roomSelections.map((sel: any) => {
        const qty = sel.quantity ?? 1;
        const unitPrice = sel.priceUsed ?? 0;
        const itemSubtotal = unitPrice * qty;
        roomSubtotal += itemSubtotal;
        subtotal += itemSubtotal;

        let discountDesc = "-";
        let discountAmt = 0;
        if (sel.discountPercent && sel.discountPercent > 0) {
          discountAmt = itemSubtotal * (sel.discountPercent / 100);
          discountDesc = `${sel.discountPercent}% (-$${discountAmt.toFixed(2)})`;
        } else if (sel.discountFlat && sel.discountFlat > 0) {
          discountAmt = sel.discountFlat;
          discountDesc = `-$${discountAmt.toFixed(2)}`;
        }
        totalDiscount += discountAmt;

        const finalPrice = Math.max(0, itemSubtotal - discountAmt);

        const desc = [
          sel.manufacturer || "",
          sel.model || "",
          sel.product || "",
        ].filter(Boolean).join(" ");

        const specDesc = [
          desc,
          sel.level ? `Level ${sel.level}` : "",
          sel.finish ? `Finish: ${sel.finish}` : "",
        ].filter(Boolean).join(" · ");

        return [
          sel.slotLabel || sel.categoryKey.split(" - ").slice(-1)[0],
          specDesc || "No item selected",
          qty.toString(),
          `$${unitPrice.toFixed(2)}`,
          discountDesc,
          `$${finalPrice.toFixed(2)}`,
        ];
      });

      // Add room header text
      if (currentY > 250) {
        document.addPage();
        currentY = 25;
      }
      document.setFont("helvetica", "bold");
      document.setFontSize(11);
      document.setTextColor(15, 62, 32); // Emerald
      document.text(`${room.icon || "🏠"} ${room.name.toUpperCase()}`, 14, currentY);
      
      // Render room table
      (autoTable as any)(document, {
        startY: currentY + 3,
        head: [["Slot Name", "Selected Material Details", "Qty", "Unit Price", "Discount", "Total Price"]],
        body: roomTableBody,
        headStyles: {
          fillColor: [15, 62, 32], // Emerald #0F3E20
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 245],
        },
        styles: {
          lineColor: [197, 160, 40], // Gold border lines
          lineWidth: 0.1,
        },
      });

      currentY = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (currentY + 20);
      currentY += 8; // Margin below table
    }
  } else {
    // Fallback to flat category table if no rooms configured
    const tableBody = selections.map((sel) => {
      const qty = sel.quantity ?? 1;
      const unitPrice = sel.priceUsed ?? 0;
      const itemSubtotal = unitPrice * qty;
      subtotal += itemSubtotal;

      let discountDesc = "-";
      let discountAmt = 0;
      if (sel.discountPercent && sel.discountPercent > 0) {
        discountAmt = itemSubtotal * (sel.discountPercent / 100);
        discountDesc = `${sel.discountPercent}% (-$${discountAmt.toFixed(2)})`;
      } else if (sel.discountFlat && sel.discountFlat > 0) {
        discountAmt = sel.discountFlat;
        discountDesc = `-$${discountAmt.toFixed(2)}`;
      }
      totalDiscount += discountAmt;

      const finalPrice = Math.max(0, itemSubtotal - discountAmt);

      const desc = [
        sel.manufacturer || "",
        sel.model || "",
        sel.product || "",
      ].filter(Boolean).join(" ");

      const specDesc = [
        desc,
        sel.level ? `Level ${sel.level}` : "",
        sel.finish ? `Finish: ${sel.finish}` : "",
      ].filter(Boolean).join(" · ");

      return [
        sel.categoryKey.split(" - ").slice(-1)[0],
        specDesc || "No item selected",
        qty.toString(),
        `$${unitPrice.toFixed(2)}`,
        discountDesc,
        `$${finalPrice.toFixed(2)}`,
      ];
    });

    (autoTable as any)(document, {
      startY: 90,
      head: [["Category", "Selected Material Details", "Qty", "Unit Price", "Discount", "Total Price"]],
      body: tableBody,
      headStyles: {
        fillColor: [15, 62, 32], // Emerald #0F3E20
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 245],
      },
      styles: {
        lineColor: [197, 160, 40], // Gold border lines
        lineWidth: 0.1,
      },
    });
  }

  const finalCost = Math.max(0, subtotal - totalDiscount);

  const finalY = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 130;


  // 5. Total Proposal Cost Box
  document.setFillColor(245, 245, 240);
  document.rect(14, finalY + 5, 182, 24, "F");

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(80, 80, 80);
  document.text(`Selections Subtotal: $${subtotal.toFixed(2)}`, 18, finalY + 12);
  document.text(`Total Discounts Applied: -$${totalDiscount.toFixed(2)}`, 18, finalY + 18);

  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.setTextColor(15, 62, 32); // Emerald
  document.text(`FINAL SELECTIONS COST: $${finalCost.toFixed(2)}`, 18, finalY + 24);

  // 6. Signature Block
  let sigY = finalY + 40;
  if (sigY > 250) {
    document.addPage();
    sigY = 30;
  }

  document.setFont("helvetica", "bold");
  document.setTextColor(15, 62, 32); // Emerald
  document.text("CLIENT APPROVAL & FINAL SIGNATURE", 14, sigY);

  document.setDrawColor(197, 160, 40); // Gold
  document.setLineWidth(0.5);
  document.line(14, sigY + 2, 90, sigY + 2);

  sigY += 12;

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(40, 40, 40);
  document.text(`Approved & Signed by: ${project.clientName}`, 14, sigY);
  document.text(`Date Signed: ${new Date().toLocaleString()}`, 14, sigY + 6);

  if (signatureType === "drawn" && signatureImagePath) {
    try {
      const sigBuffer = await fs.readFile(signatureImagePath);
      const sigBase64 = `data:image/png;base64,${sigBuffer.toString("base64")}`;
      document.addImage(sigBase64, "PNG", 120, sigY - 6, 60, 18);

      document.setDrawColor(180, 180, 180);
      document.setLineWidth(0.25);
      document.line(120, sigY + 14, 180, sigY + 14);

      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(100, 100, 100);
      document.text("Authorized Client Signature (Drawn)", 120, sigY + 18);
    } catch (err) {
      console.error("Failed to read signature image for PDF:", err);
      document.text("[Signature Image Load Error]", 120, sigY + 5);
    }
  } else if (signatureType === "typed" && typedName) {
    document.setFont("times", "italic");
    document.setFontSize(16);
    document.setTextColor(15, 62, 32); // Emerald cursive
    document.text(typedName, 120, sigY + 4);

    document.setDrawColor(180, 180, 180);
    document.setLineWidth(0.25);
    document.line(120, sigY + 9, 180, sigY + 9);

    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(100, 100, 100);
    document.text("Authorized Client Signature (Typed)", 120, sigY + 13);
  }

  await fs.mkdir(path.join(env.uploadsDir, "pdfs"), { recursive: true });
  const fileName = `proposal-${project._id.toString()}-${version}.pdf`;
  const filePath = path.join(env.uploadsDir, "pdfs", fileName);
  const buffer = Buffer.from(document.output("arraybuffer"));
  await fs.writeFile(filePath, buffer);
  return filePath;
}
