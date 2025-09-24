import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./index.css";

const api = axios.create({
  baseURL:
    process.env.NODE_ENV === "production"
      ? "" // same origin on Render
      : "http://localhost:8000",
});

function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [docType, setDocType] = useState("safe");
  const [placeholders, setPlaceholders] = useState([]);
  const [answers, setAnswers] = useState({});
  const [messages, setMessages] = useState([]);
  const [currentPh, setCurrentPh] = useState(null);
  const [input, setInput] = useState("");

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Upload doc and start placeholder Q&A
  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    try {
      const res = await api.post("/upload", formData);
      setFileId(res.data.file_id);
      setPlaceholders(res.data.placeholders);

      setMessages([
        {
          role: "assistant",
          text: "✅ Document uploaded. Let’s start filling it in!",
        },
      ]);

      // Ask first question
      askNext(res.data.placeholders, {}, res.data.doc_type);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  // Ask next placeholder
  const askNext = async (phs, ans, dt) => {
    try {
      const res = await api.post("/chat", {
        placeholders: phs,
        answers: ans,
        doc_type: dt,
      });

      if (res.data.done) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: res.data.message },
        ]);
        setCurrentPh(null); // finished
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: res.data.message },
        ]);
        setCurrentPh(res.data.placeholder);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Error while asking question." },
      ]);
    }
  };

  // Handle user answer
  const handleAnswer = async () => {
    if (!currentPh || !input.trim()) return;

    const updated = { ...answers, [currentPh]: input.trim() };
    setAnswers(updated);

    // Show user answer in chat
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    setInput("");

    // Ask next
    askNext(placeholders, updated, docType);
  };

  // Download final doc
  const handleFill = async () => {
    if (!fileId) return;

    try {
      const formData = new FormData();
      formData.append("file_id", fileId);
      formData.append("values", JSON.stringify(answers));

      const res = await api.post("/fill", formData, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "filled.docx");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
      alert("Download failed");
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 font-sans">
      <h1 className="text-3xl font-bold mb-4 text-gray-800">
        Legal Document Chat Filler
      </h1>

      {/* Upload Section */}
      {!fileId && (
        <div className="mb-6 space-x-4 flex flex-wrap items-center">
          <label className="font-medium text-gray-700">Document type:</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="safe">SAFE</option>
            <option value="nda">NDA</option>
            <option value="employment">Employment</option>
          </select>

          <input
            type="file"
            onChange={handleFileChange}
            className="border border-gray-300 rounded px-2 py-1"
          />
          <button
            onClick={handleUpload}
            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
          >
            Upload
          </button>
        </div>
      )}

      {/* Chat Window */}
      <div className="flex-1 border border-gray-300 rounded p-4 bg-gray-50 overflow-y-auto mb-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`my-2 flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <span
              className={`px-4 py-2 rounded-2xl max-w-xs break-words ${
                m.role === "user"
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={chatEndRef}></div>
      </div>

      {/* Input */}
      {currentPh && (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            placeholder="Type your answer..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleAnswer}
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition flex-shrink-0"
          >
            ➤
          </button>
        </div>
      )}

      {/* Download Button */}
      {Object.keys(answers).length > 0 && !currentPh && (
        <button
          onClick={handleFill}
          className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
        >
          Download Completed Doc
        </button>
      )}
    </div>
  );
}

export default App;
