const { gradeAnswer } = require('../utils/grading');

describe('gradeAnswer Utility', () => {
    // 1. Exact string matches
    test('should match exact correct answer (case-insensitive and trimmed)', () => {
        const question = { correctAnswer: 'JavaScript', points: 10 };
        
        // Exact match
        expect(gradeAnswer('JavaScript', question)).toEqual({ isCorrect: true, points: 10 });
        
        // Case-insensitive match
        expect(gradeAnswer('javascript', question)).toEqual({ isCorrect: true, points: 10 });
        
        // Trimmed match
        expect(gradeAnswer('  JavaScript  ', question)).toEqual({ isCorrect: true, points: 10 });
    });

    // 2. Option Label Fallback matches
    test('should fall back to option label matching (letter check)', () => {
        const question = {
            correctAnswer: 'a',
            options: ['Red', 'Green', 'Blue'],
            points: 15
        };

        // Student submits the actual option value ("Red") when the key is "a"
        expect(gradeAnswer('Red', question)).toEqual({ isCorrect: true, points: 15 });
        expect(gradeAnswer('red', question)).toEqual({ isCorrect: true, points: 15 });
        expect(gradeAnswer('  red  ', question)).toEqual({ isCorrect: true, points: 15 });
        
        // Incorrect option value matching label
        expect(gradeAnswer('Green', question)).toEqual({ isCorrect: false, points: 0 });
    });

    // 3. Option Index Fallback matches
    test('should fall back to option index matching (integer string check)', () => {
        const question = {
            correctAnswer: '1',
            options: ['Apple', 'Banana', 'Orange'],
            points: 8
        };

        // Student submits the option corresponding to index 1 ("Banana")
        expect(gradeAnswer('Banana', question)).toEqual({ isCorrect: true, points: 8 });
        expect(gradeAnswer('banana', question)).toEqual({ isCorrect: true, points: 8 });
        
        // Incorrect index value matching option
        expect(gradeAnswer('Apple', question)).toEqual({ isCorrect: false, points: 0 });
    });

    // 4. Incorrect answer handling
    test('should grade incorrect answers as false and 0 points', () => {
        const question = {
            correctAnswer: 'True',
            options: ['True', 'False'],
            points: 10
        };

        expect(gradeAnswer('False', question)).toEqual({ isCorrect: false, points: 0 });
        expect(gradeAnswer('mismatch', question)).toEqual({ isCorrect: false, points: 0 });
    });

    // 5. Edge cases and null inputs
    test('should handle empty, null, or undefined inputs gracefully', () => {
        const question = { correctAnswer: 'Yes', points: 10 };
        
        expect(gradeAnswer(null, question)).toEqual({ isCorrect: false, points: 0 });
        expect(gradeAnswer(undefined, question)).toEqual({ isCorrect: false, points: 0 });
        expect(gradeAnswer('', question)).toEqual({ isCorrect: false, points: 0 });
        
        // Missing points should default to 10
        const questionNoPoints = { correctAnswer: 'Yes' };
        expect(gradeAnswer('Yes', questionNoPoints)).toEqual({ isCorrect: true, points: 10 });
    });
});
