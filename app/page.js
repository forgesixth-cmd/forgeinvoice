"use client";

import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`Client: ${client}`, 20, 20);
    doc.text(`Amount: ₹${amount}`, 20, 30);
    doc.save("invoice.pdf");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>ForgeInvoice</h1>

      <input
        placeholder="Client Name"
        value={client}
        onChange={(e) => setClient(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <br /><br />

      <button onClick={generatePDF}>
        Generate Invoice
      </button>
    </div>
  );
}