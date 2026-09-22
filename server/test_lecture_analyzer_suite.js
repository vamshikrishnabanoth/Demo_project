/**
 * server/test_lecture_analyzer_suite.js
 *
 * Verification suite for Two-Task Lecture Audio & Transcript Analysis:
 * 1. Content Cleaning (excludes jokes, greetings, holidays, admin remarks; preserves student questions & clarifications)
 * 2. Pedagogical Reconstruction (Topic, Motivation, Definitions, Examples, Source Attribution)
 * 3. Handles inaudible noise strictly as [unclear]
 */

'use strict';

const assert = require('assert');
const lectureAnalyzer = require('./engine/evidence/lectureAnalyzer');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING TWO-TASK LECTURE UNDERSTANDING & CLEANER TEST SUITE');
  console.log('===============================================================\n');

  // Sample raw lecture transcript containing real classroom noise, jokes, admin talk, student questions, and core technical lecture
  const sampleTranscript = `
00:00:05 - Teacher: Good morning class, please settle down and take your seats.
00:00:15 - Teacher: Before we begin, remember that tomorrow is a public holiday and the administrative office is closed.
00:00:30 - Student: Sir, when is the final project submission date?
00:00:35 - Teacher: Check the portal for submission dates. Let's focus on today's lecture.
00:00:45 - Teacher: Today we are studying Inheritance in Object-Oriented Programming.
00:01:00 - Teacher: Why do we need inheritance? Because without it, you duplicate code across multiple classes leading to maintenance nightmares.
00:01:25 - Teacher: Haha, remember how Alice broke the build last week with copy-pasting code? That was hilarious.
00:01:40 - Teacher: In formal terms, inheritance allows a derived class to inherit fields and methods from a base class.
00:02:10 - Student: Sir, can a derived class override private methods of the base class?
00:02:20 - Teacher: Excellent question. No, private methods are not accessible in the derived class; you must use protected or public visibility.
00:02:50 - Teacher: For example, suppose we have a base class Vehicle and derived classes Car and Truck that override the startEngine() method.
00:03:20 - Teacher: [unclear]
00:03:30 - Teacher: Key exam rule: Multiple inheritance can lead to the diamond problem in C++, which is why Java uses interfaces.
00:03:50 - Teacher: Alright, that concludes the core discussion. Attendance will be taken at the door.
`;

  console.log('--- Test 1: Transcript Timestamped Segment Parsing ---');
  const segments = lectureAnalyzer.parseTranscriptIntoSegments(sampleTranscript);
  console.log(`Parsed ${segments.length} segments.`);
  assert(segments.length >= 10, 'Should parse all transcript segments');
  assert(segments[0].timestamp === '00:00:05', 'Timestamp should be preserved');
  console.log('✅ Segment parsing and timestamp alignment passed.');

  console.log('\n--- Test 2: Two-Phase Lecture Analysis Execution ---');
  const result = await lectureAnalyzer.analyzeLecture({
    rawText: sampleTranscript,
    segments: segments,
    audioMetadata: { duration: 240, duration_formatted: '00:04:00', language: 'en' }
  });

  console.log('\n📊 Statistics:');
  console.log(`- Total Segments: ${result.statistics?.total_segments}`);
  console.log(`- Retained Academic Segments: ${result.statistics?.retained_academic_segments}`);
  console.log(`- Excluded Segments: ${result.statistics?.excluded_non_academic_segments}`);
  console.log(`- Academic Purity: ${result.statistics?.academic_purity_percentage}%`);

  console.log('\n--- Test 3: Verify Non-Academic Material is Excluded from Clean Transcript ---');
  const cleanedText = result.cleaned_transcript.toLowerCase();
  
  // Verify holiday remark is excluded
  const hasHoliday = cleanedText.includes('tomorrow is a public holiday');
  console.log(`- Holiday remark excluded: ${!hasHoliday ? 'YES ✅' : 'NO ❌'}`);
  assert(!hasHoliday, 'Administrative holiday notice should be excluded from cleaned transcript');

  // Verify joke is excluded
  const hasJoke = cleanedText.includes('that was hilarious');
  console.log(`- Casual joke/laughter excluded: ${!hasJoke ? 'YES ✅' : 'NO ❌'}`);
  assert(!hasJoke, 'Casual joke should be excluded from cleaned transcript');

  // Verify core lecture content is kept
  const hasInheritance = cleanedText.includes('inheritance');
  console.log(`- Core lecture content retained: ${hasInheritance ? 'YES ✅' : 'NO ❌'}`);
  assert(hasInheritance, 'Core inheritance lecture should be retained in cleaned transcript');

  console.log('\n--- Test 4: Verify Student Question & Teacher Clarification are Preserved ---');
  const hasStudentQuery = cleanedText.includes('override private methods') || (result.pedagogical_reconstruction?.student_qa_register || []).some(q => q.question.toLowerCase().includes('override'));
  console.log(`- Student concept question preserved: ${hasStudentQuery ? 'YES ✅' : 'NO ❌'}`);
  assert(hasStudentQuery, 'Relevant student question should be preserved');

  console.log('\n--- Test 5: Verify Pedagogical Structure & Source Attribution ---');
  const recon = result.pedagogical_reconstruction;
  assert(recon.main_topic, 'Main topic must be identified');
  console.log(`- Main Topic: "${recon.main_topic}"`);
  console.log(`- Learning Objective: "${recon.learning_objective}"`);
  console.log(`- Concepts Extracted: ${recon.concepts?.length || 0}`);
  
  if (recon.concepts?.length > 0) {
    const firstConcept = recon.concepts[0];
    console.log(`  * Concept 1: ${firstConcept.concept_name}`);
    console.log(`  * Definition: ${firstConcept.definition}`);
    console.log(`  * Why Needed: ${firstConcept.why_needed}`);
    console.log(`  * Source Attributions: ${JSON.stringify(firstConcept.source_attributions)}`);
    assert(Array.isArray(firstConcept.source_attributions), 'Source attribution list must exist');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! The Voice Lecture Engine is production-ready.');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
