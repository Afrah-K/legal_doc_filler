from fastapi import FastAPI, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from docx import Document
from docxtpl import DocxTemplate
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
import tempfile, os, uuid, re, json

load_dotenv()

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = tempfile.gettempdir()
PLACEHOLDER_REGEX = re.compile(r"\[([^\]]+)\]|\$\[_{5,}\]")

# -------------------
# LangChain setup
# -------------------
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

memory = ConversationBufferMemory(
    input_key="legal_context",
    memory_key="history",
    return_messages=True
)

prompt = PromptTemplate(
    input_variables=["legal_context"],
    template="{legal_context}"
)

chain = LLMChain(llm=llm, prompt=prompt, memory=memory)

# -------------------
# Prompt registry loader
# -------------------
PROMPTS_DIR = Path(__file__).parent / "prompts"

def load_prompt(doc_type: str) -> str:
    path = os.path.join(PROMPTS_DIR, f"{doc_type}.txt")
    if not os.path.exists(path):
        return "You are a helpful assistant helping fill out a legal document."
    with open(path, "r") as f:
        return f.read()

# -------------------
# Helper: convert placeholders to {{ }}
# -------------------
def convert_to_docxtpl_format(text: str) -> str:
    def replacer(match):
        raw = match.group(1).strip()
        key = raw.replace(" ", "_")
        return f"{{{{ {key} }}}}"
    return re.sub(r'\$?\[([^\]]+)\]', replacer, text)

# -------------------
# Upload endpoint
# -------------------
@app.post("/upload")
async def upload_doc(file: UploadFile = File(...), doc_type: str = Form("generic")):
    file_id = str(uuid.uuid4())
    tmp_path = os.path.join(UPLOAD_DIR, file_id + ".docx")
    with open(tmp_path, "wb") as f:
        f.write(await file.read())

    doc = Document(tmp_path)

    # Convert placeholders
    for para in doc.paragraphs:
        para.text = convert_to_docxtpl_format(para.text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                cell.text = convert_to_docxtpl_format(cell.text)
    doc.save(tmp_path)

    # Extract placeholders
    PLACEHOLDER_REGEX = re.compile(r"\{\{\s*([^\}]+)\s*\}\}")
    placeholders = set()
    for para in doc.paragraphs:
        for m in PLACEHOLDER_REGEX.finditer(para.text):
            placeholders.add(m.group(1))
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for m in PLACEHOLDER_REGEX.finditer(cell.text):
                    placeholders.add(m.group(1))

    return {
        "file_id": file_id,
        "placeholders": list(placeholders),
        "doc_type": doc_type
    }

# -------------------
# Chat endpoint
# -------------------
@app.post("/chat")
async def chat_flow(data: dict = Body(...)):
    placeholders = data.get("placeholders", [])
    answers = data.get("answers", {})
    doc_type = data.get("doc_type", "generic")

    unfilled_phs = [ph for ph in placeholders if ph not in answers]
    if not unfilled_phs:
        return {"done": True, "message": "✅ All placeholders filled!"}

    next_ph = unfilled_phs[0]

    legal_context_text = load_prompt(doc_type)

    combined_input = (
        f"{legal_context_text}\n\n"
        f"Conversation so far:\n{memory.buffer_as_str}\n\n"
        f"Next placeholder to fill: {next_ph}\n"
        f"Already filled placeholders:\n{json.dumps(answers, indent=2)}\n\n"
        f"Ask the user a clear, natural question to fill this placeholder."
    )

    question = chain.run(legal_context=combined_input)

    return {
        "done": False,
        "placeholder": next_ph,
        "message": question
    }

# -------------------
# Fill placeholders
# -------------------
@app.post("/fill")
async def fill_doc(file_id: str = Form(...), values: str = Form(...)):
    values_dict = json.loads(values)
    src_path = os.path.join(UPLOAD_DIR, file_id + ".docx")

    if not os.path.exists(src_path):
        return JSONResponse({"error": "File not found"}, status_code=404)

    tpl = DocxTemplate(src_path)
    tpl.render(values_dict)
    out_path = os.path.join(UPLOAD_DIR, file_id + "_filled.docx")
    tpl.save(out_path)

    return FileResponse(out_path, filename="filled.docx")

# -------------------
# Serve React frontend
# -------------------
build_path = Path(__file__).parent.parent / "frontend" / "build"
app.mount("/static", StaticFiles(directory=build_path / "static"), name="static")

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    index_file = build_path / "index.html"
    return FileResponse(index_file)
