import os
import sys
import asyncio

DEMO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
STT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'Speech_To_Text'))
sys.path.insert(0, DEMO_DIR)
sys.path.insert(0, STT_DIR)

from ai_service import generate_assessment_v2, AssessmentV2Request

async def test_v2_generate_assessment_direct():
    payload = AssessmentV2Request(
        title='Data Structures: Binary Search Trees',
        raw_content='In this lecture, we explore Binary Search Trees (BST). A binary search tree is a binary tree data structure where each node has at most two children. For each node X, values in the left subtree are smaller than X.val and values in the right subtree are greater than X.val.',
        requested_count=2,
        difficulty='MEDIUM'
    )
    response = await generate_assessment_v2(payload)
    print('Response status:', response.get('status'))
    print('Representation used:', response.get('representation_used'))
    print('Validation status:', response.get('validation_status'))
    print('Questions generated:', len(response.get('questions', [])))
    for idx, q in enumerate(response.get('questions', [])):
        print(f"  Q{idx+1}: {q['question']}")
        print(f"    Options: {q['options']}")
        print(f"    Correct: {q['correctAnswer']}")
        print(f"    Explanation: {q['explanation']}")
        print(f"    Metadata: {q['metadata']}")
    assert len(response.get('questions', [])) >= 1
    print('\n[PASSED] Architecture E v2.0 Website Integration Test Passed!')

if __name__ == '__main__':
    asyncio.run(test_v2_generate_assessment_direct())


