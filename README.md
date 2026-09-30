# UI Academic Regulation Assistant

## Overview

The UI Academic Regulation Assistant is a Retrieval-Augmented Generation (RAG) application designed to answer questions about university academic regulations using information retrieved from official institutional documents.

The system uses documents such as undergraduate handbooks, postgraduate handbooks, examination regulations, registration procedures, departmental handbooks, and student disciplinary regulations as its knowledge base.

Instead of relying only on the general knowledge of a Large Language Model (LLM), the application retrieves relevant sections of the university regulations and provides those sections to the LLM as context for generating its final response.

This helps improve the accuracy, relevance, and traceability of generated answers.

## Frontend

The React app lives in [`frontend/`](./frontend/):

- [`frontend/DEMO.md`](./frontend/DEMO.md) — walkthrough
- [`frontend/ADMIN_API.md`](./frontend/ADMIN_API.md) — auth and admin endpoints
- [`frontend/README.md`](./frontend/README.md) — setup, chat API, deploy

```bash
cd frontend && npm install && npm run dev
```

## Accounts

Students sign up on the sign-in page and must be signed in to chat. Admin accounts are
created on the command line, never through the app:

```bash
python scripts/create_admin.py you@ui.edu.ng --name "Your Name"
```

It asks for the password (at least 8 characters). Running it for an existing account makes
that account an admin and sets the new password.

Before first use, run [`database/migrations/001_auth_and_admin.sql`](./database/migrations/001_auth_and_admin.sql)
once in the Supabase SQL editor. It adds the accounts, sessions and admin console tables.

## RAG Workflow

The main workflow of the system is:

```text
Academic Regulation PDFs
        ↓
PDF Text Extraction
        ↓
Text Cleaning
        ↓
Structure-Aware Chunking
        ↓
Overlapping Chunks
        ↓
Embedding Generation
        ↓
Supabase PostgreSQL + pgvector
        ↓

User Question
        ↓
Query Embedding
        ↓
Vector Similarity Search
        ↓
Relevant Document Chunks
        ↓
LLM + Retrieved Context
        ↓
Generated Answer + Source Information
```

## Retrieval Process

When a user submits a question:

1. The question is converted into an embedding.
2. The embedding is compared with stored chunk embeddings using pgvector.
3. The most relevant chunks are retrieved.
4. Their text and metadata are passed to the LLM.
5. The LLM generates a response based on the retrieved context.
6. The question, retrieved chunks, and generated response are recorded in `query_logs`.

The retrieved chunks provide the evidence while the LLM is responsible for producing a readable final response.

## Project Goal

The goal of the project is to demonstrate how Retrieval-Augmented Generation can be applied to local university regulations to create an academic assistant that provides grounded responses from institutional documents.

The system should be able to retrieve relevant regulations, generate understandable answers, identify the source of those answers, and avoid providing unsupported responses when the required information cannot be found in the knowledge base.
