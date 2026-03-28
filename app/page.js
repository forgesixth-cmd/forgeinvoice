"use client";

import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SixthForge Invoice", 20, 20);

    doc.setFontSize(12);
    doc.text(`Client: ${client}`, 20, 40);
    doc.text(`Amount: ₹${amount}`, 20, 50);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60);

    doc.save("invoice.pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col">

      {/* HEADER */}
      <div className="flex justify-between items-center px-8 py-4 bg-white shadow-sm">
        <h1 className="text-xl font-bold">SixthForge</h1>
        <button className="text-sm bg-black text-white px-4 py-2 rounded-lg">
          Upgrade
        </button>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 items-center justify-center p-6">

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">

          {/* FORM */}
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h2 className="text-lg font-semibold mb-4">Create Invoice</h2>

            <input
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-black outline-none"
              placeholder="Client Name"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />

            <input
              className="w-full border rounded-lg p-3 mb-6 focus:ring-2 focus:ring-black outline-none"
              placeholder="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <button
              onClick={generatePDF}
              className="w-full bg-black text-white p-3 rounded-lg hover:bg-gray-800 transition"
            >
              Generate & Download Invoice
            </button>
          </div>

          {/* PREVIEW */}
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>

            <div className="border rounded-xl p-4 bg-gray-50">
              <p className="text-sm text-gray-500 mb-2">
                SixthForge Invoice
              </p>

              <p className="mb-1">
                <strong>Client:</strong> {client || "—"}
              </p>

              <p className="mb-1">
                <strong>Amount:</strong> ₹{amount || "—"}
              </p>

              <p className="text-sm text-gray-400 mt-4">
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER */}
      <div className="text-center text-sm text-gray-500 pb-4">
        Made with SixthForge 🚀
      </div>
    </div>
  );
}