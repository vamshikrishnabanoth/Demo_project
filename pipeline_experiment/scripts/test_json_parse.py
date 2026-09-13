import os
import sys
sys.path.insert(0, ".")
import json_repair
from pipeline_experiment.shared.schemas.canonical_models import MCQSuite

# Malformed snippet where LLM put } before correct_option
malformed_raw = """
{
  "pipeline_type": "PIPELINE_C_COMBINED",
  "input_id": "CNN_001",
  "input_type": "PDF",
  "content_style": "THEORY",
  "total_questions": 1,
  "questions": [
    {
      "question_id": "Q01",
      "question_text": "What is RoI Pooling?",
      "option_a": "A",
      "option_b": "B",
      "option_c": "C",
      "option_d": "D"
    },
    "correct_option": "B",
    "explanation": "Exp",
    "target_concept": "Fast R-CNN"
  ]
}
"""

# Test with regex cleaner for misplaced braces + json_repair
import re
cleaned = re.sub(r'\}\s*,\s*"correct_option"', ',\n      "correct_option"', malformed_raw)
parsed = json_repair.loads(cleaned)
suite = MCQSuite.model_validate(parsed)
print(f"SUCCESS! Loaded MCQSuite: {suite.pipeline_type} with {len(suite.questions)} questions")
print("Q1 Correct Option:", suite.questions[0].correct_option)
