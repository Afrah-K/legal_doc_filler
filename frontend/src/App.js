import React, { useState } from "react";
import axios from "axios";
import "./index.css";

// Create an axios instance with dynamic base URL
const api = axios.create({
  baseURL:
    process.env.NODE_ENV === "production"
      ? "" // On Render → same origin
      : "http://localhost:8000", // Local dev
});

function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [docType, setDocType] = useState("safe");
  const [placeholders, setPlaceholders] = useState([]);
  const [answers, setAnswers] = useState({});
  const [chat, setChat] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    try {
      const res = await api.post("/upload", formData);
      setFileId(res.data.file_id);
      setPlaceholders(res.data.placeholders);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  const handleAnswerChange = (ph, value) => {
    setAnswers((prev) => ({ ...prev, [ph]: value }));
  };

  const handleChat = async () => {
    setChatLoading(true);
    try {
      const res = await api.post("/chat", {
        placeholders,
        answers,
        doc_type: docType,
      });
      setChat(res.data.reply);
    } catch (err) {
      console.error(err);
      alert("Chat request failed");
    } finally {
      setChatLoading(false);
    }
  };

  const handleFill = async () => {
    if (!fileId) return alert("Please upload a file first");

    try {
      const formData = new FormData();
      formData.append("file_id", fileId);
      formData.append("answers", JSON.stringify(answers));

      const res = await api.post("/fill", formData, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "filled.docx");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
      alert("Filling failed");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Legal Document Filler</h1>

      <div className="mb-4">
        <label className="block mb-1 font-medium">Choose Document Type</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="safe">SAFE</option>
          <option value="nda">NDA</option>
          <option value="employment">Employment</option>
        </select>
      </div>

      <div className="mb-4">
        <input type="file" onChange={handleFileChange} className="mb-2" />
        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload
        </button>
      </div>

      {placeholders.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Fill Placeholders</h2>
          {placeholders.map((ph) => (
            <div key={ph} className="mb-2">
              <label className="block mb-1">{ph}</label>
              <input
                type="text"
                value={answers[ph] || ""}
                onChange={(e) => handleAnswerChange(ph, e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
          ))}
        </div>
      )}

      {placeholders.length > 0 && (
        <div className="mb-4">
          <button
            onClick={handleChat}
            disabled={chatLoading}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {chatLoading ? "Thinking..." : "Ask Chatbot"}
          </button>
          {chat && (
            <div className="mt-2 p-2 border rounded bg-gray-100">{chat}</div>
          )}
        </div>
      )}

      {fileId && (
        <div>
          <button
            onClick={handleFill}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Download Filled Document
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
