import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [docType, setDocType] = useState("safe");
  const [placeholders, setPlaceholders] = useState([]);
  const [answers, setAnswers] = useState({});
  const [messages, setMessages] = useState([]);
  const [currentPh, setCurrentPh] = useState(null);

  const chatEndRef = useRef(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async () => {
    if (!file) return alert("Please choose a file");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    const res = await axios.post("http://localhost:8000/upload", formData);
    setFileId(res.data.file_id);
    setPlaceholders(res.data.placeholders);

    setMessages([{ role: "assistant", text: "✅ Document uploaded. Let’s start filling it in!" }]);
    nextQuestion(res.data.placeholders, {}, res.data.doc_type);
  };

  const nextQuestion = async (phs, ans, dt = docType) => {
    const res = await axios.post("http://localhost:8000/chat", {
      placeholders: phs,
      answers: ans,
      doc_type: dt,
    });

    if (res.data.done) {
      setMessages(prev => [...prev, { role: "assistant", text: res.data.message }]);
      setCurrentPh(null);
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: res.data.message }]);
      setCurrentPh(res.data.placeholder);
    }
  };

  const handleAnswer = async (answer) => {
    if (!currentPh) return;

    const updated = { ...answers, [currentPh]: answer };
    setAnswers(updated);
    setMessages(prev => [...prev, { role: "user", text: answer }]);

    nextQuestion(placeholders, updated, docType);
  };

  const handleFill = async () => {
    const formData = new FormData();
    formData.append("file_id", fileId);
    formData.append("values", JSON.stringify(answers));

    const res = await axios.post("http://localhost:8000/fill", formData, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "filled.docx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 font-sans">
      <h1 className="text-3xl font-bold mb-4 text-gray-800">Legal Doc Chat Filler</h1>

      {!fileId && (
        <div className="mb-6 space-x-4 flex flex-wrap items-center">
          <label className="font-medium text-gray-700">Document type:</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="safe">SAFE Agreement</option>
            <option value="nda">NDA</option>
            <option value="employment">Employment Agreement</option>
          </select>

          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="border border-gray-300 rounded px-2 py-1"
          />
          <button
            onClick={handleUpload}
            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 transition"
          >
            Upload
          </button>
        </div>
      )}

      <div className="flex-1 border border-gray-300 rounded p-4 bg-gray-50 overflow-y-auto mb-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`my-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <span className={`px-4 py-2 rounded-2xl max-w-xs break-words ${
              m.role === "user" ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 text-gray-800 rounded-bl-none"
            }`}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={chatEndRef}></div>
      </div>

      {currentPh && (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Type your answer..."
            id="answer-input"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAnswer(e.target.value);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById("answer-input");
              handleAnswer(input.value);
              input.value = "";
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}

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
