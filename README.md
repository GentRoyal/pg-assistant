# UI Academic Regulation Assistant

## Overview

The UI Academic Regulation Assistant is a Retrieval-Augmented Generation (RAG) application designed to answer questions about university academic regulations using information retrieved from official institutional documents.

The system uses documents such as undergraduate handbooks, postgraduate handbooks, examination regulations, registration procedures, departmental handbooks, and student disciplinary regulations as its knowledge base.

Instead of relying only on the general knowledge of a Large Language Model (LLM), the application retrieves relevant sections of the university regulations and provides those sections to the LLM as context for generating its final response.

This helps improve the accuracy, relevance, and traceability of generated answers.

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
