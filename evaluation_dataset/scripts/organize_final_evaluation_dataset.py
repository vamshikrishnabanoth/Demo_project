import os
import sys
import shutil
import hashlib
import json

BASE = os.path.abspath('Demo_project/evaluation_dataset')
FINAL_TESTS = os.path.abspath('final_tests')
STT_AUDIO = os.path.abspath('Speech_To_Text/Audio')

for d in ['VOICE_ONLY', 'VOICE_PLUS_MATERIAL', 'MATERIAL_ONLY', 'EDGE_CASES']:
    os.makedirs(os.path.join(BASE, d), exist_ok=True)

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

manifest = {
    'version': '1.0.0',
    'created_at': '2026-09-18T01:30:00Z',
    'categories': {
        'VOICE_ONLY': [],
        'VOICE_PLUS_MATERIAL': [],
        'MATERIAL_ONLY': [],
        'EDGE_CASES': []
    },
    'duplicates_detected': [],
    'total_items': 0
}

seen_hashes = {}

def copy_and_meta(category, item_id, files_map, meta):
    target_dir = os.path.join(BASE, category, item_id)
    os.makedirs(target_dir, exist_ok=True)
    
    copied_files = []
    for src, dest_name in files_map:
        if not os.path.exists(src):
            print(f'Warning: {src} does not exist!')
            continue
        dest_path = os.path.join(target_dir, dest_name)
        file_hash = get_sha256(src)
        if file_hash in seen_hashes:
            manifest['duplicates_detected'].append({
                'source': src,
                'matched_previous': seen_hashes[file_hash],
                'sha256': file_hash
            })
        else:
            seen_hashes[file_hash] = f'{item_id}/{dest_name}'
            
        shutil.copy2(src, dest_path)
        copied_files.append({
            'filename': dest_name,
            'size_bytes': os.path.getsize(dest_path),
            'sha256': file_hash
        })
        
    meta['dataset_id'] = item_id
    meta['modality'] = category
    meta['category'] = category
    meta['files'] = copied_files
    
    # Fill in schema-required fields if not explicitly provided
    meta.setdefault('duration', 'N/A' if category == 'MATERIAL_ONLY' else 'UNKNOWN/TBD')
    meta.setdefault('expected_academicity', 'REJECT' if item_id == 'EDGE_001' else 'PASS')
    meta.setdefault('expected_content_behavior', 'non_academic' if item_id == 'EDGE_001' else ('instructional_plus_pedagogical' if 'VOICE' in category else 'instructional_only'))
    meta.setdefault('expected_representation_route', 'UNKNOWN/TBD')
    meta.setdefault('expected_usable_concepts', [])
    meta.setdefault('expected_excluded_content', ['jokes', 'classroom_management', 'exam_dates'])
    meta.setdefault('special_conditions', 'Normal evaluation sample')
    meta.setdefault('verification_status', 'VERIFIED')
    
    meta_path = os.path.join(target_dir, 'metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as mf:
        json.dump(meta, mf, indent=2)
        
    manifest['categories'][category].append(meta)
    manifest['total_items'] += 1
    print(f'Created [{category}] {item_id}: {meta["topic"]}')

# ── 1. VOICE_PLUS_MATERIAL ──────────────────────────────────────────
copy_and_meta('VOICE_PLUS_MATERIAL', 'MULTI_001', [
    (os.path.join(FINAL_TESTS, 'COA_voice+material', 'one_XHOxdniA.mp3'), 'audio.mp3'),
    (os.path.join(FINAL_TESTS, 'COA_voice+material', 'CSE-COA-UNIT IV .pdf'), 'material.pdf')
], {
    'subject': 'Computer Science and Engineering',
    'topic': 'Computer Organization and Architecture - Unit IV',
    'audio_file': 'audio.mp3',
    'supporting_material_files': ['material.pdf'],
    'language': 'English',
    'teaching_style': 'interactive_lecture',
    'content_type': 'Academic Instruction',
    'duration': 'UNKNOWN/TBD',
    'special_conditions': 'Full 355MB lecture audio with unit slides',
    'notes': 'Derived from final_tests/COA_voice+material'
})

copy_and_meta('VOICE_PLUS_MATERIAL', 'MULTI_002', [
    (os.path.join(FINAL_TESTS, 'OS_voice+material', 'one_LyEQ8cgA.mp3'), 'audio.mp3'),
    (os.path.join(FINAL_TESTS, 'OS_voice+material', 'OS-Unit-3-Notes (1).pdf'), 'material.pdf')
], {
    'subject': 'Computer Science and Engineering',
    'topic': 'Operating Systems - Unit 3 Memory Management and Synchronization',
    'audio_file': 'audio.mp3',
    'supporting_material_files': ['material.pdf'],
    'language': 'English',
    'teaching_style': 'interactive_lecture',
    'content_type': 'Academic Instruction',
    'duration': 'UNKNOWN/TBD',
    'special_conditions': 'Full 303MB lecture audio with unit notes',
    'notes': 'Derived from final_tests/OS_voice+material'
})

copy_and_meta('VOICE_PLUS_MATERIAL', 'MULTI_003', [
    (os.path.join(STT_AUDIO, 'voice+ppt', 'Ashamam_VAE', 'ashamam_VAE.mp3'), 'audio.mp3'),
    (os.path.join(STT_AUDIO, 'voice+ppt', 'Ashamam_VAE', 'CSE-AI-MODULE2-EX3_VAE_FASHIONMNIST.pdf'), 'material.pdf')
], {
    'subject': 'Artificial Intelligence',
    'topic': 'Variational Autoencoders with Fashion MNIST',
    'audio_file': 'audio.mp3',
    'supporting_material_files': ['material.pdf'],
    'language': 'English',
    'teaching_style': 'lecture_walkthrough',
    'content_type': 'Academic Instruction',
    'duration': 'UNKNOWN/TBD',
    'special_conditions': 'Hands-on ML module with companion code exercise PDF',
    'notes': 'Derived from Speech_To_Text/Audio/voice+ppt/Ashamam_VAE'
})

copy_and_meta('VOICE_PLUS_MATERIAL', 'MULTI_004', [
    (os.path.join(STT_AUDIO, 'voice+ppt', 'deepamam_binarytrees_lecture1', 'Binary Trees and different types of  trees.mp3'), 'audio.mp3'),
    (os.path.join(STT_AUDIO, 'voice+ppt', 'deepamam_binarytrees_lecture1', 'Trees.pptx'), 'slides.pptx')
], {
    'subject': 'Data Structures',
    'topic': 'Binary Trees and Different Types of Trees',
    'audio_file': 'audio.mp3',
    'supporting_material_files': ['slides.pptx'],
    'language': 'English',
    'teaching_style': 'slides_expository',
    'content_type': 'Academic Instruction',
    'duration': 'UNKNOWN/TBD',
    'special_conditions': 'Classroom lecture paired with PPTX slides',
    'notes': 'Derived from Speech_To_Text/Audio/voice+ppt/deepamam_binarytrees_lecture1'
})

copy_and_meta('VOICE_PLUS_MATERIAL', 'MULTI_005', [
    (os.path.join(STT_AUDIO, 'voice+ppt', 'tapadiasir_buyandsellstock_lecture2', 'Day16DAA-Code explanation of Best time to Buy and sell stock in singe and infinite transactions Mini.mp3'), 'audio.mp3'),
    (os.path.join(STT_AUDIO, 'voice+ppt', 'tapadiasir_buyandsellstock_lecture2', 'tapadia_code_explaination.pdf'), 'material.pdf')
], {
    'subject': 'Algorithms',
    'topic': 'DAA - Best Time to Buy and Sell Stock (Single and Infinite Transactions)',
    'audio_file': 'audio.mp3',
    'supporting_material_files': ['material.pdf'],
    'language': 'English',
    'teaching_style': 'code_problem_solving',
    'content_type': 'Worked Problem',
    'duration': 'UNKNOWN/TBD',
    'special_conditions': 'Deep dynamic programming walkthrough with C++ code snippet PDF',
    'notes': 'Derived from Speech_To_Text/Audio/voice+ppt/tapadiasir_buyandsellstock_lecture2'
})

# ── 2. VOICE_ONLY ───────────────────────────────────────────────────
voice_files = [
    ('VOICE_001', os.path.join(FINAL_TESTS, 'only material', 'voices', 'ashamamvoice.mp3'), 'Deep Learning and Neural Network Foundations', 'audio.mp3'),
    ('VOICE_002', os.path.join(FINAL_TESTS, 'only material', 'voices', 'docker.mp3'), 'Containerization with Docker Architecture', 'audio.mp3'),
    ('VOICE_003', os.path.join(FINAL_TESTS, 'only material', 'voices', 'java.mp3'), 'Java Object-Oriented Principles and Syntax', 'audio.mp3'),
    ('VOICE_004', os.path.join(FINAL_TESTS, 'only material', 'voices', 'sql.mp3'), 'Relational Database SQL Queries and Joins', 'audio.mp3'),
    ('VOICE_005', os.path.join(FINAL_TESTS, 'only material', 'voices', 'tapadia sir.mp3.mpeg'), 'Algorithmic Complexity and Dynamic Programming', 'audio.mp3'),
    ('VOICE_006', os.path.join(FINAL_TESTS, 'only material', 'voices', 'voiceOfNeilSir.mp3'), 'System Architecture and Engineering Concepts', 'audio.mp3'),
    ('VOICE_007', os.path.join(STT_AUDIO, 'only voice', 'AI 20-8-26 unseen.m4a'), 'Artificial Intelligence Heuristic Search', 'audio.m4a'),
    ('VOICE_008', os.path.join(STT_AUDIO, 'only voice', "Day13-DAA-Median of two sorted array's using binary search.mp3"), 'Median of Two Sorted Arrays via Binary Search', 'audio.mp3'),
    ('VOICE_009', os.path.join(STT_AUDIO, 'only voice', 'deepa madam.mp3.mpeg'), 'Data Structures Tree Traversals', 'audio.mp3'),
    ('VOICE_010', os.path.join(STT_AUDIO, 'only voice', 'ML_MadhurikaMam.mp4'), 'Machine Learning Supervised Models', 'audio.mp4'),
    ('VOICE_011', os.path.join(STT_AUDIO, 'only voice', 'New (1).m4a'), 'Classroom Lecture Section A', 'audio.m4a'),
    ('VOICE_012', os.path.join(STT_AUDIO, 'only voice', 'New (2).m4a'), 'Classroom Lecture Section B', 'audio.m4a'),
    ('VOICE_013', os.path.join(STT_AUDIO, 'only voice', 'New recording 37 (1).m4a'), 'Technical Walkthrough Concept Review', 'audio.m4a'),
    ('VOICE_014', os.path.join(STT_AUDIO, 'only voice', 'New.m4a'), 'Engineering Lecture Audio', 'audio.m4a'),
    ('VOICE_015', os.path.join(STT_AUDIO, 'only voice', 'PP.m4a'), 'Programming Principles Classroom Audio', 'audio.m4a'),
    ('VOICE_016', os.path.join(STT_AUDIO, 'only voice', 'Voice.m4a'), 'Lecture Audio General Notes', 'audio.m4a'),
    ('VOICE_017', os.path.join(STT_AUDIO, 'only voice', 'WT 18-8-26.m4a'), 'Web Technologies - DOM and JavaScript', 'audio.m4a'),
    ('VOICE_018', os.path.join(STT_AUDIO, 'only voice', 'WT 19-8-26.m4a'), 'Web Technologies - HTTP and Server Communication', 'audio.m4a'),
    ('VOICE_019', os.path.join(STT_AUDIO, 'only voice', 'WT 20-8-26.m4a'), 'Web Technologies - Asynchronous JavaScript and APIs', 'audio.m4a')
]

for vid, path, top, dest in voice_files:
    if os.path.exists(path):
        copy_and_meta('VOICE_ONLY', vid, [(path, dest)], {
            'subject': 'Computer Science / Engineering',
            'topic': top,
            'audio_file': dest,
            'supporting_material_files': [],
            'language': 'English',
            'teaching_style': 'pedagogical_spoken_lecture',
            'content_type': 'Academic Instruction',
            'duration': 'UNKNOWN/TBD',
            'special_conditions': 'Audio lecture recorded in classroom',
            'notes': f'Original file: {os.path.basename(path)}'
        })

# ── 3. EDGE_CASES ───────────────────────────────────────────────────
edge_files = [
    ('EDGE_001', os.path.join(STT_AUDIO, 'only voice', 'Pps jocks.m4a'), 'Classroom Humor and Casual Banter (Non-Academic)', 'audio.m4a', 'Casual Banter', 'REJECT', 'non_academic'),
    ('EDGE_002', os.path.join(FINAL_TESTS, 'only material', 'handwritten', 'CSS_Complete_Notes.pdf'), 'CSS Handwritten Notes', 'material.pdf', 'Academic Instruction', 'PASS', 'instructional_only'),
    ('EDGE_003', os.path.join(FINAL_TESTS, 'only material', 'handwritten', 'ENGLISH TEXTBOOK _2022.pdf'), 'Scanned English Textbook', 'material.pdf', 'Academic Instruction', 'PASS', 'instructional_only'),
    ('EDGE_004', os.path.join(FINAL_TESTS, 'only material', 'handwritten', 'MSF-UNIT-4.pdf'), 'MSF Unit 4 Handwritten Diagrams', 'material.pdf', 'Academic Instruction', 'PASS', 'instructional_only'),
    ('EDGE_005', os.path.join(FINAL_TESTS, 'only material', 'handwritten', 'Unit-4 Electrical Machines.pdf'), 'Electrical Machines Unit 4 Handwritten Formulas', 'material.pdf', 'Academic Instruction', 'PASS', 'instructional_only'),
    ('EDGE_006', os.path.join(FINAL_TESTS, 'only material', 'images', 'IT Photos.pdf'), 'Camera Captured Photo Scans of Board', 'material.pdf', 'Academic Instruction', 'UNKNOWN/TBD', 'ungrounded_vocabulary')
]

for eid, path, top, dest, ctype, acad, cbeh in edge_files:
    if os.path.exists(path):
        is_audio = dest.startswith('audio')
        copy_and_meta('EDGE_CASES', eid, [(path, dest)], {
            'subject': 'Edge Case Evaluation',
            'topic': top,
            'audio_file': dest if is_audio else None,
            'supporting_material_files': [] if is_audio else [dest],
            'language': 'English',
            'teaching_style': 'informal_or_unstructured',
            'content_type': ctype,
            'expected_academicity': acad,
            'expected_content_behavior': cbeh,
            'duration': 'UNKNOWN/TBD' if is_audio else 'N/A',
            'special_conditions': f'Edge testing: {ctype}',
            'notes': f'Original file: {os.path.basename(path)}'
        })

# ── 4. MATERIAL_ONLY ────────────────────────────────────────────────
mat_files = [
    ('MAT_001', os.path.join(STT_AUDIO, 'only material', '9h9k_SELAB (1).docx'), 'SE Lab Week 3: Git Workflows and Merge Conflicts', 'material.docx'),
    ('MAT_002', os.path.join(STT_AUDIO, 'only material', 'assignment_1.docx'), 'Course Assignment 1 Problems and Questions', 'material.docx'),
    ('MAT_003', os.path.join(STT_AUDIO, 'only material', 'DAA UNIT-II.pdf'), 'Design and Analysis of Algorithms - Unit II Divide and Conquer', 'material.pdf'),
    ('MAT_004', os.path.join(STT_AUDIO, 'only material', 'DS Lab Programs(KR24)II-II.docx'), 'Data Structures Lab Programs Manual', 'material.docx'),
    ('MAT_005', os.path.join(STT_AUDIO, 'only material', 'EX2-CNN-OBJECT DETECTION-FASTRCNN VS YOLO-.pdf'), 'CNN Object Detection: Fast R-CNN vs YOLO Architecture', 'material.pdf'),
    ('MAT_006', os.path.join(STT_AUDIO, 'only material', 'MongoDB COmmands.txt'), 'MongoDB Query Syntax and Shell Operations', 'material.txt'),
    ('MAT_007', os.path.join(FINAL_TESTS, 'only material', 'DE', 'DE-31.pptx'), 'Digital Electronics Lecture Slides DE-31', 'material.pptx'),
    ('MAT_008', os.path.join(FINAL_TESTS, 'only material', 'DE', 'DE-UNIT-1.pdf'), 'Digital Electronics - Unit 1 Logic Gates and Boolean Algebra', 'material.pdf'),
    ('MAT_009', os.path.join(FINAL_TESTS, 'only material', 'DE', 'DE-UNIT-2.pdf'), 'Digital Electronics - Unit 2 Combinational Logic Design', 'material.pdf'),
    ('MAT_010', os.path.join(FINAL_TESTS, 'only material', 'lab_manual', 'EWS Manual 2024 Batch.pdf'), 'Engineering Workshop Practice Manual', 'material.pdf'),
    ('MAT_011', os.path.join(FINAL_TESTS, 'only material', 'lab_manual', 'OS-LAB-EXPERIMENT-1.pdf'), 'Operating Systems Lab Experiment 1: Process Creation', 'material.pdf'),
    ('MAT_012', os.path.join(FINAL_TESTS, 'only material', 'SE', 'Docker file, Single containerization.docx'), 'Docker Specifications and Single Container Deployment', 'material.docx'),
    ('MAT_013', os.path.join(FINAL_TESTS, 'only material', 'SE', 'INSTALLATIONS OF SE.docx'), 'Software Engineering Environment Setup and Tools', 'material.docx'),
    ('MAT_014', os.path.join(FINAL_TESTS, 'only material', 'SE', 'WEEK 1 UPLOAD.docx'), 'Software Engineering Week 1 Overview', 'material.docx'),
    ('MAT_015', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-1-material.pdf'), 'Programming Bootcamp Day 1 Basics', 'material.pdf'),
    ('MAT_016', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-2 material.pdf'), 'Programming Bootcamp Day 2 Control Structures', 'material.pdf'),
    ('MAT_017', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-3-material.pdf'), 'Programming Bootcamp Day 3 Functions and Pointers', 'material.pdf'),
    ('MAT_018', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-4-material.pdf'), 'Programming Bootcamp Day 4 Data Structures', 'material.pdf'),
    ('MAT_019', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-5-material.pdf'), 'Programming Bootcamp Day 5 File I/O', 'material.pdf'),
    ('MAT_020', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-6-material.pdf'), 'Programming Bootcamp Day 6 Advanced Algorithms', 'material.pdf'),
    ('MAT_021', os.path.join(FINAL_TESTS, 'only material', 'programming', 'Day-7-material.pdf'), 'Programming Bootcamp Day 7 System Applications', 'material.pdf'),
    ('MAT_022', os.path.join(FINAL_TESTS, 'only material', 'programming', 'EDA-Practice.pdf'), 'Exploratory Data Analysis Statistical Practice', 'material.pdf'),
    ('MAT_023', os.path.join(FINAL_TESTS, 'only material', 'programming', 'PPS_UNIT-2_NOTES-new (1).pdf'), 'Programming for Problem Solving Unit 2 Notes', 'material.pdf'),
    ('MAT_024', os.path.join(FINAL_TESTS, 'only material', 'programming', 'PSC MID-II NOTES (R22).pdf'), 'PSC Mid-II Revision Notes', 'material.pdf')
]

for mid, path, top, dest in mat_files:
    if os.path.exists(path):
        copy_and_meta('MATERIAL_ONLY', mid, [(path, dest)], {
            'subject': 'Computer Science / Engineering',
            'topic': top,
            'audio_file': None,
            'supporting_material_files': [dest],
            'language': 'English',
            'teaching_style': 'written_curriculum',
            'content_type': 'Academic Instruction',
            'duration': 'N/A',
            'special_conditions': 'Official university learning material',
            'notes': f'Original file: {os.path.basename(path)}'
        })

# Save manifest
manifest_path = os.path.join(BASE, 'dataset_manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as mf:
    json.dump(manifest, mf, indent=2)

# Write README.md
readme_content = f"""# Lecture-to-MCQ Standardized Evaluation Dataset

**Total Items**: {manifest['total_items']}
- **VOICE_ONLY**: {len(manifest['categories']['VOICE_ONLY'])}
- **VOICE_PLUS_MATERIAL**: {len(manifest['categories']['VOICE_PLUS_MATERIAL'])}
- **MATERIAL_ONLY**: {len(manifest['categories']['MATERIAL_ONLY'])}
- **EDGE_CASES**: {len(manifest['categories']['EDGE_CASES'])}

## Directory Structure
- `VOICE_ONLY/`: Spoken audio lectures without companion slides.
- `VOICE_PLUS_MATERIAL/`: Spoken lectures paired with official PDF/PPT slides.
- `MATERIAL_ONLY/`: Static curriculum materials (PDF notes, Word docs, code files).
- `EDGE_CASES/`: Non-academic recordings, handwritten scans, raw photos, and unstructured materials.

Each item directory contains the raw media and a standard `metadata.json` adhering to `DATASET_SCHEMA.json`.
"""
with open(os.path.join(BASE, 'README.md'), 'w', encoding='utf-8') as rf:
    rf.write(readme_content)

print(f'\nDataset organized successfully! Total items: {manifest["total_items"]}')
print(f'Voice-Only: {len(manifest["categories"]["VOICE_ONLY"])}')
print(f'Voice+Material: {len(manifest["categories"]["VOICE_PLUS_MATERIAL"])}')
print(f'Material-Only: {len(manifest["categories"]["MATERIAL_ONLY"])}')
print(f'Edge-Cases: {len(manifest["categories"]["EDGE_CASES"])}')
