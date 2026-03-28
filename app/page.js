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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        
        <h1 className="text-2xl font-bold mb-6 text-center">
          ForgeInvoice
        </h1>

        <input
          className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Client Name"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />

        <input
          className="w-full border rounded-lg p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={generatePDF}
          className="w-full bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition"
        >
          Generate Invoice
        </button>

      </div>
    </div>
  );
}