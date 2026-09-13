# Canonical Schema Definitions

## 1. Instructional Evidence Record
```json
{
  "evidence_id": "E01",
  "topic_id": "TOP_01",
  "time_spans": [{"start": 120.0, "end": 450.0}],
  "dwell_time": 330.0,
  "repetition_count": 8,
  "emphasis_markers": ["pay close attention", "exam question"],
  "worked_example": true,
  "demonstration": false,
  "student_question": true,
  "teacher_correction": false,
  "debugging_event": false,
  "code_interaction": false,
  "negative_instruction": false,
  "source_refs": ["Slide 4"]
}
```

## 2. Pedagogical Blueprint Topic (Layer 2)
```json
{
  "topic_id": "TOP_03",
  "topic": "Convolution Output Dimension Formula",
  "salience_score": 0.88,
  "instructional_acts": ["EXPLAIN", "PRACTICE"],
  "dominant_mode": "WORKED_EXAMPLE",
  "target_bloom_level": "APPLY",
  "prerequisite_concepts": ["convolution", "padding", "stride"],
  "evidence_refs": ["E03", "E04"],
  "teacher_specificity": "HIGH"
}
```

## 3. Assessment Slot (Layer 4)
```json
{
  "slot_id": "S01",
  "topic_id": "TOP_03",
  "topic_name": "Convolution Output Dimension Formula",
  "cognitive_level": "APPLY",
  "instructional_mode": "WORKED_EXAMPLE",
  "assessment_goal": "Calculate spatial size of feature map after two sequential convolution layers",
  "misconception_target": "Assuming layer 2 calculation is independent of layer 1 output size",
  "evidence_refs": ["E03"],
  "question_type": "NUMERICAL_SCENARIO",
  "target_options_count": 4
}
```

## 4. Standardized MCQ Item
```json
{
  "question_id": "S01",
  "question_text": "A 32x32 input passes through Layer 1 (K=3, P=1, S=1) and Layer 2 (K=3, P=0, S=2). What is the output spatial size?",
  "option_a": "15",
  "option_b": "16",
  "option_c": "14",
  "option_d": "32",
  "correct_option": "A",
  "explanation": "Layer 1 produces 32x32. Layer 2 produces floor((32 - 3)/2) + 1 = 15.",
  "target_concept": "Convolution Output Dimension Formula",
  "cognitive_level": "APPLY"
}
```
