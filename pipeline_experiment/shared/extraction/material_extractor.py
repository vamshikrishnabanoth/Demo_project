"""
Deterministic Material Extractor.
Extracts raw text, code cells, execution outputs, Word docs (.docx), PowerPoint slides (.pptx), and PDF files faithfully without LLM rewriting.
"""

import os
from typing import Dict, Any, List, Optional
import nbformat
import fitz  # PyMuPDF
import docx
import pptx


class DeterministicMaterialExtractor:
    @staticmethod
    def extract_pdf(pdf_path: str) -> Dict[str, Any]:
        """Extracts text page-by-page from a PDF document."""
        doc = fitz.open(pdf_path)
        pages = []
        full_text_parts = []
        for idx in range(len(doc)):
            page = doc[idx]
            text = page.get_text("text").strip()
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            title = lines[0] if lines else f"Page {idx + 1}"
            pages.append({
                "page_number": idx + 1,
                "title": title,
                "content": text
            })
            full_text_parts.append(f"--- [Page/Slide {idx + 1}: {title}] ---\n{text}")
        doc.close()
        return {
            "total_pages": len(pages),
            "pages": pages,
            "concatenated_text": "\n\n".join(full_text_parts)
        }

    @staticmethod
    def extract_docx(docx_path: str) -> Dict[str, Any]:
        """Extracts paragraphs and tables from a Word document (.docx)."""
        doc = docx.Document(docx_path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        
        # Also extract table text if present
        table_texts = []
        for table in doc.tables:
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_cells:
                    table_texts.append(" | ".join(row_cells))

        full_text = "\n\n".join(paragraphs)
        if table_texts:
            full_text += "\n\n--- [TABLE DATA] ---\n" + "\n".join(table_texts)

        return {
            "total_paragraphs": len(paragraphs),
            "paragraphs": paragraphs,
            "concatenated_text": full_text
        }

    @staticmethod
    def extract_pptx(pptx_path: str) -> Dict[str, Any]:
        """Extracts slide-by-slide text and notes from a PowerPoint presentation (.pptx)."""
        prs = pptx.Presentation(pptx_path)
        slides = []
        full_text_parts = []
        for idx, slide in enumerate(prs.slides):
            slide_text_parts = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        txt = para.text.strip()
                        if txt:
                            slide_text_parts.append(txt)
            slide_content = "\n".join(slide_text_parts)
            title = slide_text_parts[0] if slide_text_parts else f"Slide {idx + 1}"
            slides.append({
                "slide_number": idx + 1,
                "title": title,
                "content": slide_content
            })
            full_text_parts.append(f"--- [Slide {idx + 1}: {title}] ---\n{slide_content}")

        return {
            "total_slides": len(slides),
            "slides": slides,
            "concatenated_text": "\n\n".join(full_text_parts)
        }

    @staticmethod
    def extract_ipynb(ipynb_path: str) -> Dict[str, Any]:
        """Extracts markdown, code cells, and execution outputs from a Jupyter/Colab notebook."""
        with open(ipynb_path, "r", encoding="utf-8") as f:
            nb = nbformat.read(f, as_version=4)

        cells = []
        formatted_parts = []
        for idx, cell in enumerate(nb.cells):
            cell_type = cell.cell_type
            source = cell.source.strip()
            outputs_text = []
            if cell_type == "code" and "outputs" in cell:
                for out in cell["outputs"]:
                    if "text" in out:
                        outputs_text.append(out["text"].strip())
                    elif "data" in out and "text/plain" in out["data"]:
                        outputs_text.append(out["data"]["text/plain"].strip())

            out_str = "\n".join(outputs_text) if outputs_text else None
            cells.append({
                "cell_index": idx + 1,
                "cell_type": cell_type,
                "source": source,
                "outputs": out_str
            })

            if cell_type == "code":
                formatted_parts.append(f"--- [Code Cell {idx + 1}] ---\n```python\n{source}\n```")
                if out_str:
                    formatted_parts.append(f"[Output]:\n{out_str}")
            else:
                formatted_parts.append(f"--- [Markdown Cell {idx + 1}] ---\n{source}")

        return {
            "total_cells": len(cells),
            "cells": cells,
            "concatenated_text": "\n\n".join(formatted_parts)
        }

    @staticmethod
    def extract_text_or_code(file_path: str) -> str:
        """Reads plain text, markdown notes, or code scripts directly."""
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read().strip()
